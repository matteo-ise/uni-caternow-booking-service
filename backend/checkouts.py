"""
Shareable checkout links — each checkout gets a short UUID so customers
can bookmark or share their menu selection before confirming an order.
"""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from database import get_db
from db_models import DBCheckout

router = APIRouter()


class CheckoutCreate(BaseModel):
    lead_id: str
    menu: Dict[str, Any]
    wizard_data: Dict[str, Any]
    selected_services: List[str] = []
    custom_wish: Optional[str] = None


@router.post("/checkouts")
async def create_checkout(data: CheckoutCreate, db: Session = Depends(get_db)):
    # 8-char prefix of UUIDv4 — collision probability is ~1 in 4 billion,
    # plenty safe for our order volume
    checkout_id = str(uuid.uuid4())[:8]
    checkout = DBCheckout(
        checkout_id=checkout_id,
        lead_id=data.lead_id,
        menu=json.dumps(data.menu, ensure_ascii=False),
        wizard_data=json.dumps(data.wizard_data, ensure_ascii=False),
        selected_services=json.dumps(data.selected_services, ensure_ascii=False),
        custom_wish=data.custom_wish,
    )
    db.add(checkout)
    db.commit()
    return {"checkout_id": checkout_id}


@router.get("/checkouts/{checkout_id}")
async def get_checkout(checkout_id: str, db: Session = Depends(get_db)):
    checkout = db.query(DBCheckout).filter(DBCheckout.checkout_id == checkout_id).first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout nicht gefunden")
    return {
        "checkout_id": checkout.checkout_id,
        "lead_id": checkout.lead_id,
        "menu": json.loads(checkout.menu),
        "wizard_data": json.loads(checkout.wizard_data),
        "selected_services": json.loads(checkout.selected_services) if checkout.selected_services else [],
        "custom_wish": checkout.custom_wish,
        "created_at": checkout.created_at,
    }
