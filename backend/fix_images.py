import os
import sys
from sqlalchemy import text
sys.path.append(os.path.join(os.path.dirname(__file__)))
from database import SessionLocal
from db_models import DBDish

def fix():
    db = SessionLocal()
    try:
        dishes = db.query(DBDish).all()
        count = 0
        for d in dishes:
            if d.image_url and d.image_url.endswith(".jpg"):
                d.image_url = d.image_url.replace(".jpg", ".jpeg")
                count += 1
        db.commit()
        print(f"✅ Successfully updated {count} image URLs to .jpeg")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix()
