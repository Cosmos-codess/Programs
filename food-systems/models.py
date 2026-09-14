
"""
Data models.

Think of each class below as one spreadsheet/table in your database.
Each attribute (like `name`, `org_type`) is one column in that spreadsheet.
SQLAlchemy turns these Python classes into real database tables for you -
you never have to write raw SQL like "CREATE TABLE suppliers (...)".
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class Supplier(Base):
    """
    A hotel, restaurant, institutional canteen, or food processing unit
    that generates surplus food and registers to list it.
    """
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=False)  # "hotel" | "restaurant" | "canteen" | "processing_unit"
    location = Column(String, nullable=False)  # simple text for now, e.g. "Banjara Hills, Hyderabad"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    license_number = Column(String, nullable=True)  # FSSAI number - optional for the prototype
    created_at = Column(DateTime, default=datetime.utcnow)

    # This lets you write `some_supplier.listings` in Python and get all of
    # their food listings back, without writing a separate database query.
    listings = relationship("FoodListing", back_populates="supplier")


class Buyer(Base):
    """
    An NGO, orphanage, old-age home, or shelter that registers to claim
    free donations or buy discounted bulk listings.
    """
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=False)  # "ngo" | "orphanage" | "old_age_home" | "shelter"
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    registration_number = Column(String, nullable=True)  # NGO reg number - optional for the prototype
    created_at = Column(DateTime, default=datetime.utcnow)


class FoodListing(Base):
    """
    One surplus food post from a supplier - either a free donation or a
    discounted bulk sale. Also carries the freshness/timer fields we
    designed earlier (chef estimate + optional photo flag).
    """
    __tablename__ = "food_listings"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)

    food_name = Column(String, nullable=False)
    quantity_kg = Column(Float, nullable=False)

    listing_type = Column(String, nullable=False)  # "donation" | "discounted_sale"
    price_per_kg = Column(Float, default=0.0)       # 0 for a free donation

    # --- Freshness & timer fields ---
    logged_at = Column(DateTime, default=datetime.utcnow)
    chef_estimate_hours = Column(Float, nullable=False)  # e.g. chef says "good for 8 hours"
    photo_flag = Column(String, default="none")           # "none" | "fine" | "off"
    status = Column(String, default="on_track")            # "on_track" | "urgent" | "expired" | "claimed"

    claimed_by_buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=True)

    supplier = relationship("Supplier", back_populates="listings")
    