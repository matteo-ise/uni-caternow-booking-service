# CaterNow SaaS: Comprehensive Project Documentation

## 🚀 Project Overview
CaterNow is a high-end AI-powered B2B/B2C SaaS platform for catering booking. It features a charming, sales-optimized AI agent ("CaterNow Chat") that guides users through a personalized menu creation process using Retrieval-Augmented Generation (RAG) and real-time research intelligence.

### Core Philosophy
- **Explainable AI (XAI):** Mathematical transparency for users via "AI Match %".
- **Continuous Learning:** The AI's vector database evolves based on customer feedback (Dish-specific and general).
- **Sales Excellence:** Proactive upselling, quantity optimization, and personalized storytelling.
- **Privacy & Logic:** Stalker-level intelligence gathering for sales optimization within a structured Markdown dossier.

---

## 🛠 Tech Stack
- **Frontend:** React 18, Vite, React Router, Firebase Auth (Google Login).
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn, Python-Multipart.
- **AI/ML:** 
  - **Chat & Research:** Google Gemini 1.5 Flash (Streaming enabled, Search Grounding active).
  - **Embeddings:** `models/gemini-embedding-001` (3072 dimensions).
- **Database:** Neon PostgreSQL with `pgvector` extension.
- **Hosting:** Render.com (Backend Web Service & Frontend Static Site).
- **Storage:** Local images with 3-level fallback (Local -> Unsplash -> SVG Mockup).

---

## 🧠 Architectural Deep Dive

### 1. Vector Search & RAG Pipeline (Rich Context)
- **Enhanced Context:** Dishes are vectorized using "Rich Context" (Name + Category + all CSV attributes like vegan, spiciness, etc.) into a descriptive string.
- **Search Grounding:** Integrated Google Search for real-time company research, capped at 500 requests/day for cost control.
- **Incremental Sync:** MD5 hash detection ensures the DB is only updated when the Master-CSV actually changes.

### 2. Research Intelligence ("Stalking Engine")
- **B2B Personalization:** Automatically researches companies via domain/name to extract values, colors, and logos.
- **HQ Extraction:** Real-time extraction of official headquarters addresses for automated checkout filling.
- **Psychographic Profiling:** Analyzes chat sentiment, buy-intent, and corporate alignment in real-time.

### 3. Long-Term Memory System
- **Lead Intelligence Reports:** Persistent `.md` files track mood, preferences, and "Findings" in a secretive dossier format.
- **Session Continuity:** The AI reads existing memory files upon chat start to recognize returning customers.

---

## 🎨 UI/UX Features (Sprint 7 Ready)
- **High-End Chat UI:** Symmetric chat layout with circular avatars (Favicon for bot, Google Profile for user) and brand-purple accents.
- **Dynamic Input Positioning:** Input area starts centered for focus and drops to bottom once interaction begins.
- **Responsive Design:** 100% mobile-first layout. Bento Grid stacks on mobile, Full-screen chat modal.
- **Interactive Feedback:** Pulsing send-button and horizontal hotkey-slider for intuitive wish description.
- **Easter Egg:** Animated "Happy Easter" success screen upon completion.

---

## 📊 Caterer Studio (Admin Panel)
Access: `/admin` (Password protected, persisted via LocalStorage)
- **Analytics:** Revenue tracking, order pipeline, and system health monitors.
- **Lead Monitoring:** Direct access to "Stalker Engine" dossiers for every potential customer.
- **Menu Manager:** UI for managing prices and reviewing AI feedback context.

---

## 🏢 Multi-Tenant SaaS
The database is fully multi-tenant ready. Every entry (`dishes`, `orders`, `users`, `feedbacks`) contains a `tenant_id`, allowing the platform to scale to multiple caterers with isolated data and custom domains.
