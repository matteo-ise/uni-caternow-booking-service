from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from embeddings import load_and_embed_dishes
from chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Gerichte beim Start laden und Embeddings erstellen
    await load_and_embed_dishes()
    yield


app = FastAPI(title="CaterNow Chatbot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Im Produktionsbetrieb auf die eigene Domain einschränken
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
