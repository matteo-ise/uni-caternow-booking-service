from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from database import Base

class DBDish(Base):
    __tablename__ = "dishes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    kategorie = Column(String, index=True, nullable=False)
    preis = Column(Float, nullable=True)
    
    # Gemini embedding model
    embedding = Column(Vector(3072))

class DBUser(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

