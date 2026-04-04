import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish

db = SessionLocal()
tiras = db.query(DBDish).filter(DBDish.name.contains('Tira')).all()
for t in tiras:
    print(f"ID: {t.csv_id} | Name: {t.name}")
db.close()
