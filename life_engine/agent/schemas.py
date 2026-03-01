"""
Unified Pydantic schemas for FutureSpend.

Bridges the engine's raw calendar data with the frontend's expected payloads.
All field names and shapes match the frontend TypeScript types exactly.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Calendar ────────────────────────────────────────────────────────────────


class CalendarType(str, Enum):
    WORK = "work"
    PERSONAL = "personal"
    SOCIAL = "social"
    HEALTH = "health"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MED = "MED"
    HIGH = "HIGH"


class CalendarEvent(BaseModel):
    """Single calendar event enriched with spend prediction."""

    id: str
    title: str
    start: str
    end: str
    calendar_type: CalendarType = Field(alias="calendarType")
    predicted_spend: float = Field(0.0, alias="predictedSpend")
    category: str = ""
    why: str = ""

    model_config = {"populate_by_name": True}


# ── Forecast ────────────────────────────────────────────────────────────────


class DailyForecast(BaseModel):
    date: str
    predicted_spend: float = Field(alias="predictedSpend")
    food: float = 0.0
    transport: float = 0.0
    social: float = 0.0
    entertainment: float = 0.0
    other: float = 0.0

    model_config = {"populate_by_name": True}


class CategoryBreakdown(BaseModel):
    name: str
    value: float
    key: str


class RecommendedAction(BaseModel):
    id: str
    label: str
    impact: str = ""
    type: str = "habit"  # cap | habit | subscription


class ForecastResponse(BaseModel):
    """7-day forecast — the main dashboard payload."""

    next_7days_total: float = Field(alias="next7DaysTotal")
    remaining_budget: float = Field(alias="remainingBudget")
    monthly_budget: float = Field(alias="monthlyBudget")
    risk_score: RiskLevel = Field(alias="riskScore")
    daily: list[DailyForecast]
    by_category: list[CategoryBreakdown] = Field(alias="byCategory")
    recommended_actions: list[RecommendedAction] = Field(
        default_factory=list, alias="recommendedActions"
    )

    model_config = {"populate_by_name": True}


# ── Insights ────────────────────────────────────────────────────────────────


class InsightType(str, Enum):
    SPEND = "spend"
    SAVING = "saving"
    HABIT = "habit"
    ALERT = "alert"


class Insight(BaseModel):
    id: str
    icon: str
    title: str
    description: str
    type: InsightType = InsightType.SPEND


# ── Challenges / Gamification ───────────────────────────────────────────────


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    value: float
    avatar: str = ""


class Badge(BaseModel):
    id: str
    name: str
    description: str
    earned: bool
    icon: str


class Challenge(BaseModel):
    id: str
    name: str
    goal: float
    unit: str
    end_date: str = Field(alias="endDate")
    participants: int
    joined: bool = False
    progress: float = 0.0
    streak: int = 0
    description: str = ""
    badges: list[Badge] = Field(default_factory=list)
    leaderboard: list[LeaderboardEntry] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ChallengesResponse(BaseModel):
    list_: list[Challenge] = Field(alias="list")
    leaderboard: list[LeaderboardEntry] = Field(default_factory=list)
    badges: list[Badge] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


# ── Coach Chat ──────────────────────────────────────────────────────────────


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    id: str
    role: ChatRole
    content: str
    timestamp: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: ChatMessage
    actions: list[RecommendedAction] = Field(default_factory=list)


# ── Vault / Banking ────────────────────────────────────────────────────────


class VaultAction(str, Enum):
    LOCK = "lock"
    UNLOCK = "unlock"


class VaultCommand(BaseModel):
    """Command to lock/unlock funds in a savings vault."""

    action: VaultAction
    amount: float
    reason: str
    vault_name: str = "default"
