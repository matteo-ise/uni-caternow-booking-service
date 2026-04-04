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
    # Try multiple encodings to get the best result
    try:
        df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
    except:
        df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="utf-8", errors="replace")
    
    fake_vector = [0.0] * 3072
    
    count = 0
    for i, row in df.iterrows():
        name = str(row['name']).strip()
        if not name or name == "nan": continue
        
        kat = None
        if str(row.get('vorspeise')).strip() == '1': kat = "vorspeise"
        elif str(row.get('hauptgericht')).strip() == '1': kat = "hauptgericht"
        elif str(row.get('dessert')).strip() == '1': kat = "dessert"
        
        if not kat: continue
        
        csv_id = int(row['id'])
        try:
            p_str = str(row.get('Preis')).replace(',', '.')
            preis = float(p_str)
        except:
            preis = 15.0
        
        dish = DBDish(
            csv_id=csv_id, name=name, kategorie=kat, preis=preis, 
            embedding=fake_vector, feedback_context="", tenant_id="default",
            image_url=f"/images/dishes/{csv_id}.jpg"
        )
        db.add(dish)
        count += 1
        
    db.commit()
    db.close()
    print(f"✅ Successfully loaded ALL {count} dishes from CSV into Neon DB.")

if __name__ == "__main__":
    seed()
