from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from database import Base

class DBDish(Base):
    __tablename__ = "dishes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, default="default")
    csv_id = Column(Integer, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    kategorie = Column(String, index=True, nullable=False) # e.g. vorspeise, hauptgericht, dessert
    dish_type = Column(String, nullable=True) # more specific type if any
    diet = Column(String, nullable=True) # e.g. vegan, vegetarisch
    preis = Column(Float, nullable=True)
    allergenes = Column(String, nullable=True)
    additives = Column(String, nullable=True)
    kitchen = Column(String, nullable=True) # e.g. Italian, Asian
    
    # AI/ML Scores (0.0 to 1.0)
    fancy_score = Column(Float, nullable=True, default=0.0)
    heavy_score = Column(Float, nullable=True, default=0.0)
    filling_score = Column(Float, nullable=True, default=0.0)
    traditional_score = Column(Float, nullable=True, default=0.0)
    spicy_score = Column(Float, nullable=True, default=0.0)
    
    # Suitability & Popularity
    is_fingerfood = Column(Boolean, nullable=True, default=False)
    is_buffet = Column(Boolean, nullable=True, default=True)
    popularity = Column(Float, nullable=True, default=0.5)
    
    image_url = Column(String, nullable=True)
    feedback_context = Column(Text, nullable=True, default="")
    manual_feedback = Column(Text, nullable=True)
    
    # Gemini embedding model (3072 dimensions)
    embedding = Column(Vector(3072))

class DBUser(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, default="default")
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DBOrder(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, default="default")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lead_id = Column(String, index=True, nullable=False)
    total_price = Column(Float, nullable=True)
    status = Column(String, default="neu")
    order_data = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DBFeedback(Base):
    __tablename__ = "feedbacks"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, default="default")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dish_id = Column(Integer, ForeignKey("dishes.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    rating = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    is_general = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DBSyncState(Base):
    __tablename__ = "sync_state"
    id = Column(Integer, primary_key=True)
    csv_hash = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class DBUsageStats(Base):
    __tablename__ = "usage_stats"
    id = Column(Integer, primary_key=True)
    feature = Column(String, unique=True, index=True) # e.g. "google_search"
    count = Column(Integer, default=0)
    last_reset = Column(DateTime(timezone=True), server_default=func.now())

class DBMemory(Base):
    __tablename__ = "memories"
    id = Column(Integer, primary_key=True)
    lead_id = Column(String, unique=True, index=True, nullable=False)
    content = Column(Text, nullable=False)
    sidecar_data = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
