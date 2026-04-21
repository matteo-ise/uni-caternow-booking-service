"""
Pydantic request/response models for the CaterNow API.
"""
from pydantic import BaseModel
from typing import Literal, List, Optional


class Message(BaseModel):
    role: Literal["user", "model"]
    content: str


class WizardData(BaseModel):
    customerType: Literal["private", "business"]
    persons: Optional[int | str] = None
    date: Optional[str] = None
    budget: Optional[str] = None
    companyName: Optional[str] = None


class Dish(BaseModel):
    name: str
    # German field names (kategorie, preis) match the source Excel columns
    # to keep the CSV-to-DB-to-API pipeline straightforward
    kategorie: Literal["vorspeise", "hauptgericht", "dessert"]
    preis: Optional[float] = None
    image_url: Optional[str] = None
    # Raw cosine similarity (0..1) — exposed in the UI as "AI Match %"
    similarity_score: Optional[float] = None


class MenuSuggestion(BaseModel):
    vorspeise: Optional[Dish] = None
    hauptgericht1: Optional[Dish] = None
    hauptgericht2: Optional[Dish] = None
    dessert: Optional[Dish] = None
    alternativen: Optional[List[Dish]] = []


class ChatRequest(BaseModel):
    conversation: List[Message]
    wizardData: Optional[WizardData] = None
    leadId: Optional[str] = None
    context_services: Optional[List[str]] = []


class ChatResponse(BaseModel):
    message: str
    menu: Optional[MenuSuggestion] = None
