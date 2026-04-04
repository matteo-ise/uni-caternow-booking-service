from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import firebase_admin
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session

from database import init_db, get_db
from db_models import DBUser
from embeddings import load_and_embed_dishes
from chat import router as chat_router

# Firebase Initialisierung (für Token-Validierung)
try:
    firebase_admin.initialize_app()
except ValueError:
    pass # App is already initialized

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Datenbank und pgvector initialisieren
    init_db()
    # Gerichte beim Start laden und Embeddings erstellen (nur wenn DB leer)
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

@app.post("/api/users/sync")
async def sync_user(decoded_token: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    name = decoded_token.get("name", "")

    user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
    if not user:
        user = DBUser(firebase_uid=uid, email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"status": "created", "user_id": user.id}
    else:
        # Update name if it changed
        if user.name != name:
            user.name = name
            db.commit()
        return {"status": "exists", "user_id": user.id}

@app.get("/health")
async def health():
    return {"status": "ok"}

