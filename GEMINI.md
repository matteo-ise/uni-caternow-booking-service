# CaterNow SaaS: Comprehensive Project Documentation

## 🚀 Project Overview
CaterNow is a high-end AI-powered B2B/B2C SaaS platform for catering booking. It features a charming, sales-optimized AI agent ("Chatty") that guides users through a personalized menu creation process using Retrieval-Augmented Generation (RAG) and real-time research intelligence.

### Core Philosophy
- **Explainable AI (XAI):** Mathematical transparency for users via "AI Match %".
- **Continuous Learning:** The AI's vector database evolves based on customer feedback (Dish-specific and general).
- **Sales Excellence:** Proactive upselling, quantity optimization, and personalized storytelling.
- **Privacy & Logic:** Stalker-level intelligence gathering for sales optimization within a structured Markdown dossier.

---

## 🛠 Tech Stack
- **Frontend:** React 18, Vite, React Router, Firebase Auth (Google Login), Recharts.
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn, Python-Multipart.
- **AI/ML:** 
  - **Chat & Research:** Google Gemini 3.1 Flash Lite Preview (v1beta compatible).
  - **Embeddings:** `models/gemini-embedding-001` (3072 dimensions).
- **Database:** Neon PostgreSQL with `pgvector` extension.
- **Hosting:** Render.com (Backend Web Service & Frontend Static Site).
- **Assets:** High-quality product photos (.jpeg) linked by Dish-ID.

---

## 🧠 Architectural Deep Dive

### 1. Vector Search & Hybrid RAG
- **Rich Context:** Dishes are vectorized using "Rich Context" (Name + Category + CSV attributes).
- **Hybrid Search:** Optimized `find_similar_dishes` in `embeddings.py` uses Vector Similarity first, with a Fuzzy-String-Matching fallback (using `difflib`) to ensure the chat never "breaks" even if the AI API is slow.
- **Transactional Safety:** Automatic rollbacks prevent database session locks during search failures.

### 2. Research Intelligence ("Stalking Engine")
- **B2B Personalization:** Automatically researches companies via domain/name to extract values, colors, and logos.
- **HQ Extraction:** Real-time extraction of official headquarters addresses for automated checkout filling with a visual "AI Glow" animation.
- **Grounding:** Google Search integration updated to the newest `google_search` tool standard.

### 3. Long-Term Memory System
- **Lead Intelligence Reports:** Persistent `.md` files in `data/memory/` track mood, preferences, and "Findings".
- **Manual Intervention:** Admins can now manually edit these memory files through the Admin Studio to inject human intelligence into the AI's context.

---

## 🎨 UI/UX Features
- **Modern Chat UI:** Animated burger menu, sleek "Chip" selection for services, and pulsing interaction buttons.
- **Visual Feedback:** "AI Match %" and "AI Filled" badges for mathematical transparency and convenience.
- **Easter Egg:** Animated "Happy Easter" success screen upon completion.
- **Responsive:** 100% mobile-first with a slide-down mobile navigation.

---

## 📊 Caterer Studio (Admin Panel)
Access: `/admin` (Password protected via `VITE_ADMIN_SECRET` / `ADMIN_SECRET`)
- **Dashboard:** Interactive `recharts` bar charts showing revenue trends and system health monitors.
- **CRM Pipeline:** Manage orders with a status-dropdown (Neu, In Bearbeitung, Abgeschlossen, Storniert).
- **AI Memory Editor:** Direct textarea access to modify Lead dossiers.
- **Danger Zone:** One-click "Database Rebuild" to sync schemas and re-seed 177+ vectorized dishes.
- **Menu Manager:** View dish prices and AI feedback context.

---

## 🏢 Multi-Tenant & Scaling
The system uses a `tenant_id` pattern across all tables (`dishes`, `orders`, `users`, `feedbacks`). 
- **Image Handling:** Product photos are stored in `frontend/public/images/dishes/{id}.jpeg`. 
- **Seeding:** `backend/rebuild_db.py` handles the full lifecycle of schema creation, extension enabling (`pgvector`), and data ingestion.
