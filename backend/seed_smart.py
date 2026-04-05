import pandas as pd
import os
import sys
sys.path.append('backend')
from database import SessionLocal, engine
from db_models import DBDish
from sqlalchemy import text

def seed():
    print("🗑️ Reset DB...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE dishes RESTART IDENTITY CASCADE"))
    
    db = SessionLocal()
    df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
    
    fake_vector = [0.0] * 3072
    
    # Take a better variety
    vorspeisen = df[df['vorspeise'] == 1].head(30)
    hauptgerichte = df[df['hauptgericht'] == 1].head(50)
    desserts = df[df['dessert'] == 1] # Load ALL desserts
    
    combined = pd.concat([vorspeisen, hauptgerichte, desserts]).drop_duplicates(subset=['id'])
    
    for i, row in combined.iterrows():
        name = str(row['name']).strip()
        if not name or name == "nan": continue
        
        kat = None
        if int(row.get('vorspeise', 0)) == 1: kat = "vorspeise"
        elif int(row.get('hauptgericht', 0)) == 1: kat = "hauptgericht"
        elif int(row.get('dessert', 0)) == 1: kat = "dessert"
        
        csv_id = int(row['id'])
        preis = float(row['Preis']) if pd.notna(row['Preis']) else 15.0
        
        dish = DBDish(
            csv_id=csv_id, name=name, kategorie=kat, preis=preis, 
            embedding=fake_vector, feedback_context="", tenant_id="default",
            image_url=f"/images/dishes/{csv_id}.jpeg"
        )
        db.add(dish)
        
    db.commit()
    db.close()
    print(f"✅ Loaded {len(combined)} real dishes with variety.")

if __name__ == "__main__":
    seed()
