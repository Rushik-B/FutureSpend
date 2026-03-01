"""
Agent tool functions for FutureSpend.

Each function is a discrete capability the LLM orchestrator can invoke via
function calling. They are pure-ish functions: take structured input, return
structured output. No LLM calls inside — that stays in the orchestrator.

Inspired by OpenClaw's Captain's Chair pattern but flattened:
one orchestrator, many tool functions, no sub-agent spawning.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from .schemas import (
    Badge,
    CalendarEvent,
    CalendarType,
    CategoryBreakdown,
    Challenge,
    ChallengesResponse,
    DailyForecast,
    ForecastResponse,
    Insight,
    InsightType,
    LeaderboardEntry,
    RecommendedAction,
    RiskLevel,
    VaultAction,
    VaultCommand,
)


# ── Helpers ─────────────────────────────────────────────────────────────────

_MEAL_RE = re.compile(
    r"dinner|lunch|brunch|breakfast|restaurant|cafe|food|eat", re.I
)
_COFFEE_RE = re.compile(r"coffee|starbucks|tim hortons|caffeine", re.I)
_ENTERTAINMENT_RE = re.compile(
    r"concert|movie|theatre|show|game|sports|party|club|bar", re.I
)
_TRANSPORT_RE = re.compile(
    r"taxi|uber|lyft|transit|bus|train|parking|drive", re.I
)
_HEALTH_RE = re.compile(
    r"doctor|dentist|gym|workout|physio|therapy|clinic|hospital", re.I
)
_SOCIAL_RE = re.compile(r"birthday|hangout|catchup|friends|date\b", re.I)


def _classify_event_type(title: str) -> str:
    if _MEAL_RE.search(title):
        return "food"
    if _COFFEE_RE.search(title):
        return "food"
    if _ENTERTAINMENT_RE.search(title):
        return "entertainment"
    if _TRANSPORT_RE.search(title):
        return "transport"
    if _HEALTH_RE.search(title):
        return "health"
    return "other"


def _classify_calendar_type(title: str) -> CalendarType:
    title_l = title.lower()
    if _HEALTH_RE.search(title_l):
        return CalendarType.HEALTH
    if _SOCIAL_RE.search(title_l) or _ENTERTAINMENT_RE.search(title_l):
        return CalendarType.SOCIAL
    if any(kw in title_l for kw in ("meeting", "standup", "sprint", "client", "office", "team")):
        return CalendarType.WORK
    return CalendarType.PERSONAL


def _explain_prediction(title: str, category: str, amount: float) -> str:
    """Generate a human-readable 'why' explanation for a spend prediction."""
    keywords = []
    for pattern, label in [
        (_MEAL_RE, "meal/dining"),
        (_COFFEE_RE, "café"),
        (_ENTERTAINMENT_RE, "entertainment"),
        (_TRANSPORT_RE, "transport"),
        (_HEALTH_RE, "health"),
        (_SOCIAL_RE, "social"),
    ]:
        if pattern.search(title):
            keywords.append(label)
    if not keywords:
        return f"General event → default estimate ${amount:.0f}"
    return f"Keywords: {', '.join(keywords)} → {category} ${amount:.0f}"


def _stable_id(prefix: str, seed: str) -> str:
    """Deterministic short ID from a seed string."""
    h = hashlib.md5(seed.encode()).hexdigest()[:6]
    return f"{prefix}-{h}"


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# ── Base spend estimation (wraps teammate's logic, improved) ────────────────


def _estimate_event_spend(
    title: str,
    category: str,
    start: str,
    attendees: int = 1,
    has_location: bool = False,
) -> float:
    dt = _parse_dt(start)
    hour = dt.hour
    is_weekend = dt.weekday() >= 5

    if category == "food":
        if _COFFEE_RE.search(title):
            base = 6.0 * max(attendees, 1)
        elif hour >= 17:
            base = 40.0 + max(attendees - 1, 0) * 15.0
        elif 11 <= hour < 15:
            base = 22.0 + max(attendees - 1, 0) * 12.0
        else:
            base = 15.0
        if is_weekend:
            base *= 1.15
    elif category == "entertainment":
        base = 80.0
        if is_weekend:
            base += 25.0
    elif category == "transport":
        base = 18.0
        if hour < 7 or hour > 21:
            base *= 1.4  # surge pricing
    elif category == "health":
        base = 0.0  # assume insured / pre-paid
    else:
        base = 12.0

    if has_location:
        base *= 1.05  # venue bias

    return round(base, 2)


# ═══════════════════════════════════════════════════════════════════════════
# TOOL FUNCTIONS — each maps to a function-calling tool definition
# ═══════════════════════════════════════════════════════════════════════════


def analyze_calendar_events(
    raw_events: list[dict[str, Any]],
) -> list[CalendarEvent]:
    """
    Tool: analyze_calendar_events
    Takes raw Google Calendar event dicts and returns enriched CalendarEvent
    objects with spend predictions, categories, and explanations.
    """
    results: list[CalendarEvent] = []

    for ev in raw_events:
        title = ev.get("title", ev.get("summary", ""))
        start = ev.get("start", ev.get("start_time", ""))
        end = ev.get("end", ev.get("end_time", ""))
        if not end and start:
            # Default to 1h duration if no end time
            try:
                end = (_parse_dt(start) + timedelta(hours=1)).isoformat()
            except ValueError:
                end = start

        attendees = ev.get("attendees", 1)
        if isinstance(attendees, list):
            attendees = len(attendees)
        location = ev.get("location", "")

        category = _classify_event_type(title)
        cal_type = ev.get("calendarType")
        if cal_type:
            cal_type = CalendarType(cal_type)
        else:
            cal_type = _classify_calendar_type(title)

        spend = _estimate_event_spend(
            title, category, start, attendees, bool(location)
        )
        why = _explain_prediction(title, category, spend)
        event_id = ev.get("id", _stable_id("evt", f"{title}{start}"))

        results.append(
            CalendarEvent(
                id=event_id,
                title=title,
                start=start,
                end=end,
                calendarType=cal_type,
                predictedSpend=spend,
                category=category,
                why=why,
            )
        )

    return results


def generate_forecast(
    events: list[CalendarEvent],
    monthly_budget: float = 1000.0,
    spent_so_far: float = 0.0,
) -> ForecastResponse:
    """
    Tool: generate_forecast
    Aggregates enriched calendar events into a 7-day financial forecast.
    Returns the full dashboard payload shape.
    """
    daily_map: dict[str, dict[str, float]] = defaultdict(
        lambda: {"predictedSpend": 0.0, "food": 0.0, "transport": 0.0,
                 "social": 0.0, "entertainment": 0.0, "other": 0.0}
    )

    cat_totals: dict[str, float] = defaultdict(float)

    for ev in events:
        date_key = ev.start[:10]
        spend = ev.predicted_spend

        daily_map[date_key]["predictedSpend"] += spend

        bucket = ev.category if ev.category in (
            "food", "transport", "entertainment"
        ) else "other"
        if ev.calendar_type == CalendarType.SOCIAL and bucket not in (
            "transport",
        ):
            bucket_key = "social"
        else:
            bucket_key = bucket
        daily_map[date_key][bucket_key] += spend
        cat_totals[bucket_key] += spend

    total_predicted = sum(d["predictedSpend"] for d in daily_map.values())
    remaining = monthly_budget - spent_so_far - total_predicted

    if remaining < 0:
        risk = RiskLevel.HIGH
    elif total_predicted > monthly_budget * 0.4:
        risk = RiskLevel.MED
    else:
        risk = RiskLevel.LOW

    daily = sorted(daily_map.items())
    daily_forecasts = [
        DailyForecast(
            date=date,
            predictedSpend=vals["predictedSpend"],
            food=vals["food"],
            transport=vals["transport"],
            social=vals["social"],
            entertainment=vals["entertainment"],
            other=vals["other"],
        )
        for date, vals in daily
    ]

    cat_name_map = {
        "food": "Food",
        "transport": "Transport",
        "social": "Social",
        "entertainment": "Entertainment",
        "other": "Other",
    }
    by_category = [
        CategoryBreakdown(name=cat_name_map.get(k, k.title()), value=v, key=k)
        for k, v in sorted(cat_totals.items(), key=lambda x: -x[1])
        if v > 0
    ]

    actions = _generate_recommended_actions(events, total_predicted, monthly_budget)

    return ForecastResponse(
        next7DaysTotal=round(total_predicted, 2),
        remainingBudget=round(max(remaining, 0), 2),
        monthlyBudget=monthly_budget,
        riskScore=risk,
        daily=daily_forecasts,
        byCategory=by_category,
        recommendedActions=actions,
    )


def _generate_recommended_actions(
    events: list[CalendarEvent],
    total: float,
    budget: float,
) -> list[RecommendedAction]:
    actions: list[RecommendedAction] = []

    meal_events = [e for e in events if e.category == "food"]
    weekend_meals = [
        e for e in meal_events
        if _parse_dt(e.start).weekday() >= 5
    ]
    if weekend_meals:
        savings = sum(e.predicted_spend for e in weekend_meals) * 0.4
        actions.append(RecommendedAction(
            id=_stable_id("ra", "weekend-cook"),
            label=f"Cook at home {len(weekend_meals)} weekend meal(s)",
            impact=f"~${savings:.0f} saved",
            type="habit",
        ))

    coffee_events = [e for e in events if _COFFEE_RE.search(e.title)]
    if len(coffee_events) >= 3:
        savings = sum(e.predicted_spend for e in coffee_events[2:])
        actions.append(RecommendedAction(
            id=_stable_id("ra", "coffee-cut"),
            label="Skip 2 café runs this week",
            impact=f"~${savings:.0f} saved",
            type="habit",
        ))

    if total > budget * 0.5:
        lock_amount = min(total * 0.15, budget * 0.1)
        actions.append(RecommendedAction(
            id=_stable_id("ra", "vault-lock"),
            label=f"Lock ${lock_amount:.0f} in savings vault",
            impact=f"${lock_amount:.0f} protected",
            type="cap",
        ))

    return actions


def generate_insights(
    events: list[CalendarEvent],
    forecast: ForecastResponse,
) -> list[Insight]:
    """
    Tool: generate_insights
    Produces actionable insights from calendar + forecast data.
    """
    insights: list[Insight] = []

    # Uber / transport spike detection
    transport = [e for e in events if e.category == "transport"]
    if len(transport) >= 3:
        insights.append(Insight(
            id=_stable_id("ins", "transport-spike"),
            icon="Car",
            title="Ride-share adding up",
            description=(
                f"You have {len(transport)} transport events this week "
                f"totalling ~${sum(e.predicted_spend for e in transport):.0f}."
            ),
            type=InsightType.SPEND,
        ))

    # Lunch out pattern
    lunch_events = [
        e for e in events
        if "lunch" in e.title.lower() and 11 <= _parse_dt(e.start).hour < 15
    ]
    if lunch_events:
        insights.append(Insight(
            id=_stable_id("ins", "lunch-out"),
            icon="UtensilsCrossed",
            title="Lunch out = higher daily spend",
            description=(
                f"Days with lunch events average "
                f"${sum(e.predicted_spend for e in lunch_events) / len(lunch_events):.0f} "
                f"more in food spend."
            ),
            type=InsightType.SPEND,
        ))

    # Social events driving spend
    social = [e for e in events if e.calendar_type == CalendarType.SOCIAL]
    if social:
        total_social = sum(e.predicted_spend for e in social)
        insights.append(Insight(
            id=_stable_id("ins", "social-spend"),
            icon="Calendar",
            title="Social events drive spending",
            description=(
                f"{len(social)} social events predict ~${total_social:.0f} in spend. "
                f"Top triggers: {', '.join(e.title for e in sorted(social, key=lambda x: -x.predicted_spend)[:2])}."
            ),
            type=InsightType.ALERT,
        ))

    # Coffee habit
    coffees = [e for e in events if _COFFEE_RE.search(e.title)]
    if len(coffees) >= 2:
        monthly_est = sum(e.predicted_spend for e in coffees) * 4
        insights.append(Insight(
            id=_stable_id("ins", "coffee-habit"),
            icon="Coffee",
            title="Coffee runs add up",
            description=(
                f"{len(coffees)} café visits this week → ~${monthly_est:.0f}/month. "
                f"Cutting to {max(len(coffees) - 2, 1)} could save ~${sum(e.predicted_spend for e in coffees[2:]):.0f}/week."
            ),
            type=InsightType.HABIT,
        ))

    # Weekend cooking savings potential
    weekend_food = [
        e for e in events
        if e.category == "food" and _parse_dt(e.start).weekday() >= 5
    ]
    if weekend_food:
        potential = sum(e.predicted_spend for e in weekend_food) * 0.6
        insights.append(Insight(
            id=_stable_id("ins", "weekend-cook"),
            icon="TrendingDown",
            title="Weekend cooking saves money",
            description=f"Cooking instead of eating out this weekend could save ~${potential:.0f}.",
            type=InsightType.SAVING,
        ))

    # Risk alert
    if forecast.risk_score == RiskLevel.HIGH:
        insights.append(Insight(
            id=_stable_id("ins", "high-risk"),
            icon="CreditCard",
            title="High burn rate this week",
            description=(
                f"Predicted spend ${forecast.next_7days_total:.0f} is over "
                f"40% of your ${forecast.monthly_budget:.0f} monthly budget."
            ),
            type=InsightType.ALERT,
        ))

    # Best saving days
    if forecast.daily:
        sorted_days = sorted(forecast.daily, key=lambda d: d.predicted_spend)
        low_days = sorted_days[:2]
        day_names = [_parse_dt(d.date + "T00:00:00").strftime("%A") for d in low_days]
        insights.append(Insight(
            id=_stable_id("ins", "best-save-days"),
            icon="Target",
            title="Best days to save",
            description=f"{' and '.join(day_names)} are your lowest-spend days — good for no-spend goals.",
            type=InsightType.HABIT,
        ))

    return insights


def create_vault_command(
    action: str,
    amount: float,
    reason: str,
    vault_name: str = "default",
) -> VaultCommand:
    """
    Tool: create_vault_command
    Creates a command to lock or unlock funds in a savings vault.
    In production this would call the RBC banking API.
    """
    return VaultCommand(
        action=VaultAction(action),
        amount=amount,
        reason=reason,
        vault_name=vault_name,
    )


def generate_challenge_from_insights(
    insights: list[Insight],
    user_name: str = "You",
) -> ChallengesResponse:
    """
    Tool: generate_challenge_from_insights
    Auto-generates savings challenges based on detected spending patterns.
    This is the gamification engine.
    """
    challenges: list[Challenge] = []
    now = datetime.now()
    end_of_week = (now + timedelta(days=7 - now.weekday())).strftime("%Y-%m-%d")
    end_of_month = (now.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%Y-%m-%d")

    for ins in insights:
        if ins.type == InsightType.HABIT and "coffee" in ins.title.lower():
            challenges.append(Challenge(
                id=_stable_id("ch", "no-coffee"),
                name="No Coffee Week",
                goal=50.0,
                unit="CAD",
                endDate=end_of_week,
                participants=12,
                joined=False,
                progress=0,
                streak=0,
                description="Skip café purchases for 7 days",
            ))
        if ins.type == InsightType.SAVING and "cook" in ins.title.lower():
            challenges.append(Challenge(
                id=_stable_id("ch", "weekend-cook"),
                name="Weekend Cook-off",
                goal=2.0,
                unit="meals",
                endDate=end_of_week,
                participants=5,
                joined=False,
                description="Cook at home 2 weekend meals",
            ))

    # Always offer a monthly saver challenge
    challenges.append(Challenge(
        id=_stable_id("ch", "monthly-saver"),
        name="March Saver",
        goal=200.0,
        unit="CAD",
        endDate=end_of_month,
        participants=8,
        joined=False,
        description="Save $200 by end of month",
    ))

    badges = [
        Badge(id="b1", name="First Save", description="Completed your first challenge", earned=False, icon="Trophy"),
        Badge(id="b2", name="3-Day Streak", description="3 days in a row on track", earned=False, icon="Flame"),
        Badge(id="b3", name="Team Player", description="Joined a group challenge", earned=False, icon="Users"),
        Badge(id="b4", name="5-Day Streak", description="5 days in a row on track", earned=False, icon="Flame"),
        Badge(id="b5", name="Budget Master", description="Under budget for a full month", earned=False, icon="Target"),
    ]

    leaderboard = [
        LeaderboardEntry(rank=1, name="Alex K.", value=48),
        LeaderboardEntry(rank=2, name=user_name, value=35),
        LeaderboardEntry(rank=3, name="Sam R.", value=32),
        LeaderboardEntry(rank=4, name="Jordan M.", value=28),
        LeaderboardEntry(rank=5, name="Casey L.", value=20),
    ]

    return ChallengesResponse(
        list=challenges,
        leaderboard=leaderboard,
        badges=badges,
    )


# ── Tool registry for the orchestrator ──────────────────────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "analyze_calendar_events",
            "description": (
                "Takes raw Google Calendar event data and returns enriched events "
                "with spend predictions, categories, calendar types, and explanations."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "raw_events": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "start": {"type": "string", "description": "ISO datetime"},
                                "end": {"type": "string", "description": "ISO datetime"},
                                "location": {"type": "string"},
                                "attendees": {"type": "integer"},
                                "calendarType": {
                                    "type": "string",
                                    "enum": ["work", "personal", "social", "health"],
                                },
                            },
                            "required": ["title", "start"],
                        },
                    },
                },
                "required": ["raw_events"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_forecast",
            "description": (
                "Aggregates enriched calendar events into a 7-day spending forecast "
                "with daily breakdown, category totals, risk score, and savings actions."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "monthly_budget": {
                        "type": "number",
                        "description": "User's monthly budget in CAD",
                    },
                    "spent_so_far": {
                        "type": "number",
                        "description": "Amount already spent this month",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_insights",
            "description": (
                "Produces actionable financial insights from calendar events and "
                "forecast data. Detects patterns like transport spikes, social spend "
                "triggers, and saving opportunities."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_vault_command",
            "description": (
                "Lock or unlock funds in a savings vault. Use this when the user "
                "wants to protect money from impulse spending or release vault funds."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["lock", "unlock"],
                    },
                    "amount": {
                        "type": "number",
                        "description": "Amount in CAD to lock/unlock",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why the funds are being locked/unlocked",
                    },
                    "vault_name": {
                        "type": "string",
                        "description": "Name of the vault",
                        "default": "default",
                    },
                },
                "required": ["action", "amount", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_challenges",
            "description": (
                "Auto-generate savings challenges and gamification elements "
                "based on detected spending patterns and insights."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_name": {
                        "type": "string",
                        "description": "User's display name for leaderboard",
                    },
                },
            },
        },
    },
]
