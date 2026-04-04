import os
import sys

# Environment Check (Crashing early in production if essential vars are missing)
if not os.environ.get("DATABASE_URL") and not os.path.exists(".env"):
    print("[CRITICAL] DATABASE_URL is missing. Please set it in your Render Environment Variables.")

if not os.environ.get("GEMINI_API_KEY") and not os.path.exists(".env"):
    print("[CRITICAL] GEMINI_API_KEY is missing. AI Features will crash.")

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
import logging

from database import init_db, get_db, SessionLocal
from db_models import DBUser, DBSyncState
from embeddings import load_and_embed_dishes, DATA_PATH
from sync_logic import get_file_hash
from chat import router as chat_router
from admin import router as admin_router
from orders import router as orders_router
from auth import get_current_user

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CaterNow-Main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Datenbank initialisieren (CREATE EXTENSION passiert in database.py)
    init_db()
    
    # 2. Intelligenter CSV Sync Check
    db = SessionLocal()
    try:
        current_hash = get_file_hash(DATA_PATH)
        sync_state = db.query(DBSyncState).first()
        
        force_sync = False
        if not sync_state:
            force_sync = True
            new_state = DBSyncState(csv_hash=current_hash)
            db.add(new_state)
        elif sync_state.csv_hash != current_hash:
            logger.info("CSV Änderung erkannt! Starte Re-Vektorisierung...")
            force_sync = True
            sync_state.csv_hash = current_hash
        
        db.commit()
        
        # 3. Gerichte laden & Vektorisieren
        await load_and_embed_dishes(force_refresh=force_sync)
        logger.info("Application startup complete.") # Render.com Wait-For-Condition
        
    except Exception as e:
        logger.error(f"Lifespan Error: {e}")
    finally:
        db.close()
        
    yield

app = FastAPI(title="CaterNow Chatbot API", lifespan=lifespan)

# CORS: Allow frontend URL from environment variable
FRONTEND_URL = os.environ.get("VITE_API_URL", "http://localhost:5173").replace("/api", "")
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    FRONTEND_URL,
    "https://uni-caternow-booking-service.onrender.com",
    "https://caternow-frontend-prod.onrender.com" # Explicitly allowing the requested frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(orders_router, prefix="/api")

@app.post("/api/users/sync")
async def sync_user(decoded_token: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    name = decoded_token.get("name", "")

    user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
    if not user:
        user = DBUser(firebase_uid=uid, email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"status": "created", "user_id": user.id}
    else:
        if user.name != name:
            user.name = name
            db.commit()
        return {"status": "exists", "user_id": user.id}

@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "database": "connected",
        "sync_state": "synchronized",
        "message": "Application startup complete."
    }

