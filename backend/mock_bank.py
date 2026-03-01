"""Mock bank data for FutureSpend.

Provides realistic transaction history and merchant average lookups
for data-driven spend estimation. In production this would connect
to the user's actual bank API (RBC, TD, etc.).
"""

from __future__ import annotations

import re
from collections import defaultdict

from pydantic import BaseModel


# ── Realistic transaction history (last 30 days) ──────────────────────────

TRANSACTIONS: list[dict] = [
    # Starbucks — 5 visits (~$6.25 avg)
    {"date": "2026-02-28", "merchant": "Starbucks", "amount": 6.75, "category": "food"},
    {"date": "2026-02-25", "merchant": "Starbucks", "amount": 5.50, "category": "food"},
    {"date": "2026-02-21", "merchant": "Starbucks", "amount": 7.25, "category": "food"},
    {"date": "2026-02-18", "merchant": "Starbucks", "amount": 6.00, "category": "food"},
    {"date": "2026-02-10", "merchant": "Starbucks", "amount": 5.75, "category": "food"},
    # Tim Hortons — 4 visits (~$3.88 avg)
    {"date": "2026-02-27", "merchant": "Tim Hortons", "amount": 3.50, "category": "food"},
    {"date": "2026-02-24", "merchant": "Tim Hortons", "amount": 4.25, "category": "food"},
    {"date": "2026-02-19", "merchant": "Tim Hortons", "amount": 3.75, "category": "food"},
    {"date": "2026-02-12", "merchant": "Tim Hortons", "amount": 4.00, "category": "food"},
    # Uber — 6 trips (~$15.71 avg)
    {"date": "2026-02-28", "merchant": "Uber", "amount": 14.50, "category": "transport"},
    {"date": "2026-02-26", "merchant": "Uber", "amount": 18.25, "category": "transport"},
    {"date": "2026-02-23", "merchant": "Uber", "amount": 12.75, "category": "transport"},
    {"date": "2026-02-20", "merchant": "Uber", "amount": 22.00, "category": "transport"},
    {"date": "2026-02-16", "merchant": "Uber", "amount": 15.50, "category": "transport"},
    {"date": "2026-02-08", "merchant": "Uber", "amount": 11.25, "category": "transport"},
    # The Keg — 2 dinners (~$79.75 avg)
    {"date": "2026-02-22", "merchant": "The Keg", "amount": 87.50, "category": "food"},
    {"date": "2026-01-31", "merchant": "The Keg", "amount": 72.00, "category": "food"},
    # Earls Restaurant — 2 visits (~$41.75 avg)
    {"date": "2026-02-20", "merchant": "Earls", "amount": 45.00, "category": "food"},
    {"date": "2026-02-07", "merchant": "Earls", "amount": 38.50, "category": "food"},
    # OEB Breakfast Co — 2 visits (~$21.13 avg)
    {"date": "2026-02-15", "merchant": "OEB Breakfast Co", "amount": 22.50, "category": "food"},
    {"date": "2026-02-01", "merchant": "OEB Breakfast Co", "amount": 19.75, "category": "food"},
    # Cineplex — 2 visits (~$20.75 avg)
    {"date": "2026-02-14", "merchant": "Cineplex", "amount": 22.00, "category": "entertainment"},
    {"date": "2026-02-01", "merchant": "Cineplex", "amount": 19.50, "category": "entertainment"},
    # Sobeys grocery — 3 shops (~$94.98 avg)
    {"date": "2026-02-27", "merchant": "Sobeys", "amount": 94.32, "category": "grocery"},
    {"date": "2026-02-20", "merchant": "Sobeys", "amount": 78.15, "category": "grocery"},
    {"date": "2026-02-13", "merchant": "Sobeys", "amount": 112.47, "category": "grocery"},
    # Subscriptions
    {"date": "2026-02-01", "merchant": "Netflix", "amount": 18.99, "category": "subscription"},
    {"date": "2026-02-01", "merchant": "Spotify", "amount": 11.99, "category": "subscription"},
    # Gas
    {"date": "2026-02-18", "merchant": "Esso", "amount": 68.40, "category": "transport"},
    # Dentist (zero — covered by insurance)
    {"date": "2026-02-10", "merchant": "Downtown Dental", "amount": 0.0, "category": "health"},

    # Walmart Supercentre — 3 trips (~$145.50 avg)
    {"date": "2026-02-26", "merchant": "Walmart Supercentre", "amount": 132.40, "category": "grocery"},
    {"date": "2026-02-17", "merchant": "Walmart Supercentre", "amount": 158.20, "category": "grocery"},
    {"date": "2026-02-03", "merchant": "Walmart Supercentre", "amount": 145.90, "category": "grocery"},

    # Amazon — 4 orders (~$54.24 avg)
    {"date": "2026-02-27", "merchant": "Amazon", "amount": 39.99, "category": "shopping"},
    {"date": "2026-02-22", "merchant": "Amazon", "amount": 62.50, "category": "shopping"},
    {"date": "2026-02-15", "merchant": "Amazon", "amount": 71.30, "category": "shopping"},
    {"date": "2026-02-05", "merchant": "Amazon", "amount": 43.17, "category": "shopping"},

    # Apple App Store — 3 purchases (~$8.83 avg)
    {"date": "2026-02-24", "merchant": "Apple App Store", "amount": 5.49, "category": "entertainment"},
    {"date": "2026-02-19", "merchant": "Apple App Store", "amount": 9.99, "category": "entertainment"},
    {"date": "2026-02-04", "merchant": "Apple App Store", "amount": 11.00, "category": "entertainment"},

    # Calgary Transit — 5 rides (~$3.40 avg)
    {"date": "2026-02-28", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-25", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-22", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},
    {"date": "2026-02-18", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-11", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},

    # DoorDash — 4 deliveries (~$32.06 avg)
    {"date": "2026-02-23", "merchant": "DoorDash", "amount": 28.75, "category": "food"},
    {"date": "2026-02-19", "merchant": "DoorDash", "amount": 35.60, "category": "food"},
    {"date": "2026-02-09", "merchant": "DoorDash", "amount": 31.90, "category": "food"},
    {"date": "2026-02-02", "merchant": "DoorDash", "amount": 31.00, "category": "food"},

    # SkipTheDishes — 3 deliveries (~$27.98 avg)
    {"date": "2026-02-21", "merchant": "SkipTheDishes", "amount": 24.50, "category": "food"},
    {"date": "2026-02-13", "merchant": "SkipTheDishes", "amount": 29.75, "category": "food"},
    {"date": "2026-02-06", "merchant": "SkipTheDishes", "amount": 29.70, "category": "food"},

    # Shoppers Drug Mart — 3 visits (~$36.80 avg)
    {"date": "2026-02-27", "merchant": "Shoppers Drug Mart", "amount": 41.25, "category": "health"},
    {"date": "2026-02-18", "merchant": "Shoppers Drug Mart", "amount": 29.40, "category": "health"},
    {"date": "2026-02-08", "merchant": "Shoppers Drug Mart", "amount": 39.75, "category": "health"},

    # GoodLife Fitness — membership and extras (~$39.24 avg)
    {"date": "2026-02-01", "merchant": "GoodLife Fitness", "amount": 29.99, "category": "fitness"},
    {"date": "2026-02-20", "merchant": "GoodLife Fitness", "amount": 48.50, "category": "fitness"},
    {"date": "2026-02-10", "merchant": "GoodLife Fitness", "amount": 39.24, "category": "fitness"},

    # Shell — 2 gas fill-ups (~$71.48 avg)
    {"date": "2026-02-24", "merchant": "Shell", "amount": 69.99, "category": "transport"},
    {"date": "2026-02-09", "merchant": "Shell", "amount": 72.97, "category": "transport"},

    # Air Canada — 1 flight
    {"date": "2026-02-16", "merchant": "Air Canada", "amount": 468.20, "category": "travel"},

    # Marriott Hotel — weekend stay
    {"date": "2026-02-17", "merchant": "Marriott Hotel", "amount": 612.75, "category": "travel"},

    # Extra Starbucks visits
    {"date": "2026-02-26", "merchant": "Starbucks", "amount": 6.10, "category": "food"},
    {"date": "2026-02-23", "merchant": "Starbucks", "amount": 5.90, "category": "food"},
    {"date": "2026-02-19", "merchant": "Starbucks", "amount": 6.45, "category": "food"},
    {"date": "2026-02-14", "merchant": "Starbucks", "amount": 7.05, "category": "food"},
    {"date": "2026-02-11", "merchant": "Starbucks", "amount": 6.30, "category": "food"},
    {"date": "2026-02-09", "merchant": "Starbucks", "amount": 5.80, "category": "food"},
    {"date": "2026-02-06", "merchant": "Starbucks", "amount": 6.95, "category": "food"},
    {"date": "2026-02-04", "merchant": "Starbucks", "amount": 5.60, "category": "food"},
    {"date": "2026-02-03", "merchant": "Starbucks", "amount": 6.20, "category": "food"},
    {"date": "2026-02-02", "merchant": "Starbucks", "amount": 7.15, "category": "food"},

    # Extra Tim Hortons visits
    {"date": "2026-02-28", "merchant": "Tim Hortons", "amount": 3.65, "category": "food"},
    {"date": "2026-02-26", "merchant": "Tim Hortons", "amount": 4.10, "category": "food"},
    {"date": "2026-02-22", "merchant": "Tim Hortons", "amount": 3.80, "category": "food"},
    {"date": "2026-02-18", "merchant": "Tim Hortons", "amount": 4.05, "category": "food"},
    {"date": "2026-02-16", "merchant": "Tim Hortons", "amount": 3.55, "category": "food"},
    {"date": "2026-02-14", "merchant": "Tim Hortons", "amount": 4.20, "category": "food"},
    {"date": "2026-02-10", "merchant": "Tim Hortons", "amount": 3.90, "category": "food"},
    {"date": "2026-02-07", "merchant": "Tim Hortons", "amount": 4.05, "category": "food"},
    {"date": "2026-02-05", "merchant": "Tim Hortons", "amount": 3.70, "category": "food"},
    {"date": "2026-02-02", "merchant": "Tim Hortons", "amount": 4.15, "category": "food"},

    # Extra Uber trips
    {"date": "2026-02-27", "merchant": "Uber", "amount": 16.40, "category": "transport"},
    {"date": "2026-02-25", "merchant": "Uber", "amount": 13.85, "category": "transport"},
    {"date": "2026-02-21", "merchant": "Uber", "amount": 19.10, "category": "transport"},
    {"date": "2026-02-19", "merchant": "Uber", "amount": 14.75, "category": "transport"},
    {"date": "2026-02-17", "merchant": "Uber", "amount": 18.95, "category": "transport"},
    {"date": "2026-02-14", "merchant": "Uber", "amount": 12.60, "category": "transport"},
    {"date": "2026-02-12", "merchant": "Uber", "amount": 20.35, "category": "transport"},
    {"date": "2026-02-10", "merchant": "Uber", "amount": 15.25, "category": "transport"},
    {"date": "2026-02-06", "merchant": "Uber", "amount": 13.40, "category": "transport"},
    {"date": "2026-02-03", "merchant": "Uber", "amount": 17.80, "category": "transport"},

    # Extra Sobeys grocery trips
    {"date": "2026-02-25", "merchant": "Sobeys", "amount": 88.60, "category": "grocery"},
    {"date": "2026-02-23", "merchant": "Sobeys", "amount": 97.25, "category": "grocery"},
    {"date": "2026-02-19", "merchant": "Sobeys", "amount": 102.85, "category": "grocery"},
    {"date": "2026-02-16", "merchant": "Sobeys", "amount": 89.40, "category": "grocery"},
    {"date": "2026-02-11", "merchant": "Sobeys", "amount": 107.95, "category": "grocery"},
    {"date": "2026-02-09", "merchant": "Sobeys", "amount": 92.15, "category": "grocery"},
    {"date": "2026-02-06", "merchant": "Sobeys", "amount": 98.70, "category": "grocery"},
    {"date": "2026-02-04", "merchant": "Sobeys", "amount": 86.55, "category": "grocery"},
    {"date": "2026-02-02", "merchant": "Sobeys", "amount": 115.20, "category": "grocery"},
    {"date": "2026-01-31", "merchant": "Sobeys", "amount": 101.80, "category": "grocery"},

    # Extra Walmart Supercentre trips
    {"date": "2026-02-25", "merchant": "Walmart Supercentre", "amount": 149.20, "category": "grocery"},
    {"date": "2026-02-22", "merchant": "Walmart Supercentre", "amount": 138.75, "category": "grocery"},
    {"date": "2026-02-19", "merchant": "Walmart Supercentre", "amount": 154.30, "category": "grocery"},
    {"date": "2026-02-15", "merchant": "Walmart Supercentre", "amount": 143.95, "category": "grocery"},
    {"date": "2026-02-12", "merchant": "Walmart Supercentre", "amount": 152.40, "category": "grocery"},
    {"date": "2026-02-10", "merchant": "Walmart Supercentre", "amount": 139.85, "category": "grocery"},
    {"date": "2026-02-07", "merchant": "Walmart Supercentre", "amount": 160.10, "category": "grocery"},
    {"date": "2026-02-05", "merchant": "Walmart Supercentre", "amount": 141.35, "category": "grocery"},
    {"date": "2026-02-01", "merchant": "Walmart Supercentre", "amount": 147.90, "category": "grocery"},
    {"date": "2026-01-31", "merchant": "Walmart Supercentre", "amount": 155.25, "category": "grocery"},

    # Extra Amazon orders
    {"date": "2026-02-26", "merchant": "Amazon", "amount": 52.40, "category": "shopping"},
    {"date": "2026-02-24", "merchant": "Amazon", "amount": 47.99, "category": "shopping"},
    {"date": "2026-02-21", "merchant": "Amazon", "amount": 63.10, "category": "shopping"},
    {"date": "2026-02-18", "merchant": "Amazon", "amount": 58.75, "category": "shopping"},
    {"date": "2026-02-16", "merchant": "Amazon", "amount": 42.60, "category": "shopping"},
    {"date": "2026-02-13", "merchant": "Amazon", "amount": 69.20, "category": "shopping"},
    {"date": "2026-02-11", "merchant": "Amazon", "amount": 37.95, "category": "shopping"},
    {"date": "2026-02-08", "merchant": "Amazon", "amount": 55.10, "category": "shopping"},
    {"date": "2026-02-03", "merchant": "Amazon", "amount": 61.45, "category": "shopping"},
    {"date": "2026-02-01", "merchant": "Amazon", "amount": 49.80, "category": "shopping"},

    # Extra Calgary Transit rides
    {"date": "2026-02-27", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-26", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},
    {"date": "2026-02-24", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-21", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},
    {"date": "2026-02-19", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-17", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},
    {"date": "2026-02-15", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-13", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},
    {"date": "2026-02-09", "merchant": "Calgary Transit", "amount": 3.50, "category": "transport"},
    {"date": "2026-02-07", "merchant": "Calgary Transit", "amount": 3.25, "category": "transport"},

    # Extra DoorDash deliveries
    {"date": "2026-02-27", "merchant": "DoorDash", "amount": 33.40, "category": "food"},
    {"date": "2026-02-25", "merchant": "DoorDash", "amount": 29.95, "category": "food"},
    {"date": "2026-02-22", "merchant": "DoorDash", "amount": 34.60, "category": "food"},
    {"date": "2026-02-18", "merchant": "DoorDash", "amount": 30.25, "category": "food"},
    {"date": "2026-02-16", "merchant": "DoorDash", "amount": 32.80, "category": "food"},
    {"date": "2026-02-13", "merchant": "DoorDash", "amount": 29.70, "category": "food"},
    {"date": "2026-02-11", "merchant": "DoorDash", "amount": 35.15, "category": "food"},
    {"date": "2026-02-07", "merchant": "DoorDash", "amount": 31.40, "category": "food"},
    {"date": "2026-02-05", "merchant": "DoorDash", "amount": 33.90, "category": "food"},
    {"date": "2026-02-03", "merchant": "DoorDash", "amount": 30.80, "category": "food"},

    # Extra SkipTheDishes deliveries
    {"date": "2026-02-28", "merchant": "SkipTheDishes", "amount": 28.20, "category": "food"},
    {"date": "2026-02-26", "merchant": "SkipTheDishes", "amount": 30.10, "category": "food"},
    {"date": "2026-02-24", "merchant": "SkipTheDishes", "amount": 27.75, "category": "food"},
    {"date": "2026-02-20", "merchant": "SkipTheDishes", "amount": 29.60, "category": "food"},
    {"date": "2026-02-17", "merchant": "SkipTheDishes", "amount": 26.95, "category": "food"},
    {"date": "2026-02-15", "merchant": "SkipTheDishes", "amount": 28.70, "category": "food"},
    {"date": "2026-02-11", "merchant": "SkipTheDishes", "amount": 30.25, "category": "food"},
    {"date": "2026-02-09", "merchant": "SkipTheDishes", "amount": 27.40, "category": "food"},
    {"date": "2026-02-04", "merchant": "SkipTheDishes", "amount": 29.95, "category": "food"},
    {"date": "2026-02-02", "merchant": "SkipTheDishes", "amount": 28.60, "category": "food"},

    # Extra Shoppers Drug Mart visits
    {"date": "2026-02-26", "merchant": "Shoppers Drug Mart", "amount": 34.20, "category": "health"},
    {"date": "2026-02-24", "merchant": "Shoppers Drug Mart", "amount": 42.10, "category": "health"},
    {"date": "2026-02-21", "merchant": "Shoppers Drug Mart", "amount": 37.85, "category": "health"},
    {"date": "2026-02-16", "merchant": "Shoppers Drug Mart", "amount": 33.40, "category": "health"},
    {"date": "2026-02-14", "merchant": "Shoppers Drug Mart", "amount": 39.95, "category": "health"},
    {"date": "2026-02-12", "merchant": "Shoppers Drug Mart", "amount": 36.75, "category": "health"},
    {"date": "2026-02-09", "merchant": "Shoppers Drug Mart", "amount": 41.30, "category": "health"},
    {"date": "2026-02-05", "merchant": "Shoppers Drug Mart", "amount": 35.60, "category": "health"},
    {"date": "2026-02-03", "merchant": "Shoppers Drug Mart", "amount": 38.45, "category": "health"},
    {"date": "2026-02-01", "merchant": "Shoppers Drug Mart", "amount": 40.10, "category": "health"},

    # Niche/local coffee & food
    {"date": "2026-02-28", "merchant": "Little Owl Coffee", "amount": 7.10, "category": "food"},
    {"date": "2026-02-26", "merchant": "Neighbourhood Bakery", "amount": 9.50, "category": "food"},
    {"date": "2026-02-24", "merchant": "Food Truck - Taco Loco", "amount": 13.25, "category": "food"},
    {"date": "2026-02-22", "merchant": "Local Farmers Market", "amount": 26.80, "category": "grocery"},
    {"date": "2026-02-19", "merchant": "Bubble Tea Corner", "amount": 8.40, "category": "food"},

    # Pets
    {"date": "2026-02-27", "merchant": "PetSmart", "amount": 54.99, "category": "pets"},
    {"date": "2026-02-18", "merchant": "Downtown Vet Clinic", "amount": 120.00, "category": "pets"},
    {"date": "2026-02-09", "merchant": "Local Pet Groomer", "amount": 72.50, "category": "pets"},

    # Hobbies & books
    {"date": "2026-02-25", "merchant": "The Local Bookshop", "amount": 27.45, "category": "entertainment"},
    {"date": "2026-02-20", "merchant": "Board Game Café", "amount": 21.30, "category": "entertainment"},
    {"date": "2026-02-13", "merchant": "Art Supply House", "amount": 46.90, "category": "shopping"},

    # Home & hardware
    {"date": "2026-02-23", "merchant": "Home Depot", "amount": 89.75, "category": "home"},
    {"date": "2026-02-17", "merchant": "Canadian Tire", "amount": 64.20, "category": "home"},
    {"date": "2026-02-08", "merchant": "IKEA", "amount": 132.99, "category": "home"},

    # Utilities & bills
    {"date": "2026-02-05", "merchant": "Enmax Energy", "amount": 92.15, "category": "utilities"},
    {"date": "2026-02-03", "merchant": "Calgary Water Services", "amount": 48.60, "category": "utilities"},
    {"date": "2026-02-01", "merchant": "Telus Mobility", "amount": 78.00, "category": "phone"},
    {"date": "2026-02-01", "merchant": "Shaw Internet", "amount": 85.99, "category": "internet"},

    # Personal care
    {"date": "2026-02-27", "merchant": "Downtown Barber Shop", "amount": 32.00, "category": "personal_care"},
    {"date": "2026-02-15", "merchant": "Spa On 8th", "amount": 110.50, "category": "personal_care"},

    # Parking & transit extras
    {"date": "2026-02-26", "merchant": "City of Calgary Parking", "amount": 9.25, "category": "transport"},
    {"date": "2026-02-19", "merchant": "Indigo Parkade", "amount": 14.00, "category": "transport"},

    # Alcohol & nightlife
    {"date": "2026-02-24", "merchant": "Co-op Wine Spirits Beer", "amount": 43.75, "category": "entertainment"},
    {"date": "2026-02-17", "merchant": "Local Pub - The Fox", "amount": 58.20, "category": "entertainment"},

    # Gifts & charity
    {"date": "2026-02-21", "merchant": "Etsy Marketplace", "amount": 34.10, "category": "shopping"},
    {"date": "2026-02-14", "merchant": "Flower Shop - Bloom", "amount": 62.50, "category": "gift"},
    {"date": "2026-02-10", "merchant": "Red Cross Donation", "amount": 25.00, "category": "charity"},

    # Digital tools & SaaS
    {"date": "2026-02-11", "merchant": "Notion Labs", "amount": 12.00, "category": "subscription"},
    {"date": "2026-02-09", "merchant": "Figma", "amount": 20.00, "category": "subscription"},
    {"date": "2026-02-04", "merchant": "Canva Pro", "amount": 16.99, "category": "subscription"},

    # Learning & courses
    {"date": "2026-02-18", "merchant": "Udemy", "amount": 19.99, "category": "education"},
    {"date": "2026-02-06", "merchant": "Coursera", "amount": 49.00, "category": "education"},

    # Local experiences
    {"date": "2026-02-23", "merchant": "Escape Room YYC", "amount": 78.00, "category": "entertainment"},
    {"date": "2026-02-12", "merchant": "Indoor Climbing Gym", "amount": 29.50, "category": "fitness"},
    {"date": "2026-02-02", "merchant": "Axe Throwing League", "amount": 44.25, "category": "entertainment"},

    # Insurance & admin
    {"date": "2026-02-07", "merchant": "TD Insurance", "amount": 128.40, "category": "insurance"},
    {"date": "2026-02-05", "merchant": "Driver's License Renewal", "amount": 93.00, "category": "admin"},

    # Misc small charges
    {"date": "2026-02-28", "merchant": "App Store - Tip Jar", "amount": 2.99, "category": "entertainment"},
    {"date": "2026-02-19", "merchant": "Vending Machine", "amount": 3.25, "category": "food"},
    {"date": "2026-02-16", "merchant": "Office Coffee Fund", "amount": 4.00, "category": "food"},
]


# ── Merchant average lookup ─────────────────────────────────────────────────


def _build_merchant_averages() -> dict[str, dict]:
    """Pre-compute merchant → average spend from transaction history."""
    groups: dict[str, list[float]] = defaultdict(list)
    for tx in TRANSACTIONS:
        if tx["amount"] > 0:
            groups[tx["merchant"].lower()].append(tx["amount"])
    return {
        merchant: {
            "average_spend": round(sum(amounts) / len(amounts), 2),
            "sample_size": len(amounts),
            "merchant": merchant,
        }
        for merchant, amounts in groups.items()
    }


_MERCHANT_AVERAGES: dict[str, dict] = _build_merchant_averages()


def get_merchant_average(merchant_name: str) -> dict:
    """
    Look up average spend for a merchant by name.

    Tries: exact match → substring match → token match → unknown.
    Returns a dict with: average_spend, confidence, sample_size,
    matched_merchant (original casing), match_type.
    """
    key = merchant_name.lower().strip()
    if not key:
        return {"average_spend": 0.0, "confidence": 0.0, "sample_size": 0,
                "matched_merchant": None, "match_type": "unknown"}

    # 1. Exact match
    if key in _MERCHANT_AVERAGES:
        data = _MERCHANT_AVERAGES[key]
        confidence = min(0.95, 0.5 + data["sample_size"] * 0.1)
        return {
            "average_spend": data["average_spend"],
            "confidence": confidence,
            "sample_size": data["sample_size"],
            "matched_merchant": data["merchant"],
            "match_type": "exact",
        }

    # 2. Substring: known merchant name appears inside the query, or vice versa
    for known, data in _MERCHANT_AVERAGES.items():
        if known in key or key in known:
            confidence = min(0.8, 0.4 + data["sample_size"] * 0.1)
            return {
                "average_spend": data["average_spend"],
                "confidence": confidence,
                "sample_size": data["sample_size"],
                "matched_merchant": data["merchant"],
                "match_type": "substring",
            }

    # 3. Token-level: any significant word from the query matches inside a known merchant
    tokens = [t for t in re.findall(r"\w+", key) if len(t) >= 3]
    for token in tokens:
        for known, data in _MERCHANT_AVERAGES.items():
            if token in known:
                confidence = min(0.6, 0.3 + data["sample_size"] * 0.08)
                return {
                    "average_spend": data["average_spend"],
                    "confidence": confidence,
                    "sample_size": data["sample_size"],
                    "matched_merchant": data["merchant"],
                    "match_type": "token",
                }

    return {
        "average_spend": 0.0,
        "confidence": 0.0,
        "sample_size": 0,
        "matched_merchant": None,
        "match_type": "unknown",
    }


# ── Legacy helpers (kept for main.py vault/balance API compatibility) ───────


class BankResponse(BaseModel):
    success: bool
    message: str
    data: dict = None


mock_db: dict = {
    "user_123": {
        "balance": 2500.00,
        "vault_locked": False,
        "transactions": [tx for tx in TRANSACTIONS if tx["amount"] > 0][:10],
    }
}


def get_balance(user_id: str = "user_123") -> BankResponse:
    if user_id not in mock_db:
        mock_db[user_id] = {"balance": 2500, "vault_locked": False, "transactions": []}
    return BankResponse(
        success=True,
        message="Balance retrieved",
        data={"balance": mock_db[user_id]["balance"]},
    )


def lock_vault(user_id: str = "user_123") -> BankResponse:
    if user_id not in mock_db:
        mock_db[user_id] = {"balance": 2500, "vault_locked": False, "transactions": []}
    mock_db[user_id]["vault_locked"] = True
    return BankResponse(success=True, message="Vault locked successfully", data={"vault_locked": True})


def unlock_vault(user_id: str = "user_123") -> BankResponse:
    if user_id not in mock_db:
        mock_db[user_id] = {"balance": 2500, "vault_locked": False, "transactions": []}
    mock_db[user_id]["vault_locked"] = False
    return BankResponse(success=True, message="Vault unlocked successfully", data={"vault_locked": False})


def get_transactions(user_id: str = "user_123", limit: int = 10) -> BankResponse:
    if user_id not in mock_db:
        mock_db[user_id] = {"balance": 2500, "vault_locked": False, "transactions": []}
    recent = mock_db[user_id]["transactions"][-limit:]
    return BankResponse(success=True, message="Transactions retrieved", data={"transactions": recent})
