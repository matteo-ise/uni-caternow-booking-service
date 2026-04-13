import os
import json
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List
from pydantic import BaseModel

from database import get_db, SessionLocal
from db_models import DBOrder, DBFeedback, DBDish, DBMemory
from embeddings import load_and_embed_dishes

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
    feedbacks = db.query(DBFeedback, DBDish).outerjoin(DBDish, DBFeedback.dish_id == DBDish.id).order_by(DBFeedback.created_at.desc()).all()
    result = []
    for fb, dish in feedbacks:
        result.append({
            "id": fb.id,
            "rating": fb.rating,
            "comment": fb.comment,
            "is_general": fb.is_general,
            "created_at": fb.created_at,
            "dish_name": dish.name if dish else None
        })
    return result

@router.get("/admin/dishes")
async def get_all_dishes(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    dishes = db.query(DBDish).all()
    return [{"id": d.id, "name": d.name, "kategorie": d.kategorie, "preis": d.preis, "feedback_context": d.feedback_context} for d in dishes]

@router.post("/admin/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    file_location = DATA_DIR / "Gerichte_Cater_Now_02_26.csv"
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())
    
    # Optional: trigger re-embedding process here
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}
