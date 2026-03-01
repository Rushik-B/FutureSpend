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
