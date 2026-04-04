import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Lade .env aus dem Hauptverzeichnis
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Falls wir lokal sind und keine DB haben, nutzen wir SQLite für Basistests, 
    # aber warnen, dass pgvector dann nicht funktioniert.
    # In Produktion (Render) MUSS DATABASE_URL gesetzt sein.
    print("[WARNING] DATABASE_URL nicht gefunden. Nutze SQLite Fallback (pgvector wird fehlschlagen!)")
    DATABASE_URL = "sqlite:///./local_fallback.db"

# Render/Neon/Heroku liefern oft 'postgres://' - SQLAlchemy benötigt 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Engine Konfiguration
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialisiert die DB, aktiviert die pgvector-Extension und legt die Tabellen an."""
    # pgvector Extension muss in der Datenbank existieren, bevor Tabellen mit Vector-Typ angelegt werden.
    if not DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as e:
                print(f"[Database] Warnung beim Aktivieren von pgvector: {e}")
    
    # Import hier, um Zirkulär-Imports zu vermeiden
    import db_models 
    Base.metadata.create_all(bind=engine)


