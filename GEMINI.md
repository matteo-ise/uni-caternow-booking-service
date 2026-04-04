# CaterNow SaaS: Comprehensive Project Documentation

## 🚀 Project Overview
CaterNow is a high-end AI-powered B2B/B2C SaaS platform for catering booking. It features a charming, sales-optimized AI agent ("Chatty") that guides users through a personalized menu creation process using Retrieval-Augmented Generation (RAG) and real-time research intelligence.

### Core Philosophy
- **Explainable AI (XAI):** Mathematical transparency for users via "AI Match %".
- **Continuous Learning:** The AI's vector database evolves based on customer feedback.
- **Sales Excellence:** Proactive upselling, quantity optimization, and personalized storytelling.

---

## 🛠 Tech Stack
- **Frontend:** React 18, Vite, React Router, Firebase Auth (Google Login).
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn, Python-Multipart.
- **AI/ML:** 
  - **Chat:** Google Gemini 1.5/2.5 Flash & Lite (Streaming enabled).
  - **Embeddings:** `models/gemini-embedding-001` (3072 dimensions).
- **Database:** Neon PostgreSQL with `pgvector` extension.
- **Hosting:** Render.com (Web Service & Static Site).
- **Storage:** Firebase Storage for automated dish image mapping.

---

## 🧠 Architectural Deep Dive

### 1. Vector Search & RAG Pipeline
- **Rich Context:** Dishes are vectorized by combining all CSV attributes (vegan, halal, high-class, etc.) into a single context string.
- **Incremental Sync:** The backend tracks `csv_id` and saves progress in batches of 10. If API limits are reached, it resumes exactly where it left off on the next restart.
- **CSV Hashing:** MD5 hash detection ensures the DB is only updated when the Master-CSV actually changes.
- **Continuous Feedback Loop:** User comments trigger immediate background re-embedding of specific dishes.

### 2. Research Intelligence ("Stalking Engine")
- **B2B Personalization:** Automatically researches companies via domain to extract values and colors.
- **HQ Extraction:** Predicts/Researches headquarter addresses for automated checkout filling.
- **Fancy Score:** Determines the bot's persona (Modern/Du vs. Traditional/Sie).

### 3. Long-Term Memory System
- **Lead History:** Persistent `.md` files track mood, preferences, and hard facts live.
- **Session Continuity:** The AI reads existing memory files upon chat start to recognize returning customers.

---

## 🎨 UI/UX Features
- **Apple-Inspired Onboarding:** Visual event selection cards with Unsplash imagery and smooth animations.
- **Interactive Bento Grid:** Vertical menu layout with `<` and `>` navigation for AI-suggested alternatives.
- **Smart Checkout:** 
  - **Automatic Quantity Splitting:** 50/50 split for dual mains, 100% for starters/desserts.
  - **Pro-Kalkulation:** Live calculation of subtotal, 19% VAT, and delivery/setup fees.
  - **AI Storytelling:** A generated personal menu-story displayed before final submission.
- **Easter Egg:** Animated Easter Egg success screen upon completion.

---

## 📊 Caterer Studio (Admin Panel)
Access: `/admin` (Password: `caternow-god-mode`, persisted via LocalStorage)
- **Analytics:** Revenue tracking, order pipeline, and system health monitors.
- **System Status:** Real-time connectivity checks for Gemini API, Firebase, and Neon DB.
- **Menu Manager:** UI for managing prices, reviewing AI feedback context, and CSV uploads.

---

## 🏢 Multi-Tenant SaaS
The database is fully multi-tenant ready. Every entry (`dishes`, `orders`, `users`, `feedbacks`) contains a `tenant_id`, allowing the platform to scale to multiple caterers with isolated data and custom domains.
