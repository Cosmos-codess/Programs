"""
Main FastAPI application.

This ties everything together:
- database.py  -> how we connect to the database
- models.py    -> what the database tables look like
- schemas.py   -> what data the API sends/receives
- app.py (this file) -> the actual routes (endpoints) your frontend calls
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, get_db, Base
import models
import schemas

# This line reads models.py and actually creates the tables in
# food_system.db if they don't already exist. Safe to run every time you
# start the server - it won't wipe existing data.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Food Waste & Redistribution API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 1. Demand Prediction (unchanged from earlier prototype)
# ============================================================

class DemandInput(schemas.BaseModel):
    day_of_week: int
    expected_attendees: int


@app.post("/predict")
def predict_meals(data: DemandInput):
    base_kg = data.expected_attendees * 0.4
    multiplier = 1.15 if data.day_of_week in [0, 4] else 1.0
    predicted_kg = round(base_kg * multiplier, 2)
    return {
        "recommended_cook_kg": predicted_kg,
        "estimated_meals": int(predicted_kg / 0.35),
    }


# ============================================================
# 2. Supplier registration (hotels, restaurants, canteens, units)
# ============================================================

@app.post("/suppliers/register", response_model=schemas.SupplierOut)
def register_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db)):
    new_supplier = models.Supplier(**supplier.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)  # pulls back the id + created_at the DB generated
    return new_supplier


@app.get("/suppliers", response_model=list[schemas.SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()


# ============================================================
# 3. Buyer registration (NGOs, orphanages, old-age homes, shelters)
# ============================================================

@app.post("/buyers/register", response_model=schemas.BuyerOut)
def register_buyer(buyer: schemas.BuyerCreate, db: Session = Depends(get_db)):
    new_buyer = models.Buyer(**buyer.model_dump())
    db.add(new_buyer)
    db.commit()
    db.refresh(new_buyer)
    return new_buyer


@app.get("/buyers", response_model=list[schemas.BuyerOut])
def list_buyers(db: Session = Depends(get_db)):
    return db.query(models.Buyer).all()


# ============================================================
# 4. Food Listings (surplus food posted by a supplier)
# ============================================================

@app.post("/listings", response_model=schemas.FoodListingOut)
def create_listing(listing: schemas.FoodListingCreate, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == listing.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found - register first")

    new_listing = models.FoodListing(**listing.model_dump())
    db.add(new_listing)
    db.commit()
    db.refresh(new_listing)
    return new_listing


@app.get("/listings", response_model=list[schemas.FoodListingOut])
def browse_listings(status: str | None = None, db: Session = Depends(get_db)):
    """
    Buyers use this to browse what's available. Pass ?status=on_track to
    filter, or leave it out to see everything.
    """
    query = db.query(models.FoodListing)
    if status:
        query = query.filter(models.FoodListing.status == status)
    return query.all()


@app.post("/listings/{listing_id}/claim", response_model=schemas.FoodListingOut)
def claim_listing(listing_id: int, buyer_id: int, db: Session = Depends(get_db)):
    listing = db.query(models.FoodListing).filter(models.FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status == "claimed":
        raise HTTPException(status_code=400, detail="Already claimed by someone else")

    buyer = db.query(models.Buyer).filter(models.Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found - register first")

    listing.claimed_by_buyer_id = buyer_id
    listing.status = "claimed"
    db.commit()
    db.refresh(listing)
    return listing