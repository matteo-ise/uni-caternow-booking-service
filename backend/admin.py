import os
import json
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List
from pydantic import BaseModel

from database import get_db, SessionLocal
from db_models import DBOrder, DBFeedback, DBDish, DBMemory, DBUser, DBUserMemory, DBCheckout
from embeddings import load_and_embed_dishes, find_similar_dishes
from image_resolver import resolve_missing_images, get_image_status
from memory import get_research_sidecar

router = APIRouter()

# Ein einfaches Admin-Passwort aus der .env oder Fallback
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "caternow-admin")
MEMORY_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data", "memory"))
DATA_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data"))

class LeadSummary(BaseModel):
    id: str
    last_updated: float
    size: int

class MemoryUpdate(BaseModel):
    content: str

class OrderStatusUpdate(BaseModel):
    status: str

class UserMemoryUpdate(BaseModel):
    content: str

def verify_admin(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Zugriff verweigert: Ungültiger Admin-Token")
    return True

@router.post("/admin/rebuild-db")
async def trigger_rebuild_db(authenticated: bool = Depends(verify_admin)):
    """Triggert den kompletten Datenbank-Rebuild (Achtung: Löscht alle Daten!)."""
    from rebuild_db import rebuild
    try:
        rebuild()
        return {"status": "success", "message": "Datenbank wurde erfolgreich neu aufgebaut und 177 Gerichte geladen."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Rebuild: {str(e)}")

@router.get("/admin/leads", response_model=List[LeadSummary])
async def list_leads(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Listet alle Leads aus der Datenbank auf."""
    leads = []
    memories = db.query(DBMemory).order_by(DBMemory.updated_at.desc()).all()
    for mem in memories:
        leads.append(LeadSummary(
            id=mem.lead_id,
            last_updated=mem.updated_at.timestamp() if mem.updated_at else 0.0,
            size=len(mem.content) if mem.content else 0
        ))
    return leads
@router.get("/admin/memory/{lead_id}")
async def get_lead_memory(lead_id: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt den Inhalt der Memory für einen Lead zurück."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    return {"content": mem.content}

@router.put("/admin/memory/{lead_id}")
async def update_lead_memory(lead_id: str, data: MemoryUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Aktualisiert den Inhalt der Memory für einen Lead."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    mem.content = data.content
    db.commit()
    return {"status": "success", "message": "Memory aktualisiert"}

@router.get("/admin/orders")
async def get_all_orders(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    orders = db.query(DBOrder).order_by(DBOrder.created_at.desc()).all()
    return [{"id": o.id, "lead_id": o.lead_id, "status": o.status, "total_price": o.total_price, "created_at": o.created_at, "order_data": json.loads(o.order_data)} for o in orders]

@router.patch("/admin/orders/{order_id}")
async def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Aktualisiert den Status einer Bestellung."""
    order = db.query(DBOrder).filter(DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    order.status = data.status
    db.commit()
    return {"status": "success"}

@router.get("/admin/feedbacks")
async def get_all_feedbacks(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    feedbacks = db.query(DBFeedback).order_by(DBFeedback.created_at.desc()).all()
    result = []
    for fb in feedbacks:
        dish_name = None
        if fb.dish_id:
            dish = db.query(DBDish).filter(DBDish.id == fb.dish_id).first()
            if not dish:
                dish = db.query(DBDish).filter(DBDish.csv_id == fb.dish_id).first()
            if dish:
                dish_name = dish.name
        result.append({
            "id": fb.id,
            "rating": fb.rating,
            "comment": fb.comment,
            "is_general": fb.is_general,
            "created_at": fb.created_at,
            "dish_name": dish_name
        })
    return result

@router.get("/admin/dishes")
async def get_all_dishes(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    dishes = db.query(DBDish).all()
    return [{"id": d.id, "name": d.name, "kategorie": d.kategorie, "preis": d.preis, "feedback_context": d.feedback_context} for d in dishes]

@router.get("/admin/vector-benchmark")
async def vector_benchmark(query: str, authenticated: bool = Depends(verify_admin)):
    """Fuehrt eine Vector-Suche durch und gibt detaillierte Ergebnisse zurueck."""
    try:
        results = find_similar_dishes(query, top_k=8)
        return {
            "query": query,
            "model": "gemini-embedding-001",
            "dimensions": 3072,
            "threshold": 0.25,
            "results": [
                {
                    "name": d.name,
                    "kategorie": d.kategorie,
                    "preis": d.preis,
                    "similarity_score": round(d.similarity_score, 4),
                    "image_url": d.image_url,
                    "feedback_context": getattr(d, "feedback_context", "") or "",
                }
                for d in results
            ],
        }
    except Exception as e:
        return {"query": query, "error": str(e), "results": []}

@router.get("/admin/lead-details/{lead_id}")
async def get_lead_details(lead_id: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt Memory + Sidecar-Daten fuer einen Lead zurueck."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")
    sidecar = get_research_sidecar(lead_id)
    return {
        "lead_id": lead_id,
        "content": mem.content,
        "sidecar": sidecar,
        "updated_at": mem.updated_at,
    }

@router.get("/admin/users")
async def get_users(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Listet alle registrierten User (Firebase-Accounts) auf."""
    users = db.query(DBUser).order_by(DBUser.created_at.desc()).all()
    return [
        {"id": u.id, "firebase_uid": u.firebase_uid, "email": u.email, "name": u.name, "created_at": u.created_at}
        for u in users
    ]


@router.get("/admin/user-memory/{firebase_uid}")
async def get_user_memory(firebase_uid: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt das persistente KI-Profil eines Users zurück."""
    mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()
    if not mem:
        return {"content": "", "updated_at": None}
    return {"content": mem.content or "", "updated_at": mem.updated_at}


@router.put("/admin/user-memory/{firebase_uid}")
async def update_user_memory(firebase_uid: str, data: UserMemoryUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Setzt das persistente KI-Profil eines Users (erstellt oder überschreibt)."""
    mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()
    if mem:
        mem.content = data.content
    else:
        mem = DBUserMemory(firebase_uid=firebase_uid, content=data.content)
        db.add(mem)
    db.commit()
    return {"status": "success"}


@router.get("/admin/orders-overview")
async def get_orders_overview(date: str = None, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt alle Checkouts mit Bestellstatus, Sidecar-Daten und Menü zurück — für den Overview-Tab."""
    checkouts = db.query(DBCheckout).order_by(DBCheckout.created_at.desc()).all()
    result = []
    for c in checkouts:
        # Optional date filter (YYYY-MM-DD)
        if date and c.created_at:
            if c.created_at.strftime("%Y-%m-%d") != date:
                continue

        # Find the most recent matching order
        order = (
            db.query(DBOrder)
            .filter(DBOrder.lead_id == c.lead_id)
            .order_by(DBOrder.created_at.desc())
            .first()
        )

        try:
            menu = json.loads(c.menu) if c.menu else {}
        except Exception:
            menu = {}
        try:
            wizard = json.loads(c.wizard_data) if c.wizard_data else {}
        except Exception:
            wizard = {}
        try:
            services = json.loads(c.selected_services) if c.selected_services else []
        except Exception:
            services = []

        sidecar = get_research_sidecar(c.lead_id)

        result.append({
            "checkout_id": c.checkout_id,
            "lead_id": c.lead_id,
            "created_at": c.created_at,
            "menu": menu,
            "wizard_data": wizard,
            "total_price": order.total_price if order else None,
            "status": order.status if order else "kein_auftrag",
            "order_id": order.id if order else None,
            "sidecar": sidecar,
            "custom_wish": c.custom_wish,
            "selected_services": services,
        })

    return result


@router.get("/admin/image-status")
async def image_status(authenticated: bool = Depends(verify_admin)):
    """Returns overview of dish image resolution status."""
    return get_image_status()


@router.post("/admin/resolve-images")
async def trigger_resolve_images(authenticated: bool = Depends(verify_admin)):
    """Manually triggers background image resolution for dishes without images."""
    import asyncio
    asyncio.create_task(resolve_missing_images())
    status = get_image_status()
    return {"status": "started", "missing": status["missing"], "message": f"Resolving {status['missing']} missing images in background"}


@router.post("/admin/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    file_location = DATA_DIR / "Gerichte_Cater_Now_02_26.csv"
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())
    
    # Optional: trigger re-embedding process here
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}
