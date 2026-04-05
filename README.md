# 🍽️ CaterNow SaaS: The Future of AI-Driven Catering

[![SaaS Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant-blue.svg)](#-multi-tenant-saas)
[![AI Model](https://img.shields.io/badge/AI-Gemini%20Flash%20Lite-orange.svg)](#-the-brain-chatty)
[![Database](https://img.shields.io/badge/Vector%20DB-Neon%20(pgvector)-green.svg)](#-vector-search--rag)

**CaterNow** is an intelligent, sales-optimized ecosystem designed to transform how businesses and private customers plan their events. By merging a high-end conversational UI with advanced RAG, real-time research intelligence, and a professional caterer dashboard, we’ve built a production-ready SaaS platform.

---

## ✨ Executive Summary for Investors

### 🧠 The Brain: "CaterNow Chat"
Our AI agent is a world-class salesperson.
- **Research Intelligence:** Automatically analyzes B2B leads via their domain to extract values and headquarters addresses.
- **Explainable AI (XAI):** Displays a mathematical "AI Match %" for every recommendation to build user trust.
- **Proactive Upselling:** Intelligently suggests second main courses and add-ons to maximize AOV (Average Order Value).

### 📊 The Caterer Studio (Admin 2.0)
A professional command center for caterers.
- **Continuous Learning:** The AI learns from customer feedback. When a user rates a dish, the system re-vectorizes it based on the review.
- **Live Lead Memory:** Watch lead profiles and preferences build in real-time as they chat.
- **System Health:** Integrated monitors for Gemini API, Firebase, and Database status.

---

## 🛠 Architectural Highlights

| Feature | Technology | Why it's a winner |
| :--- | :--- | :--- |
| **Vector Search** | `pgvector` on Neon | 3072-dim embeddings for mathematically precise dish matching. |
| **Incremental Sync** | Batch Processing | Smart seeding that handles API quotas and resumes after restarts. |
| **Multi-Tenant** | Scalable Schema | Pre-built for 1000s of caterers with isolated data environments. |
| **Apple CI Design** | Modern UI/UX | Clean onboarding cards, Bento Grids, and smooth transitions. |

---

## 🚀 Quickstart for Developers

### 1. Requirements
- Python 3.11.9
- Node.js 20.x
- Firebase Account + Neon.tech DB

### 2. Launch Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*The backend includes an automatic CSV-to-Vector sync with MD5 change detection.*

### 3. Launch Frontend
```bash
cd frontend
npm install && npm run dev
```

---

## 🔍 The "Informatics Check" (Demo)
Prove the mathematical accuracy of the AI with our precision tool:
```bash
python3 demo_vector_precision.py
```

---

## 🏢 Multi-Tenant Vision
CaterNow is architected for scale. Every order and dish is linked to a `tenant_id`, enabling white-label deployments for various catering companies on their own subdomains.

---
**CaterNow** – *Catering. Simplified. Powered by Intelligence.*
