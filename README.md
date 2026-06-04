# MathBuddy — AI Math Tutor

![Angular](https://img.shields.io/badge/Angular-17+-red?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.10-blue?style=flat-square)
![LangChain](https://img.shields.io/badge/LangChain-RAG-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

An AI-powered math tutoring platform for students. Uses a full RAG (Retrieval-Augmented Generation) pipeline — PDF content is chunked, embedded into a FAISS vector store, and semantically retrieved to inject relevant context into LLM prompts — delivering accurate, grounded answers instead of hallucinated ones.

> Live demo: [mathbuddy.pages.dev](https://mathbuddy.pages.dev) · Frontend on Cloudflare Pages · Backend on Render

---

## Features

- **AI-powered tutoring chat** — Conversational interface powered by OpenAI + LangChain
- **RAG pipeline** — PDF content chunked → FAISS vector store → semantic retrieval → context-injected LLM response
- **PDF upload** — Upload math textbooks or problem sets; the system indexes and retrieves relevant sections automatically
- **Image input** — Submit photos of handwritten problems or diagrams
- **Chat history** — Full conversation memory stored in PostgreSQL
- **Prompt engineering** — Carefully crafted system prompts tuned for step-by-step math explanation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 17+, Angular Material |
| Backend | Python, Flask |
| LLM | OpenAI GPT-4 |
| RAG Framework | LangChain |
| Vector Store | FAISS |
| Embeddings | OpenAI text-embedding-ada-002 |
| Database | PostgreSQL |
| Frontend Deploy | Cloudflare Pages |
| Backend Deploy | Render |

---

## How It Works — RAG Pipeline

```
User uploads PDF
      ↓
Text extracted and split into chunks (LangChain TextSplitter)
      ↓
Each chunk embedded via OpenAI Embeddings
      ↓
Embeddings stored in FAISS vector index
      ↓
User asks a question
      ↓
Question embedded → top-k semantically similar chunks retrieved from FAISS
      ↓
Retrieved chunks injected as context into LLM prompt (LangChain)
      ↓
OpenAI GPT-4 generates a grounded, step-by-step explanation
      ↓
Response streamed to Angular frontend + saved to PostgreSQL
```

This approach eliminates hallucination for curriculum-specific content — the model only answers from what's in the uploaded material.

---

## Project Structure

```
mathbuddy/
├── backend/
│   ├── app.py                  # Flask API (chat, upload, history)
│   ├── rag/
│   │   ├── embedder.py         # PDF chunking + FAISS indexing
│   │   ├── retriever.py        # Semantic search over FAISS store
│   │   └── chain.py            # LangChain prompt + LLM chain
│   ├── db/
│   │   └── history.py          # PostgreSQL chat history
│   ├── requirements.txt
│   └── .env                    # API keys (not committed)
├── src/
│   └── app/                    # Angular application
├── angular.json
└── netlify.toml
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /chat | Send a message, get an AI response |
| POST | /upload | Upload a PDF for RAG indexing |
| GET | /history | Retrieve past chat messages |
| GET | /health | Health check |

---

## Setup & Run

### 1. Clone the repo

```bash
git clone https://github.com/Taaheer1106/Mathbuddy.git
cd Mathbuddy
```

### 2. Set up the backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file:

```
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/mathbuddy_db
```

### 3. Start the Flask backend

```bash
python app.py
```

API runs on http://localhost:5000

### 4. Set up the Angular frontend

```bash
npm install
ng serve
```

App runs on http://localhost:4200

### Building for production

```bash
ng build
```

Build artifacts stored in `dist/mathbuddy/browser/`
