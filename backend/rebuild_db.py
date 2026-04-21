"""
Destructive rebuild -- drops ALL tables and re-creates them from scratch.

This re-embeds every dish from the source Excel, so it will consume Gemini
embedding quota. Only use for dev resets or when the schema changed significantly.
"""
import os
import sys
import logging
import pandas as pd
from sqlalchemy import text
import asyncio

logger = logging.getLogger(__name__)

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from db_models import DBDish, DBUser, DBOrder, DBFeedback, DBSyncState, DBUsageStats
from embeddings import load_and_embed_dishes

async def rebuild():
    logger.info("Starting database rebuild...")

    logger.info("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)

    if not os.environ.get("DATABASE_URL", "").startswith("sqlite"):
        with engine.begin() as conn:
            try:
                logger.info("Ensuring pgvector extension exists...")
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as e:
                logger.warning("Could not enable pgvector: %s", e)

    logger.info("Creating fresh tables from models...")
    Base.metadata.create_all(bind=engine)

    logger.info("Seeding dishes from Excel (including embeddings)...")
    await load_and_embed_dishes(force_refresh=True)

    logger.info("Database rebuild complete — clean, updated, and vectorized.")

if __name__ == "__main__":
    asyncio.run(rebuild())
