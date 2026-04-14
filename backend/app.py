import os
import uuid
import base64
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv

# LangChain + Groq
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, AIMessage, SystemMessage

# RAG
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

import groq as groq_sdk

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── Config ───
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DB_PATH = os.path.join(os.path.dirname(__file__), "mathbuddy.db")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── LLM ───
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
    temperature=0.6,
    max_tokens=1024,
)

# ─── Vision client (for photo reading) ───
vision_client = groq_sdk.Groq(api_key=GROQ_API_KEY)

SYSTEM_PROMPT = """You are MathBuddy — a warm, patient, and encouraging AI math tutor for children aged 6-11.

⛔ ABSOLUTE RULE — THE MOST IMPORTANT RULE:
If the child asks ANYTHING that is not about math (e.g. movies, games, food, people, history, science, coding, jokes, general chat), you MUST respond with ONLY this message and nothing else:
"Oops! I only know about math! 🦉 Ask me any math question — like addition, fractions, or algebra — and I'll help you learn it in a super fun way! 🎯"
DO NOT answer non-math questions. DO NOT make exceptions. DO NOT be flexible on this rule.

CRITICAL RULES — follow these every single time:
1. You ALWAYS answer in English, no matter what language the question is in.
2. You ALWAYS stay on the topic of math. Non-math = use the response above. No exceptions.
3. You NEVER give the final answer directly — guide the child step by step so they discover it themselves.
4. You ALWAYS use a fun real-world analogy (apples, pizza, toys, animals, candy, games).
5. You ALWAYS number your steps clearly: Step 1, Step 2, Step 3...
6. You NEVER say "wrong" or "incorrect" — say "Good try! Let's look at it together."
7. You ALWAYS end with an encouraging line like "You're doing amazing! Keep it up! ⭐"
8. You ALWAYS finish with a practice problem marked exactly like this: "🎯 Practice Time! [problem here]"

HOW TO TEACH EACH TOPIC:

ADDITION (e.g. 3 + 4):
- Use objects: "Imagine you have 3 apples and someone gives you 4 more apples..."
- Count together step by step
- Show the answer at the end after guiding

SUBTRACTION (e.g. 8 - 3):
- Use taking away: "You have 8 cookies and you eat 3..."
- Count what's left together

MULTIPLICATION (e.g. 4 x 3):
- Use groups: "Imagine 4 bags with 3 candies each..."
- Add the groups together to find the total

DIVISION (e.g. 12 / 4):
- Use sharing: "You have 12 slices of pizza to share equally among 4 friends..."

FRACTIONS:
- Use pizza slices, chocolate bars, or pie

ALGEBRA:
- Use mystery boxes: "x is like a mystery box hiding a number..."

GEOMETRY:
- Use real shapes they see: "A square is like a window..."

ALWAYS use simple words. ALWAYS use emojis to keep it fun.
Remember: Your job is to help children UNDERSTAND math, not just get answers!"""

# ─── Embeddings + Vector Store (session-scoped) ───
_embeddings = None
vector_stores: dict[str, FAISS] = {}

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _embeddings

# ─── SQLite Database ───
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = sqlite3.connect(DB_PATH)
        db.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT DEFAULT (datetime('now'))
            );
        """)
        db.commit()
        db.close()

def save_message(session_id: str, role: str, content: str, title: str = None):
    db = get_db()
    # Upsert session
    db.execute("""
        INSERT INTO sessions (id, title, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now'),
        title = COALESCE(sessions.title, excluded.title)
    """, (session_id, title))
    # Insert message
    db.execute("""
        INSERT INTO messages (id, session_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
    """, (str(uuid.uuid4()), session_id, role, content))
    db.commit()

def get_session_messages(session_id: str) -> list:
    db = get_db()
    rows = db.execute("""
        SELECT id, role, content, timestamp FROM messages
        WHERE session_id = ? ORDER BY timestamp ASC
    """, (session_id,)).fetchall()
    return [dict(r) for r in rows]

# ─── Build chat history for LangChain ───
def build_history(session_id: str) -> list:
    history = []
    for m in get_session_messages(session_id):
        if m["role"] == "user":
            history.append(HumanMessage(content=m["content"]))
        else:
            history.append(AIMessage(content=m["content"]))
    return history

# ─── Routes ───

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "vision": True})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "").strip()
    session_id = data.get("session_id") or str(uuid.uuid4())
    image_base64 = data.get("image_base64")

    # Vision: use Groq vision model to read math from image
    if image_base64:
        try:
            vision_response = vision_client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        },
                        {
                            "type": "text",
                            "text": "This is a child's math homework. Read the math problem(s) in this image exactly as written. Just output the math problem text, nothing else."
                        }
                    ]
                }],
                max_tokens=256
            )
            extracted = vision_response.choices[0].message.content.strip()
            if extracted:
                message = f"Help me with this problem from my homework: {extracted}" if not message else f"{message}\nFrom photo: {extracted}"
        except Exception as e:
            app.logger.warning(f"Vision failed: {e}")

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # RAG context if available
    rag_context = ""
    if session_id in vector_stores:
        try:
            docs = vector_stores[session_id].similarity_search(message, k=3)
            rag_context = "\n\n".join(d.page_content for d in docs)
        except Exception:
            pass

    system_content = SYSTEM_PROMPT
    if rag_context:
        system_content += f"\n\n--- Relevant content from child's textbook ---\n{rag_context}\n--- End ---\nUse the above textbook content to guide your explanation when relevant."

    # Check if first message (for title)
    existing = get_session_messages(session_id)
    title = message[:60] if not existing else None

    # Save user message first
    save_message(session_id, "user", message, title)

    # Call LLM with history
    history = build_history(session_id)
    messages_for_llm = [SystemMessage(content=system_content)] + history

    try:
        response = llm.invoke(messages_for_llm)
        reply = response.content
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)}"}), 500

    save_message(session_id, "assistant", reply)

    # Extract practice problem only when explicitly marked as "Practice Time!"
    practice_problem = None
    if "🎯 Practice Time!" in reply:
        parts = reply.split("🎯 Practice Time!", 1)
        if len(parts) > 1 and parts[1].strip():
            practice_problem = "🎯 Practice Time!\n" + parts[1].strip()

    return jsonify({
        "reply": reply,
        "session_id": session_id,
        "practice_problem": practice_problem,
    })


@app.route("/upload", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    session_id = request.form.get("session_id") or str(uuid.uuid4())
    path = os.path.join(UPLOAD_DIR, f"{session_id}.pdf")
    file.save(path)

    try:
        loader = PyPDFLoader(path)
        pages = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_documents(pages)
        store = FAISS.from_documents(chunks, get_embeddings())
        vector_stores[session_id] = store
        return jsonify({
            "message": f"Uploaded and indexed {len(chunks)} chunks from your textbook!",
            "session_id": session_id,
        })
    except Exception as e:
        return jsonify({"error": f"PDF processing failed: {str(e)}"}), 500
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.route("/photo", methods=["POST"])
def upload_photo():
    return jsonify({"error": "Use the chat endpoint with image_base64 instead."}), 400


@app.route("/history", methods=["GET"])
def get_history():
    db = get_db()
    rows = db.execute("""
        SELECT s.id as session_id, s.title, s.created_at, s.updated_at,
               COUNT(m.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 50
    """).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/history/<session_id>", methods=["GET"])
def get_session(session_id):
    msgs = get_session_messages(session_id)
    return jsonify({"messages": msgs})


@app.route("/history", methods=["DELETE"])
def delete_history():
    db = get_db()
    db.execute("DELETE FROM messages")
    db.execute("DELETE FROM sessions")
    db.commit()
    vector_stores.clear()
    return jsonify({"message": "All history cleared!"})


if __name__ == "__main__":
    init_db()
    print("MathBuddy backend started!")
    print("Database: SQLite (mathbuddy.db)")
    print("Running on http://localhost:5000")
    app.run(debug=True, port=5000)
