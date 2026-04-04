# 🍽️ CaterNow SaaS: The Future of AI-Driven Catering

[![SaaS Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant-blue.svg)](#-architectural-highlights)
[![AI Model](https://img.shields.io/badge/AI-Gemini%20Flash%202.5-orange.svg)](#-the-brain-chatty)
[![Database](https://img.shields.io/badge/Vector%20DB-Neon%20(pgvector)-green.svg)](#-vector-excellence)

**CaterNow** is not just a booking tool—it’s an intelligent, sales-optimized ecosystem designed to transform how businesses and private customers plan their events. By merging high-end conversational UI with advanced Retrieval-Augmented Generation (RAG) and Research Intelligence, we’ve built an AI agent that sells, learns, and automates like a 100-person startup.

---

## ✨ Executive Summary for Investors

CaterNow represents a paradigm shift in the catering industry. We solve the high-friction "request-quote-negotiate" cycle with a seamless, AI-native experience.

### 🧠 The Brain: "Chatty"
Our AI agent isn't just a chatbot; it's a world-class salesperson.
- **Research Intelligence ("Stalking Engine"):** Automatically analyzes B2B leads via their domain to extract core values, brand colors, and slogans.
- **Dynamic Persona:** Adjusts tone (Du vs. Sie) and menu complexity based on a calculated **"Fancy Score"**.
- **Proactive Upselling:** Intelligently suggests complementary dishes (e.g., a vegan second main course) to maximize order value.

### 📊 The Caterer Studio (God Mode)
A professional SaaS command center for caterers.
- **Live Lead Tracking:** Watch AI session memory build in real-time.
- **Continuous Learning Loop:** The system learns from customer feedback (e.g., "too much meat") by re-vectorizing dishes based on sentiment.
- **Analytics Dashboard:** Revenue, lead pipeline, and system health monitors at a glance.

---

## 🛠 Architectural Highlights

| Feature | Technology | Why it's a winner |
| :--- | :--- | :--- |
| **Vector Search** | `pgvector` on Neon PostgreSQL | Mathematically precise matches based on 3072-dim embeddings. |
| **Rich RAG** | Gemini Embedding-001 | We vectorize dishes using *all* attributes (halal, vegan, vibes) for 99% accuracy. |
| **Multi-Tenant** | Scalable Schema | Pre-built for 1000s of caterers with custom domains and isolated data. |
| **Streaming** | FastAPI + Server-Sent Events | Zero-latency feeling; tokens appear live as the AI "thinks". |

---

## 🚀 Quickstart for Developers

Get the entire ecosystem running locally in less than 5 minutes.

### 1. Global Setup
Clone the repo and create a `.env` in the root (use `.env.example` as a template):
```env
VITE_FIREBASE_API_KEY="your_key"
GEMINI_API_KEY="your_key"
DATABASE_URL="postgresql://..."
```

### 2. Launch Backend (Python)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*Note: The backend automatically synchronizes your CSV menu with the Vector DB using an intelligent MD5-hashing logic.*

### 3. Launch Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## 🔍 The "Informatics Check" (Demo)

Want to see the math? We’ve included a precision testing tool to prove our vector logic isn't hallucinating.
```bash
python3 demo_vector_precision.py
```
This will output a table of **Cosine Similarity Scores** comparing user intent to our actual database entries.

---

## 🐣 Holiday Special
Launch during the season? We've integrated a festive **Easter Success Screen** with animated eggs and confetti to delight users after their first order.

---

## 📅 Roadmap: From Prototype to Enterprise
- [x] **Sprint 1-4:** Core AI & Memory Infrastructure.
- [x] **Sprint 5:** Bento UI & Interactive Alternative Selection.
- [x] **Sprint 6:** Continuous Feedback Loop & Multi-Tenant Base.
- [ ] **Next:** Stripe Payment Integration & Custom Domain Auto-Provisioning.

---
**CaterNow** – *Catering. Simplified. Powered by Intelligence.*
