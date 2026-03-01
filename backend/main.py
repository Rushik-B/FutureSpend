"""
FutureSpend API — FastAPI application.

Serves the AI orchestration layer between Google Calendar data
and the Next.js frontend. Preserves the original /predict endpoint
from the engine branch while adding the full agent-powered pipeline.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent.orchestrator import Orchestrator
from agent.schemas import (
    CalendarEvent,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ForecastResponse,
    Insight,
    RecommendedAction,
)

# Keep teammate's parser/prediction for backwards compat
from parser import parse_calendar_events
from prediction import predict_spending as run_prediction
from element_of_game import generate_challenge
from leaderboard import calculate_leaderboard
from calendar_fetcher import get_upcoming_events
from mock_bank import get_balance, get_transactions

app = FastAPI(
    title="FutureSpend",
    description="AI-powered financial forecasting from calendar data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-session orchestrator instances (in production: keyed by user ID)
_sessions: dict[str, Orchestrator] = {}
_DEFAULT_MONTHLY_BUDGET = 1800.0
_DEFAULT_SPENT_SO_FAR = 620.0
_DEMO_PROFILE = {
    "name": "Alex Demo",
    "email": "alex@example.com",
    "points": 2340,
    "tier": "Silver Saver",
}
_FRIEND_SUGGESTIONS = [
    "Jordan Lee",
    "Sam Park",
    "Taylor Kim",
    "Morgan Walsh",
]

_SANKEY_CATEGORY_COLORS: dict[str, str] = {
    "food": "#F79009",
    "transport": "#2E90FA",
    "social": "#9E77ED",
    "entertainment": "#EC2222",
    "other": "#5C5C5C",
}


def _get_orchestrator(session_id: str = "default") -> Orchestrator:
    if session_id not in _sessions:
        _sessions[session_id] = Orchestrator()
    return _sessions[session_id]


def _compute_health_score(forecast: dict[str, Any]) -> int:
    """
    Compute a demo-friendly 0..100 financial health score from forecast state.
    """
    remaining = float(forecast.get("remainingBudget", 0.0) or 0.0)
    budget = float(forecast.get("monthlyBudget", 0.0) or 0.0)
    ratio = remaining / budget if budget > 0 else 0.0
    ratio = max(0.0, min(1.0, ratio))

    base = int(ratio * 80)
    risk = str(forecast.get("riskScore", "MED"))
    bonus = {"LOW": 20, "MED": 5, "HIGH": -10}.get(risk, 0)
    return max(0, min(100, base + bonus))


def _build_dashboard_sankey(forecast: dict[str, Any]) -> dict[str, Any]:
    """
    Convert forecast.byCategory into frontend Sankey format.
    Node 0 is the weekly total root node.
    """
    total = float(forecast.get("next7DaysTotal", 0.0) or 0.0)
    categories = forecast.get("byCategory", []) or []

    nodes: list[dict[str, Any]] = [
        {
            "name": "This Week",
            "value": round(total, 2),
            "percentage": 100,
            "color": "#2E90FA",
        }
    ]
    links: list[dict[str, Any]] = []

    for idx, cat in enumerate(categories, start=1):
        raw_key = str(cat.get("key", cat.get("name", "other"))).lower()
        key = raw_key.strip()
        color = _SANKEY_CATEGORY_COLORS.get(key, _SANKEY_CATEGORY_COLORS["other"])
        value = float(cat.get("value", 0.0) or 0.0)
        pct = round((value / total) * 100, 1) if total > 0 else 0.0
        name = str(cat.get("name", key.title()))

        nodes.append(
            {
                "name": name,
                "value": round(value, 2),
                "percentage": pct,
                "color": color,
            }
        )
        links.append(
            {
                "source": 0,
                "target": idx,
                "value": round(value, 2),
                "color": color,
                "percentage": pct,
            }
        )

    return {"nodes": nodes, "links": links, "currencySymbol": "CA$"}


def _serialize_event_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _build_spending_history(current_total: float) -> list[dict[str, Any]]:
    ratios = [0.78, 0.99, 0.92, 0.70, 0.85, 1.02]
    base = max(current_total, 1.0)
    history = []
    for index, ratio in enumerate(ratios, start=1):
        predicted = round(base * ratio)
        actual = round(predicted * (0.93 + (index % 3) * 0.04))
        history.append({
            "week": f"Jan W{index}" if index <= 4 else f"Feb W{index - 4}",
            "predicted": predicted,
            "actual": actual,
        })
    history.append({"week": "Mar W1", "predicted": round(base), "actual": None})
    return history


def _build_health_score_history(current_score: int) -> list[dict[str, Any]]:
    months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    offsets = [-18, -12, -8, -4, -2, 0]
    return [
        {
            "date": month,
            "score": max(0, min(100, current_score + offset)),
        }
        for month, offset in zip(months, offsets)
    ]


def _build_all_time_leaderboard(current_user: dict[str, Any]) -> list[dict[str, Any]]:
    entries = [
        {"rank": 1, "name": "Jordan Lee", "avatar": "JL", "points": 3120, "wins": 8, "color": "#10A861"},
        {"rank": 2, "name": "Sam Park", "avatar": "SP", "points": 2780, "wins": 7, "color": "#875BF7"},
        {
            "rank": 3,
            "name": current_user["name"],
            "avatar": "".join(part[0] for part in current_user["name"].split()[:2]).upper(),
            "points": current_user["points"],
            "wins": 6,
            "color": "#2E90FA",
            "isCurrentUser": True,
        },
        {"rank": 4, "name": "Morgan Walsh", "avatar": "MW", "points": 1950, "wins": 5, "color": "#06AED4"},
        {"rank": 5, "name": "Taylor Kim", "avatar": "TK", "points": 1640, "wins": 4, "color": "#F79009"},
        {"rank": 6, "name": "Riley Nguyen", "avatar": "RN", "points": 890, "wins": 2, "color": "#EC2222"},
    ]
    return entries


def _build_past_challenges() -> list[dict[str, Any]]:
    return [
        {"id": "p1", "name": "February Freeze", "target": 350, "actual": 312, "reward": 800, "status": "won", "month": "Feb 2026"},
        {"id": "p2", "name": "Coffee Cap", "target": 60, "actual": 58, "reward": 200, "status": "won", "month": "Feb 2026"},
        {"id": "p3", "name": "Entertainment Budget", "target": 150, "actual": 183, "reward": 300, "status": "lost", "month": "Jan 2026"},
    ]


def _decorate_challenges(challenges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decorated: list[dict[str, Any]] = []
    for index, challenge in enumerate(challenges):
        goal = float(challenge.get("goal", 0.0) or 0.0)
        unit = str(challenge.get("unit", "CAD"))
        if unit == "CAD":
            current = round(goal * min(0.35 + index * 0.12, 0.82), 2)
            reward = max(250, int(round(goal * 2.5)))
        else:
            current = min(goal, max(1.0, round(goal * 0.5, 2)))
            reward = 250 + index * 75

        decorated.append(
            {
                **challenge,
                "joined": challenge.get("joined", index < 2),
                "progress": challenge.get("progress") or current,
                "streak": challenge.get("streak") or max(2, 5 - index),
                "currentSpend": current,
                "reward": reward,
            }
        )
    return decorated


def _build_leaderboard_tip(
    events: list[dict[str, Any]],
    active_challenge: dict[str, Any] | None,
    leaderboard: list[dict[str, Any]],
) -> str:
    if not events or not active_challenge or len(leaderboard) < 2:
        return "Keep your biggest social event in check and you'll stay comfortably under target."

    top_event = max(events, key=lambda event: float(event.get("predictedSpend", 0.0) or 0.0))
    leader = leaderboard[0]
    runner_up = leaderboard[1] if len(leaderboard) > 1 else leaderboard[0]
    gap = abs(float(leader.get("value", 0.0)) - float(runner_up.get("value", 0.0)))
    return (
        f"Skipping {top_event.get('title', 'your highest-spend event')} saves about "
        f"${round(float(top_event.get('predictedSpend', 0.0) or 0.0))} and could close the "
        f"${round(gap)} gap in {active_challenge.get('name', 'your active challenge')}."
    )


def _build_dashboard_payload(
    session_id: str,
    monthly_budget: float,
    spent_so_far: float,
) -> dict[str, Any]:
    orchestrator = _get_orchestrator(session_id)
    pipeline = orchestrator.run_pipeline(
        raw_events=_MOCK_CALENDAR_EVENTS,
        monthly_budget=monthly_budget,
        spent_so_far=spent_so_far,
    )

    health_score = _compute_health_score(pipeline["forecast"])
    spending_history = _build_spending_history(float(pipeline["forecast"]["next7DaysTotal"]))
    previous_actual = next(
        (
            float(item["actual"])
            for item in reversed(spending_history)
            if item.get("actual") is not None
        ),
        0.0,
    )
    health_history = _build_health_score_history(health_score)
    health_trend = health_score - int(health_history[-2]["score"])

    challenges = _decorate_challenges(pipeline["challenges"].get("list", []))
    pipeline["challenges"]["list"] = challenges

    current_user_name = _DEMO_PROFILE["name"]
    for entry in pipeline["challenges"].get("leaderboard", []):
        if entry.get("name") == "You":
            entry["name"] = current_user_name
            entry["isCurrentUser"] = True

    active_challenge = next(
        (
            challenge
            for challenge in challenges
            if challenge.get("unit") == "CAD"
        ),
        challenges[0] if challenges else None,
    )
    if active_challenge is not None and "endDate" in active_challenge:
        active_challenge["deadline"] = active_challenge["endDate"]

    won_challenges = [challenge for challenge in _build_past_challenges() if challenge["status"] == "won"]
    saved_total = sum(challenge["target"] - challenge["actual"] for challenge in won_challenges)

    return {
        **pipeline,
        "healthScore": health_score,
        "profile": _DEMO_PROFILE,
        "dashboardStats": {
            "healthScoreTrend": health_trend,
            "weekOverWeekDelta": round(float(pipeline["forecast"]["next7DaysTotal"]) - previous_actual),
            "predictedConfidence": 82,
            "spendingAccuracy": 85,
            "challengeWinRate": round(len(won_challenges) / max(len(_build_past_challenges()), 1) * 100),
            "savingsRate": 68,
            "totalSaved": saved_total,
            "challengesWon": len(won_challenges),
            "totalChallenges": len(_build_past_challenges()),
        },
        "spendingHistory": spending_history,
        "healthScoreHistory": health_history,
        "pastChallenges": _build_past_challenges(),
        "friendSuggestions": _FRIEND_SUGGESTIONS,
        "allTimeLeaderboard": _build_all_time_leaderboard(_DEMO_PROFILE),
        "leaderboardTip": _build_leaderboard_tip(
            pipeline["events"],
            active_challenge,
            pipeline["challenges"].get("leaderboard", []),
        ),
        "activeChallenge": active_challenge,
        "generatedAt": datetime.utcnow().isoformat() + "Z",
    }


def _fallback_coach_text(orchestrator: Orchestrator, message: str) -> str:
    forecast = orchestrator.state.forecast
    events = sorted(
        orchestrator.state.events,
        key=lambda event: event.predicted_spend,
        reverse=True,
    )
    lower = message.lower()

    if not forecast or not events:
        return "I loaded your dashboard context, but I need calendar events before I can give specific advice."

    top_event = events[0]
    weekend_events = [
        event for event in events if datetime.fromisoformat(event.start).weekday() >= 5
    ]
    health_score = _compute_health_score(forecast.model_dump(by_alias=True))

    if "weekend" in lower:
        weekend_total = round(sum(event.predicted_spend for event in weekend_events), 2)
        if weekend_events:
            return (
                f"Your weekend is tracking to about ${weekend_total:.0f}, led by "
                f"{weekend_events[0].title} at roughly ${weekend_events[0].predicted_spend:.0f}. "
                f"If you trim that one plan, you keep more room inside your ${forecast.monthly_budget:.0f} budget."
            )

    if "health" in lower or "score" in lower:
        return (
            f"Your financial health score is {health_score}/100. "
            f"You have about ${forecast.remaining_budget:.0f} left this month with "
            f"{forecast.risk_score.value.lower()} risk, so the main pressure point is "
            f"{top_event.title} at roughly ${top_event.predicted_spend:.0f}."
        )

    if "balance" in lower or "budget" in lower or "afford" in lower:
        return (
            f"You're forecasting ${forecast.next_7days_total:.0f} over the next 7 days and "
            f"about ${forecast.remaining_budget:.0f} remains in your monthly budget. "
            f"The biggest spend trigger is {top_event.title} at roughly ${top_event.predicted_spend:.0f}."
        )

    return (
        f"Your week is forecasting ${forecast.next_7days_total:.0f} in spend with "
        f"{top_event.title} as the biggest trigger at about ${top_event.predicted_spend:.0f}. "
        f"You still have roughly ${forecast.remaining_budget:.0f} left, so the cleanest move is to cut one social or dining event and lock that amount early."
    )


# ── Health ──────────────────────────────────────────────────────────────────


class ChallengeRequest(BaseModel):
    predicted_total:float
    user_id: Optional[str]='default_user'

class ChallengeResponse(BaseModel):
    challenge_id:str
    target_spending:float
    points:int
    suggested_friends:List[str]
    message:str

class Participant(BaseModel):
    name:str
    spent:float

class LeaderboardRequest(BaseModel):
    participants:List[Participant]
    challenge_target:Optional[float]=None

class LeaderboardEntry(BaseModel):
    name:str
    spent:float
    rank:int
    status:Optional[str]=None

class LeaderboardResponse(BaseModel):
    leaderboard:List[LeaderboardEntry]

@app.get("/")
def health():
    return {"status": "ok", "service": "futurespend"}


# ── Engine branch endpoints (game features) ─────────────────────────────────


@app.post("/leaderboard", response_model=LeaderboardResponse)
def leaderboard(request: LeaderboardRequest):
    participants_dict = [p.model_dump() for p in request.participants]
    result = calculate_leaderboard(participants_dict, request.challenge_target)
    return {"leaderboard": result}


@app.post("/challenge", response_model=ChallengeResponse)
def challenge(request: ChallengeRequest):
    mock_user_history = {
        "avg_weekly_spending": 200,
        "past_success_rate": 0.5,
        "friends": ["Emma", "Liam", "Olivia", "Noah"],
    }
    game = generate_challenge(request.predicted_total, mock_user_history)
    return game


# ── Bank-personalized prediction helper ─────────────────────────────────────


def _adjust_prediction_with_bank(prediction: dict,user_id:str="user_123")->dict:
    txn_resp=get_transactions(user_id,limit=10)
    bal_resp=get_balance(user_id)
    if not txn_resp.data or not txn_resp.data.get("transactions"):
        return prediction
    transactions=txn_resp.data["transactions"]
    balance=bal_resp.data.get("balance",0) if bal_resp.data else 0

    spending_txns=[t for t in transactions if t["amount"]<0]
    if spending_txns:
        recent_avg=abs(sum(t["amount"] for t in spending_txns))/max(len(spending_txns),1)
    else:
        recent_avg=0

    predicted_total=prediction["total_predicted"]
    bank_adjusted=round(0.7*predicted_total+0.3*(recent_avg*len(prediction.get("breakdown",{}))), 2)
    return {
        **prediction,
        "total_predicted":bank_adjusted,
        "bank_adjusted":True,
        "bank_balance":balance,
        "recent_daily_avg":round(recent_avg,2),
        "original_total":predicted_total,
    }
class AnalyzeRequest(BaseModel):
    user_id: Optional[str]="user_123"
    use_mock: Optional[bool]=True
    include_bank_data: Optional[bool]=True

_MOCK_EVENTS_FOR_ENGINE=[
    {"title": "Team lunch - Downtown", "location": "Earls Restaurant",
     "start_time": "2026-03-03T12:00:00", "attendees": 4},
    {"title": "Coffee with Sarah", "location": "Starbucks",
     "start_time": "2026-03-03T15:00:00", "attendees": 2},
    {"title": "Birthday dinner - Alex", "location": "The Keg Steakhouse",
     "start_time": "2026-03-05T19:00:00", "attendees": 6},
    {"title": "Uber to office", "location": "",
     "start_time": "2026-03-06T08:30:00", "attendees": 1},
    {"title": "Weekend brunch with friends", "location": "OEB Breakfast Co.",
     "start_time": "2026-03-08T11:00:00", "attendees": 3},
    {"title": "Movie night", "location": "Cineplex",
     "start_time": "2026-03-08T19:00:00", "attendees": 2},
    {"title": "Tim Hortons run", "location": "Tim Hortons",
     "start_time": "2026-03-04T07:30:00", "attendees": 1},
    {"title": "Starbucks before class", "location": "Starbucks",
     "start_time": "2026-03-05T08:00:00", "attendees": 1},
]

@app.post("/calendar/analyze")
def calendar_analyze(request: AnalyzeRequest):
    """
    Full engine pipeline in one call:
      1. Fetch events (Google Calendar or mock)
      2. Parse events into features
      3. Predict spending (optionally adjusted with bank data)
      4. Generate savings challenge
      5. Generate leaderboard with mock participants

    Returns all results combined.
    """
    # Step 1: Get events
    if request.use_mock:
        raw_events = _MOCK_EVENTS_FOR_ENGINE
    else:
        raw_events = get_upcoming_events()
        if not raw_events:
            raise HTTPException(status_code=502, detail="Could not fetch calendar events")

    # Step 2: Parse
    features = parse_calendar_events(raw_events)

    # Step 3: Predict
    prediction = run_prediction(features)

    # Step 3b: Optionally adjust with bank data
    if request.include_bank_data:
        prediction = _adjust_prediction_with_bank(prediction, request.user_id)

    # Step 4: Challenge
    challenge_result = generate_challenge(prediction["total_predicted"])

    # Step 5: Leaderboard (mock participants for demo)
    mock_participants = [
        {"name": "You", "spent": prediction["total_predicted"]},
        {"name": "Emma", "spent": round(prediction["total_predicted"] * 0.8, 2)},
        {"name": "Liam", "spent": round(prediction["total_predicted"] * 1.1, 2)},
        {"name": "Olivia", "spent": round(prediction["total_predicted"] * 0.6, 2)},
    ]
    leaderboard_result = calculate_leaderboard(
        mock_participants, challenge_result["target_spending"]
    )

    return {
        "events": raw_events,
        "features": features,
        "prediction": prediction,
        "challenge": challenge_result,
        "leaderboard": leaderboard_result,
    }

# ── Original engine endpoint (preserved) ────────────────────────────────────


class LegacyEvent(BaseModel):
    title: str
    location: Optional[str] = None
    start_time: str
    attendees: Optional[int] = None


class LegacyPredictRequest(BaseModel):
    events: list[LegacyEvent]


class LegacyPredictResponse(BaseModel):
    predicted_total: float
    confidence: float
    breakdown: dict
    features: list[dict] = Field(default_factory=list)


@app.post("/predict", response_model=LegacyPredictResponse)
def predict_legacy(request: LegacyPredictRequest):
    """Original prediction endpoint from engine branch."""
    eventdict = [event.model_dump() for event in request.events]
    features = parse_calendar_events(eventdict)
    result = run_prediction(features)
    return {
        "predicted_total": result["total_predicted"],
        "confidence": result["confidence"],
        "breakdown": result["breakdown"],
        "features": features,
    }


# ── Agent-powered endpoints ─────────────────────────────────────────────────


class PipelineRequest(BaseModel):
    """Full pipeline request: raw calendar events + budget context."""

    events: list[dict[str, Any]]
    monthly_budget: float = 1000.0
    spent_so_far: float = 0.0
    session_id: str = "default"


@app.post("/api/pipeline")
def run_pipeline(request: PipelineRequest):
    """
    Deterministic pipeline — runs all tools in sequence without LLM.
    Returns the full dashboard payload: events, forecast, insights, challenges.
    This is the main endpoint the frontend should call on page load.
    """
    orchestrator = _get_orchestrator(request.session_id)
    return orchestrator.run_pipeline(
        raw_events=request.events,
        monthly_budget=request.monthly_budget,
        spent_so_far=request.spent_so_far,
    )


@app.post("/api/events", response_model=list[CalendarEvent])
def analyze_events(request: PipelineRequest):
    """Analyze calendar events and return enriched events with predictions."""
    orchestrator = _get_orchestrator(request.session_id)
    result = orchestrator.run_pipeline(
        raw_events=request.events,
        monthly_budget=request.monthly_budget,
        spent_so_far=request.spent_so_far,
    )
    return result["events"]


@app.post("/api/forecast")
def get_forecast(request: PipelineRequest):
    """Generate 7-day forecast from calendar events."""
    orchestrator = _get_orchestrator(request.session_id)
    result = orchestrator.run_pipeline(
        raw_events=request.events,
        monthly_budget=request.monthly_budget,
        spent_so_far=request.spent_so_far,
    )
    return result["forecast"]


@app.post("/api/insights")
def get_insights(request: PipelineRequest):
    """Generate insights from calendar events."""
    orchestrator = _get_orchestrator(request.session_id)
    result = orchestrator.run_pipeline(
        raw_events=request.events,
        monthly_budget=request.monthly_budget,
        spent_so_far=request.spent_so_far,
    )
    return result["insights"]


@app.post("/api/challenges")
def get_challenges(request: PipelineRequest):
    """Generate savings challenges from detected patterns."""
    orchestrator = _get_orchestrator(request.session_id)
    result = orchestrator.run_pipeline(
        raw_events=request.events,
        monthly_budget=request.monthly_budget,
        spent_so_far=request.spent_so_far,
    )
    return result["challenges"]


# ── Coach Chat (uses LLM orchestrator loop) ─────────────────────────────────


class CoachChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    events: list[dict[str, Any]] = Field(default_factory=list)
    monthly_budget: float = 1000.0


@app.post("/api/coach/chat")
def coach_chat(request: CoachChatRequest):
    """
    AI coach chat — uses the full LLM orchestrator loop.
    The LLM decides which tools to call based on the conversation.
    """
    orchestrator = _get_orchestrator(request.session_id)

    # Refresh coach context whenever the frontend provides explicit events.
    # This keeps budget + event state in sync across pages and repeat chats.
    events_to_use = request.events
    should_refresh_context = bool(events_to_use)
    if not events_to_use and not orchestrator.state.events:
        events_to_use = _MOCK_CALENDAR_EVENTS
        should_refresh_context = True

    if events_to_use and should_refresh_context:
        orchestrator.run_pipeline(
            raw_events=events_to_use,
            monthly_budget=request.monthly_budget,
        )

    chat_req = ChatRequest(message=request.message)
    try:
        result = orchestrator.chat(chat_req)
    except Exception:
        reply = ChatMessage(
            id=f"fallback-{request.session_id}-{int(datetime.utcnow().timestamp())}",
            role="assistant",
            content=_fallback_coach_text(orchestrator, request.message),
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        actions = []
        if orchestrator.state.forecast and orchestrator.state.forecast.recommended_actions:
            actions = [
                action.model_dump()
                for action in orchestrator.state.forecast.recommended_actions
            ]
        return {"reply": reply.model_dump(), "actions": actions}

    return {
        "reply": result.reply.model_dump(),
        "actions": [a.model_dump() for a in result.actions],
    }


# ── Vault Commands ──────────────────────────────────────────────────────────


class VaultRequest(BaseModel):
    action: str  # "lock" | "unlock"
    amount: float
    reason: str
    vault_name: str = "default"
    session_id: str = "default"


@app.post("/api/vault")
def vault_action(request: VaultRequest):
    """
    Lock or unlock funds in a savings vault.
    In production, this calls the RBC banking API.
    """
    from agent.tools import create_vault_command

    cmd = create_vault_command(
        action=request.action,
        amount=request.amount,
        reason=request.reason,
        vault_name=request.vault_name,
    )
    return cmd.model_dump()


# ── Mock Bank API (demo — replaced by RBC in production) ──────────────────


class _MockBank:
    """In-memory bank ledger for the hackathon demo."""

    def __init__(self, balance: float = 2500.0) -> None:
        self.checking: float = balance
        self.vaults: dict[str, float] = {"default": 0.0}
        self.transactions: list[dict[str, Any]] = []

    def lock(self, amount: float, vault: str, reason: str) -> dict[str, Any]:
        if amount > self.checking:
            return {"ok": False, "error": "Insufficient funds"}
        self.checking -= amount
        self.vaults.setdefault(vault, 0.0)
        self.vaults[vault] += amount
        txn = {
            "type": "lock",
            "amount": amount,
            "vault": vault,
            "reason": reason,
            "checking_after": round(self.checking, 2),
            "vault_after": round(self.vaults[vault], 2),
        }
        self.transactions.append(txn)
        return {"ok": True, **txn}

    def unlock(self, amount: float, vault: str, reason: str) -> dict[str, Any]:
        vbal = self.vaults.get(vault, 0.0)
        if amount > vbal:
            return {"ok": False, "error": f"Vault '{vault}' only has ${vbal:.2f}"}
        self.vaults[vault] -= amount
        self.checking += amount
        txn = {
            "type": "unlock",
            "amount": amount,
            "vault": vault,
            "reason": reason,
            "checking_after": round(self.checking, 2),
            "vault_after": round(self.vaults[vault], 2),
        }
        self.transactions.append(txn)
        return {"ok": True, **txn}

    def summary(self) -> dict[str, Any]:
        return {
            "checking": round(self.checking, 2),
            "vaults": {k: round(v, 2) for k, v in self.vaults.items()},
            "total": round(self.checking + sum(self.vaults.values()), 2),
            "recent_transactions": self.transactions[-10:],
        }


_bank = _MockBank()


@app.get("/api/bank/summary")
def bank_summary():
    """Mock bank account summary — checking balance + vaults."""
    return _bank.summary()


@app.post("/api/bank/lock")
def bank_lock(request: VaultRequest):
    """Lock funds from checking into a vault."""
    return _bank.lock(request.amount, request.vault_name, request.reason)


@app.post("/api/bank/unlock")
def bank_unlock(request: VaultRequest):
    """Unlock funds from a vault back to checking."""
    return _bank.unlock(request.amount, request.vault_name, request.reason)


# ── Mock Calendar (demo data for frontend wiring) ─────────────────────────


_MOCK_CALENDAR_EVENTS: list[dict[str, Any]] = [
    {
        "id": "evt-1",
        "title": "Team lunch - Downtown",
        "start": "2026-03-03T12:00:00",
        "end": "2026-03-03T13:30:00",
        "calendarType": "work",
        "location": "Earls Restaurant",
        "attendees": 4,
    },
    {
        "id": "evt-2",
        "title": "Coffee with Sarah",
        "start": "2026-03-03T15:00:00",
        "end": "2026-03-03T16:00:00",
        "calendarType": "social",
    },
    {
        "id": "evt-3",
        "title": "Dentist appointment",
        "start": "2026-03-04T09:00:00",
        "end": "2026-03-04T10:00:00",
        "calendarType": "health",
    },
    {
        "id": "evt-4",
        "title": "Birthday dinner - Alex",
        "start": "2026-03-05T19:00:00",
        "end": "2026-03-05T22:00:00",
        "calendarType": "social",
        "attendees": 6,
        "location": "The Keg Steakhouse",
    },
    {
        "id": "evt-5",
        "title": "Uber to office (client meeting)",
        "start": "2026-03-06T08:30:00",
        "end": "2026-03-06T09:00:00",
        "calendarType": "work",
    },
    {
        "id": "evt-6",
        "title": "Weekend brunch with friends",
        "start": "2026-03-08T11:00:00",
        "end": "2026-03-08T13:00:00",
        "calendarType": "social",
        "attendees": 3,
        "location": "OEB Breakfast Co.",
    },
    {
        "id": "evt-7",
        "title": "Movie night — Dune 3",
        "start": "2026-03-08T19:00:00",
        "end": "2026-03-08T22:00:00",
        "calendarType": "personal",
        "attendees": 2,
    },
    {
        "id": "evt-8",
        "title": "Tim Hortons run",
        "start": "2026-03-04T07:30:00",
        "end": "2026-03-04T08:00:00",
        "calendarType": "personal",
    },
    {
        "id": "evt-9",
        "title": "Starbucks before class",
        "start": "2026-03-05T08:00:00",
        "end": "2026-03-05T08:30:00",
        "calendarType": "personal",
    },
    {
        "id": "evt-10",
        "title": "Uber to downtown hangout",
        "start": "2026-03-07T18:00:00",
        "end": "2026-03-07T18:30:00",
        "calendarType": "social",
    },
]


@app.get("/api/calendar/events")
def get_mock_calendar():
    """
    Returns mock calendar events for demo / frontend wiring.
    In production, this calls the Google Calendar API with OAuth.
    """
    return _MOCK_CALENDAR_EVENTS


@app.get("/api/dashboard")
def dashboard(
    monthly_budget: float = Query(_DEFAULT_MONTHLY_BUDGET, ge=0),
    spent_so_far: float = Query(_DEFAULT_SPENT_SO_FAR, ge=0),
    session_id: str = Query("default"),
):
    """Budget-aware dashboard payload for all frontend pages."""
    return _build_dashboard_payload(
        session_id=session_id,
        monthly_budget=monthly_budget,
        spent_so_far=spent_so_far,
    )


@app.get("/api/dashboard/sankey")
def dashboard_sankey(
    monthly_budget: float = Query(_DEFAULT_MONTHLY_BUDGET, ge=0),
    spent_so_far: float = Query(_DEFAULT_SPENT_SO_FAR, ge=0),
    session_id: str = Query("default"),
):
    """
    Budget-aware Sankey endpoint built from deterministic pipeline output.
    """
    pipeline = _build_dashboard_payload(
        session_id=session_id,
        monthly_budget=monthly_budget,
        spent_so_far=spent_so_far,
    )
    return _build_dashboard_sankey(pipeline["forecast"])


@app.get("/api/demo/dashboard")
def demo_dashboard():
    """
    One-shot demo endpoint: takes mock calendar data, runs the full
    pipeline, and returns everything the frontend needs.
    No API key or calendar OAuth required.
    """
    return _build_dashboard_payload(
        session_id="demo",
        monthly_budget=_DEFAULT_MONTHLY_BUDGET,
        spent_so_far=_DEFAULT_SPENT_SO_FAR,
    )


@app.get("/api/demo/dashboard-ai")
def demo_dashboard_ai():
    """
    Gemini-enhanced demo dashboard: runs the full pipeline, then asks
    Gemini to generate a natural-language weekly brief from the data.
    Returns both structured data and the AI summary.
    """
    import os

    from google import genai as genai_client

    pipeline = _build_dashboard_payload(
        session_id="demo-ai",
        monthly_budget=_DEFAULT_MONTHLY_BUDGET,
        spent_so_far=_DEFAULT_SPENT_SO_FAR,
    )

    # Build a concise prompt with the pipeline data
    events_summary = "\n".join(
        f"- {e['title']}: ${e['predictedSpend']:.0f} ({e['category']})"
        for e in pipeline["events"]
    )
    insights_summary = "\n".join(
        f"- [{i['type']}] {i['title']}: {i['description']}"
        for i in pipeline["insights"]
    )
    actions_summary = "\n".join(
        f"- {a['label']} ({a['impact']})"
        for a in pipeline["forecast"].get("recommendedActions", [])
    )

    prompt = f"""\
You are FutureSpend, a sharp and friendly financial co-pilot.

Here is the user's week at a glance:

UPCOMING EVENTS:
{events_summary}

7-DAY FORECAST:
- Total predicted spend: ${pipeline['forecast']['next7DaysTotal']:.0f}
- Remaining budget: ${pipeline['forecast']['remainingBudget']:.0f} of ${pipeline['forecast']['monthlyBudget']:.0f}
- Risk level: {pipeline['forecast']['riskScore']}

INSIGHTS DETECTED:
{insights_summary}

RECOMMENDED ACTIONS:
{actions_summary}

Write a short, punchy weekly financial brief (3-5 sentences). Be specific — \
reference actual events and dollar amounts. End with one concrete action the \
user should take today. No bullet points, just flowing text. Keep it under 100 words."""

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    ai_summary = None
    if api_key:
        try:
            client = genai_client.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            ai_summary = response.text
        except Exception as e:
            ai_summary = f"[Gemini unavailable: {e}]"
    else:
        ai_summary = "[Set GEMINI_API_KEY in .env to enable AI summaries]"

    return {
        **pipeline,
        "aiSummary": ai_summary,
    }
