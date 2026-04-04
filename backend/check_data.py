import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBOrder, DBUser, DBFeedback

db = SessionLocal()
users = db.query(DBUser).all()
print(f"--- Users ({len(users)}) ---")
for u in users:
    print(f"ID: {u.id}, Email: {u.email}, UID: {u.firebase_uid}")

orders = db.query(DBOrder).all()
print(f"\n--- Orders ({len(orders)}) ---")
for o in orders:
    print(f"ID: {o.id}, UserID: {o.user_id}, LeadID: {o.lead_id}, Status: {o.status}")

db.close()
