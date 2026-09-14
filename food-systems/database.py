"""
Database connection setup.

We're using SQLite here - it's just a single file on disk (food_system.db),
so there's no separate database server to install or run. Perfect for a
hackathon prototype. If you later get PostgreSQL set up, you only need to
change DATABASE_URL below - nothing else in your code changes.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./food_system.db"

# check_same_thread=False is an SQLite-specific setting needed because
# FastAPI can talk to the database from multiple requests at once.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# SessionLocal is a factory that hands out "conversations" with the database.
# Every API request that needs the database will open one of these, use it,
# then close it.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class every table model (Supplier, Buyer, etc.) inherits
# from. It's what lets SQLAlchemy know "these Python classes represent
# database tables."
Base = declarative_base()


def get_db():
    """
    Used by FastAPI endpoints to get a database session, and makes sure
    it's always closed afterwards - even if something goes wrong.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()