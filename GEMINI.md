# CaterNow SaaS: Comprehensive Project Documentation

## 🚀 Project Overview
CaterNow is a high-end AI-powered B2B/B2C SaaS platform for catering booking. It features a charming, sales-optimized AI agent ("Chatty") that guides users through a personalized menu creation process using Retrieval-Augmented Generation (RAG) and real-time research intelligence.

### Core Philosophy
- **Explainable AI (XAI):** Mathematical transparency for users via "AI Match %".
- **Continuous Learning:** The AI's vector database evolves based on customer feedback.
- **Sales Excellence:** Proactive upselling and personalized storytelling.

---

## 🛠 Tech Stack
- **Frontend:** React 18, Vite, React Router, Firebase Auth (Google Login).
- **Backend:** Python FastAPI, SQLAlchemy, Uvicorn.
- **AI/ML:** 
  - **Chat:** Google Gemini 1.5/2.5 Flash & Lite (Streaming enabled).
  - **Embeddings:** `models/gemini-embedding-001` (3072 dimensions).
- **Database:** Neon PostgreSQL with `pgvector` extension for high-performance similarity search.
- **Hosting:** Render.com (Web Service & Static Site).
- **Storage:** Firebase Storage for dish images.

---

## 🧠 Architectural Deep Dive

### 1. Vector Search & RAG Pipeline
- **Rich Context:** Dishes are vectorized not just by name, but by combining all CSV attributes (vegan, halal, business, etc.) into a "Rich Context String".
- **Batch Processing:** Initial seeding uses batch API calls to optimize quota and speed.
- **CSV Hashing:** The system calculates an MD5 hash of the `Gerichte_Cater_Now_02_26.csv` on startup. It only re-vectorizes if changes are detected.
- **Feedback Loop:** User feedback is appended to the `feedback_context` of a dish, triggering an automatic re-embedding. The AI "learns" what customers liked or disliked.

### 2. Research Intelligence ("Stalking Engine")
- **B2B Personalization:** Automatically researches a company via name/domain.
- **Extraction:** Gemini extracts core values, slogans, and brand colors.
- **Fancy Score:** A 1-100 score determines the bot's tone (Hip/Du vs. Traditional/Sie).

### 3. Long-Term Memory System
- **Lead Gehirn:** Every lead has a persistent `.md` file in `data/memory/`.
- **Live Sync:** Soft facts (mood, preferences) and hard facts (budget, date) are updated in real-time during the chat via a background thread.

---

## 🎨 UI/UX Features
- **Interactive Bento Grid:** Vertical menu layout (Appetizer -> Main 1 -> Dessert).
- **Alternative Selection:** Users can click `<` and `>` on bento cards to cycle through AI-suggested alternatives.
- **Forced Checkout:** Minimalist, focused checkout step with:
  - **AI Filled Badges:** Automatically researched addresses are marked.
  - **Personalized Storytelling:** A custom AI-generated greeting based on session memory.
- **Easter Egg:** A vibrant, animated Easter Egg success screen upon order completion.

---

## 📊 Caterer Studio (Admin Panel)
Access: `/admin` (Password: `caternow-god-mode`)
- **Dashboard:** Revenue tracking, order volume, and active lead count.
- **System Health:** Real-time status lights for Gemini API, Firebase, and Database.
- **Order Pipeline:** Full tracking of all incoming AI-generated bookings.
- **Menu Manager:** UI for price adjustments, feedback review, and Master-CSV upload.

---

## 🚀 Building and Running

### 1. Environment Setup
Create a `.env` file in the root directory (use `.env.example` as template):
```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_PROJECT_ID="..."
GEMINI_API_KEY="..."
DATABASE_URL="postgresql://..."
ADMIN_SECRET="caternow-god-mode"
```

### 2. Startup Commands
**Backend:**
```bash
cd backend && uvicorn main:app --reload
```
**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

### 3. Demo Scripts
- `python3 demo_vector_precision.py`: Displays a table showing the mathematical accuracy of the vector search.

---

## 🏢 Multi-Tenant Vision
The database schema is pre-configured with a `tenant_id` on all tables (`dishes`, `orders`, `users`, `feedbacks`). This allows for future scaling where multiple caterers can use the platform with their own custom domains and isolated datasets.
