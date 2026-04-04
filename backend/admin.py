import os
from fastapi import APIRouter, HTTPException, Depends, Header
from pathlib import Path
from typing import List
from pydantic import BaseModel

router = APIRouter()

# Ein einfaches Admin-Passwort aus der .env oder Fallback
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "caternow-god-mode")
MEMORY_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data", "memory"))

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
    
    # Sortiert nach Aktualität
    leads.sort(key=lambda x: x.last_updated, reverse=True)
    return leads

@router.get("/admin/memory/{lead_id}")
async def get_lead_memory(lead_id: str, authenticated: bool = Depends(verify_admin)):
    """Gibt den Inhalt der Memory-Datei für einen Lead zurück."""
    path = MEMORY_DIR / f"{lead_id}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    
    return {"content": path.read_text(encoding="utf-8")}
