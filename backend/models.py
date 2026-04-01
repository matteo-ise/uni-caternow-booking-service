from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "model"]
    content: str


class ChatRequest(BaseModel):
    conversation: list[Message]


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
