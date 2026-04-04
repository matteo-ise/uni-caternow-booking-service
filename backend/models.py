"""
Pydantic Models for CaterNow Backend API.
Updated to include similarity scores for vector search transparency.
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
    companyDomain: Optional[str] = None


class Dish(BaseModel):
    name: str
    kategorie: Literal["vorspeise", "hauptgericht", "dessert"]
    preis: Optional[float] = None
    image_url: Optional[str] = None
    similarity_score: Optional[float] = None # Der mathematische Match-Wert (0 bis 1)


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


class ChatResponse(BaseModel):
    message: str
    menu: Optional[MenuSuggestion] = None
