import os
import sys
import pandas as pd
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from db_models import DBDish, DBUser, DBOrder, DBFeedback, DBSyncState, DBUsageStats

def rebuild():
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
    
    # 4. Seed Dishes (Basic seeding to get it working again)
    print("🌱 Seeding dishes from CSV...")
    db = SessionLocal()
    DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Gerichte_Cater_Now_02_26.csv")
    
    if os.path.exists(DATA_PATH):
        try:
            # Try different encodings
            df = None
            for enc in ['utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(DATA_PATH, sep=";", encoding=enc)
                    break
                except: continue
            
            if df is not None:
                fake_vector = [0.0] * 3072
                count = 0
                for _, row in df.iterrows():
                    name = str(row.get('name', '')).strip()
                    if not name or name == "nan": continue
                    
                    kat = None
                    if float(row.get('vorspeise', 0)) == 1.0: kat = "vorspeise"
                    elif float(row.get('hauptgericht', 0)) == 1.0: kat = "hauptgericht"
                    elif float(row.get('dessert', 0)) == 1.0: kat = "dessert"
                    if not kat: continue
                    
                    try:
                        cid = int(row.get('id', 0))
                    except: cid = 0

                    dish = DBDish(
                        csv_id=cid, name=name, kategorie=kat, 
                        preis=15.0, # Default
                        embedding=fake_vector, 
                        feedback_context=f"Gericht: {name}. Kategorie: {kat}.", 
                        tenant_id="default",
                        image_url=f"/images/dishes/{cid}.jpg"
                    )
                    db.add(dish)
                    count += 1
                
                db.commit()
                print(f"✅ Loaded {count} dishes.")
            else:
                print("❌ Could not read CSV file.")
        except Exception as e:
            print(f"❌ Error during seeding: {e}")
            db.rollback()
    else:
        print(f"⚠️ CSV file not found at {DATA_PATH}")

    db.close()
    print("🚀 Database is now clean and ready!")

if __name__ == "__main__":
    rebuild()
