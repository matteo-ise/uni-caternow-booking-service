import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish
import numpy as np

db = SessionLocal()
dishes = db.query(DBDish).all()
print(f"Total dishes in DB: {len(dishes)}")
for d in dishes:
    vec = np.array(d.embedding)
    vec_sum = np.sum(vec)
    print(f"ID: {d.csv_id} | Name: {d.name} | Vector Sum: {vec_sum}")
db.close()
