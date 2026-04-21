import os
import sys

# Environment Check
if not os.environ.get("DATABASE_URL") and not os.path.exists(".env"):
    print("[CRITICAL] DATABASE_URL is missing.")

if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY") and not os.path.exists(".env"):
    print("[CRITICAL] GEMINI_API_KEY is missing.")

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
import logging

import json
from datetime import datetime, timezone

from database import init_db, get_db, SessionLocal
from db_models import DBUser, DBSyncState, DBDish, DBOrder, DBMemory
from embeddings import load_and_embed_dishes, DATA_PATH
from image_resolver import resolve_missing_images
from sync_logic import get_file_hash
from chat import router as chat_router
from admin import router as admin_router
from orders import router as orders_router
from checkouts import router as checkouts_router
from auth import get_current_user

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CaterNow-Main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    async def fast_sync():
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
                force_sync = True
                sync_state.csv_hash = current_hash
            db.commit()
            
            dish_count = db.query(DBDish).count()
            if force_sync or dish_count == 0:
                await load_and_embed_dishes(force_refresh=force_sync)
            # Resolve missing dish images in background (non-blocking)
            asyncio.create_task(resolve_missing_images())
            logger.info("Application startup complete.")
        except Exception as e:
            logger.error(f"Sync Error: {e}")
        finally:
            db.close()

    import asyncio
    asyncio.create_task(fast_sync())
    yield

app = FastAPI(title="CaterNow Chatbot API", lifespan=lifespan)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
origins = [
    "http://localhost:5173", 
    "http://localhost:3000", 
    FRONTEND_URL, 
    "https://caternow.onrender.com", 
    "https://uni-caternow-booking-service.onrender.com", 
    "https://caternow-frontend-prod.onrender.com"
]

app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(checkouts_router, prefix="/api")

@app.post("/api/users/sync")
async def sync_user(decoded_token: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    name = decoded_token.get("name", "")
    
    # 1. Suche nach UID
    user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
    
    # 2. Falls nicht gefunden, suche nach Email (verhindert UniqueViolation)
    if not user and email:
        user = db.query(DBUser).filter(DBUser.email == email).first()
        if user:
            user.firebase_uid = uid # Update UID falls sie sich geändert hat
            db.commit()

    now = datetime.now(timezone.utc)

    if not user:
        user = DBUser(
            firebase_uid=uid, email=email, name=name,
            first_login_at=now, last_login_at=now, login_count=1,
            login_history=json.dumps([now.isoformat()]),
        )
        db.add(user)
        try:
            db.commit()
        except:
            db.rollback()
            user = db.query(DBUser).filter(DBUser.email == email).first()

        db.refresh(user)
        _update_user_aggregates(db, user)
        return {"status": "created", "user_id": user.id}
    else:
        if user.name != name:
            user.name = name
        user.last_login_at = now
        user.login_count = (user.login_count or 0) + 1
        history = []
        if user.login_history:
            try:
                history = json.loads(user.login_history)
            except Exception:
                history = []
        history.append(now.isoformat())
        user.login_history = json.dumps(history[-100:])  # keep last 100
        _update_user_aggregates(db, user)
        db.commit()
        return {"status": "exists", "user_id": user.id}


def _update_user_aggregates(db: Session, user: DBUser):
    """Recompute total_orders, total_spent, associated_companies from DB."""
    from sqlalchemy import func as sqlfunc
    order_stats = db.query(
        sqlfunc.count(DBOrder.id),
        sqlfunc.coalesce(sqlfunc.sum(DBOrder.total_price), 0.0)
    ).filter(DBOrder.user_id == user.id).first()
    user.total_orders = order_stats[0] if order_stats else 0
    user.total_spent = float(order_stats[1]) if order_stats else 0.0

    companies = set()
    if user.name:
        memories = db.query(DBMemory).all()
        for mem in memories:
            if user.name.lower() in (mem.lead_id or "").lower():
                if mem.sidecar_data:
                    try:
                        sc = json.loads(mem.sidecar_data)
                        if sc.get("company_name"):
                            companies.add(sc["company_name"])
                    except Exception:
                        pass
    user.associated_companies = json.dumps(list(companies), ensure_ascii=False) if companies else None

@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    return {"status": "ok", "database": "connected", "sync_state": "synchronized", "message": "Application startup complete."}
