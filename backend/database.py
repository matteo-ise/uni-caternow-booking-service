"""
Database engine setup — Postgres + pgvector in production, SQLite fallback for local dev.

The SQLite fallback lets you run the app without a DB server, but vector search
(pgvector) won't work. In production (Render/Railway), DATABASE_URL must be set.
"""
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    logger.warning("DATABASE_URL not found — using SQLite fallback (pgvector will not work!)")
    DATABASE_URL = "sqlite:///./local_fallback.db"

# Render/Neon/Heroku often provide 'postgres://' but SQLAlchemy needs 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping: test connections before use — critical for Neon serverless
    # which drops idle connections after ~5 min of inactivity (cold-start issue)
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"connect_timeout": 10},
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize DB, enable pgvector extension, and create tables."""
    # pgvector extension must exist before any table with a Vector column is created
    if not DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as e:
                logger.warning("Could not enable pgvector: %s", e)

    # Import here to avoid circular imports (db_models imports Base from this module)
    import db_models
    Base.metadata.create_all(bind=engine)

    # Poor man's migrations: create_all won't add columns to existing tables,
    # so we ALTER TABLE manually. Fine for an MVP — migrate to Alembic later.
    if not DATABASE_URL.startswith("sqlite"):
        migrations = [
            ("memories", "sidecar_data", "ALTER TABLE memories ADD COLUMN IF NOT EXISTS sidecar_data TEXT"),
            ("memories", "updated_at", "ALTER TABLE memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"),
            ("users", "first_login_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ"),
            ("users", "last_login_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ"),
            ("users", "login_count", "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0"),
            ("users", "login_history", "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_history TEXT"),
            ("users", "associated_companies", "ALTER TABLE users ADD COLUMN IF NOT EXISTS associated_companies TEXT"),
            ("users", "total_orders", "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0"),
            ("users", "total_spent", "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent FLOAT DEFAULT 0.0"),
        ]
        for table, column, sql in migrations:
            try:
                with engine.begin() as conn:
                    conn.execute(text(sql))
            except Exception as e:
                logger.debug("Migration note for %s.%s: %s", table, column, e)


