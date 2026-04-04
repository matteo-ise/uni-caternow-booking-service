"""
Pydantic Models for CaterNow Backend API.
This file defines the data structures used for request/response validation in FastAPI.
Update these models if new attributes (like 'vegan', 'allergens') are added to the dishes.
"""
from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "model"]
    content: str


class WizardData(BaseModel):
    customerType: Literal["private", "business"]
    persons: int | str | None = None
    date: str | None = None
    budget: str | None = None
    companyName: str | None = None
    companyDomain: str | None = None

class ChatRequest(BaseModel):
    conversation: list[Message]
    wizardData: WizardData | None = None
    leadId: str | None = None


class Dish(BaseModel):
    name: str
    kategorie: Literal["vorspeise", "hauptgericht", "dessert"]
    preis: float | None = None


class MenuSuggestion(BaseModel):
    vorspeise: Dish | None = None
    hauptgericht: Dish | None = None
    dessert: Dish | None = None


class ChatResponse(BaseModel):
    message: str
    menu: MenuSuggestion | None = None
