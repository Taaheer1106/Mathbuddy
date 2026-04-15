# MathBuddy

MathBuddy is an AI-powered math tutor for kids. It uses a conversational chat interface to help students understand math concepts, solve problems, and learn step by step.

## Features

- AI-powered math tutoring chat
- PDF upload support for math problems
- Chat history
- Image input support

## Tech Stack

- **Frontend:** Angular 17+, Angular Material
- **Backend:** Python (Flask), hosted on Render
- **Deployment:** Cloudflare Pages (frontend), Render (backend)

## Development

### Frontend

```bash
npm install
ng serve
```

Open your browser and navigate to `http://localhost:4200/`.

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

## Building

```bash
ng build
```

Build artifacts will be stored in the `dist/mathbuddy/browser/` directory.
