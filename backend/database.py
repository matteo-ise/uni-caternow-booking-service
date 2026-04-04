import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Lade .env aus dem Hauptverzeichnis
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL or not DATABASE_URL.startswith("postgresql"):
    raise ValueError("Eine PostgreSQL Datenbank-URL (DATABASE_URL) ist zwingend erforderlich für pgvector (Vector Search). SQLite wird nicht unterstützt.")

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
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    
    # Import hier, um Zirkulär-Imports zu vermeiden
    import db_models 
    Base.metadata.create_all(bind=engine)

