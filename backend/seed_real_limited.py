import os
import asyncio
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv
import sys
sys.path.append('backend')
from database import SessionLocal, engine
from db_models import DBDish
from sqlalchemy import text

load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

async def run():
    print("🗑️ Reset DB...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE dishes RESTART IDENTITY CASCADE"))
    
    db = SessionLocal()
    df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
    
    # Pick a few from each category
    vorspeisen = df[df['vorspeise'] == 1].head(5)
    hauptgerichte = df[df['hauptgericht'] == 1].head(10)
    desserts = df[df['dessert'] == 1].head(5)
    
    subset = pd.concat([vorspeisen, hauptgerichte, desserts])
    
    names = []
    objects = []
    for _, row in subset.iterrows():
        name = str(row['name']).strip()
        csv_id = int(row['id'])
        kat = "vorspeise" if row['vorspeise'] == 1 else ("hauptgericht" if row['hauptgericht'] == 1 else "dessert")
        names.append(name)
        objects.append(DBDish(csv_id=csv_id, name=name, kategorie=kat, preis=float(row['Preis']) if pd.notna(row['Preis']) else 15.0, feedback_context="", tenant_id="default"))

    print(f"Embedding {len(names)} dishes...")
    try:
        res = genai.embed_content(model="models/gemini-embedding-001", content=names)
        for i, vec in enumerate(res['embedding']):
            objects[i].embedding = vec
            db.add(objects[i])
        db.commit()
        print("✅ SUCCESS!")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run())
