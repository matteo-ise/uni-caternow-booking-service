import os
import sys
import pandas as pd
from sqlalchemy import text
import asyncio

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from db_models import DBDish, DBUser, DBOrder, DBFeedback, DBSyncState, DBUsageStats
from embeddings import load_and_embed_dishes

async def rebuild():
    print("🔥 Starting Database Rebuild...")
    
    # 1. Drop all tables
    print("🗑️ Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    
    # 2. Re-create Extension (for pgvector)
    if not os.environ.get("DATABASE_URL", "").startswith("sqlite"):
        with engine.begin() as conn:
            try:
                print("✨ Ensuring pgvector extension exists...")
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as e:
                print(f"⚠️ Warning enabling pgvector: {e}")

    # 3. Create all tables from scratch
    print("🛠️ Creating fresh tables from models...")
    Base.metadata.create_all(bind=engine)
    
    # 4. Seed Dishes using the new Excel logic
    print("🌱 Seeding dishes from Excel (including Embeddings)...")
    await load_and_embed_dishes(force_refresh=True)
    
    print("🚀 Database is now clean, updated, and vectorized!")

if __name__ == "__main__":
    asyncio.run(rebuild())
