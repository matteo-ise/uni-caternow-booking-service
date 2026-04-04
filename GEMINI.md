# CaterNow Booking Service

## Project Overview

CaterNow is a web application designed as a booking service for a catering company, featuring an AI-powered chatbot wizard. This is a university project structured with a modern tech stack focused on conversational UI and Retrieval-Augmented Generation (RAG).

**Architecture:**
*   **Frontend (`/frontend`):** A React Single Page Application (SPA) built with Vite. It provides a 4-step interactive booking wizard and chat interface. It integrates **Firebase Authentication** for user login.
*   **Backend (`/backend`):** A Python application powered by **FastAPI**. It handles API requests, user authentication validation (via Firebase Admin), and the core chat logic.
*   **AI Integration:** The backend deeply integrates the **Gemini API** (Pro for chat generation, Embeddings for vectorizing the catering menu). 
*   **Database:** Uses **Neon Database (PostgreSQL)** with the `pgvector` extension (via SQLAlchemy) to store menu items and perform similarity searches for the chatbot.
*   **Deployment:** The project is configured for deployment on **Render.com**, with a unified `render.yaml` orchestrating both frontend (static site) and backend (web service) deployments.

## Building and Running

### Prerequisites
*   Node.js (v20.x recommended)
*   Python (3.11+ recommended)
*   API Keys: Gemini API Key, Firebase Project Config, Neon Database URL.

### Frontend
To run the frontend locally:
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Set up environment variables (`VITE_FIREBASE_API_KEY`, etc.) in a `.env` file.
4. Start the development server: `npm run dev`

### Backend
To run the backend locally:
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Set up environment variables (`GEMINI_API_KEY`, `DATABASE_URL`) in a `.env` file. If `DATABASE_URL` is omitted, it falls back to a local SQLite database for basic testing.
4. Start the FastAPI server: `uvicorn main:app --reload` (or `python -m uvicorn main:app --reload`)

## Development Conventions

*   **Environment Variables:** The project heavily relies on environment variables for sensitive keys and deployment configurations. Ensure `.env` files are not committed to source control (check `.gitignore`).
*   **UI Reference:** There is a `/design-reference` folder containing complex React components (Bento boxes, Accordions) that act as a blueprint for the main frontend application's design system.
*   **Data Handling:** The `/data` directory contains raw CSV/Excel files representing the catering menu. The backend includes a pipeline (in `embeddings.py`) to parse these, vectorize them using Gemini Embeddings, and load them into the vector database on startup.
*   **API Structure:** The backend exposes RESTful endpoints under the `/api` prefix (e.g., `/api/chat`).
