import os
import json
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List
from pydantic import BaseModel

from database import get_db
from db_models import DBOrder, DBFeedback, DBDish
from embeddings import load_and_embed_dishes

router = APIRouter()

# Ein einfaches Admin-Passwort aus der .env oder Fallback
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "caternow-god-mode")
MEMORY_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data", "memory"))
DATA_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data"))

class LeadSummary(BaseModel):
    id: str
    last_updated: float
    size: int

def verify_admin(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Zugriff verweigert: Ungültiger Admin-Token")
    return True

@router.get("/admin/leads", response_model=List[LeadSummary])
async def list_leads(authenticated: bool = Depends(verify_admin)):
    """Listet alle Leads (Dateien im Memory-Ordner) auf."""
    if not MEMORY_DIR.exists():
        return []
    
    leads = []
    for file in MEMORY_DIR.glob("*.md"):
        stats = file.stat()
        leads.append(LeadSummary(
            id=file.stem,
            last_updated=stats.st_mtime,
            size=stats.st_size
        ))
    
    leads.sort(key=lambda x: x.last_updated, reverse=True)
    return leads

@router.get("/admin/memory/{lead_id}")
async def get_lead_memory(lead_id: str, authenticated: bool = Depends(verify_admin)):
    """Gibt den Inhalt der Memory-Datei für einen Lead zurück."""
    path = MEMORY_DIR / f"{lead_id}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    return {"content": path.read_text(encoding="utf-8")}

@router.get("/admin/orders")
async def get_all_orders(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    orders = db.query(DBOrder).order_by(DBOrder.created_at.desc()).all()
    return [{"id": o.id, "lead_id": o.lead_id, "status": o.status, "total_price": o.total_price, "created_at": o.created_at, "order_data": json.loads(o.order_data)} for o in orders]

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
