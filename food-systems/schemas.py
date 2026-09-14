"""
Pydantic schemas.

Quick distinction from models.py:
- models.py defines what's stored IN THE DATABASE (SQLAlchemy).
- schemas.py defines what's sent/received OVER THE API (Pydantic).

They look similar but serve different jobs. For example, when someone
registers a supplier, they send us a SupplierCreate (no id yet, since the
database hasn't assigned one). We respond back with a SupplierOut, which
DOES include the id the database generated.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ---------- Supplier ----------

class SupplierCreate(BaseModel):
    name: str
    org_type: str          # "hotel" | "restaurant" | "canteen" | "processing_unit"
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    license_number: Optional[str] = None


class SupplierOut(SupplierCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True  # lets this read directly from a SQLAlchemy object


# ---------- Buyer ----------

class BuyerCreate(BaseModel):
    name: str
    org_type: str           # "ngo" | "orphanage" | "old_age_home" | "shelter"
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    registration_number: Optional[str] = None


class BuyerOut(BuyerCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Food Listing ----------

class FoodListingCreate(BaseModel):
    supplier_id: int
    food_name: str
    quantity_kg: float
    listing_type: str              # "donation" | "discounted_sale"
    price_per_kg: float = 0.0
    chef_estimate_hours: float     # how long the chef says it's good for


class FoodListingOut(BaseModel):
    id: int
    supplier_id: int
    food_name: str
    quantity_kg: float
    listing_type: str
    price_per_kg: float
    logged_at: datetime
    chef_estimate_hours: float
    photo_flag: str
    status: str
    claimed_by_buyer_id: Optional[int] = None

    class Config:
        from_attributes = True