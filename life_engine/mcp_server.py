"""
FutureSpend MCP Server.

Exposes the FutureSpend financial tools via the Model Context Protocol,
so any MCP-compatible client (Claude Desktop, Cursor, etc.) can use them.

Run with:
    python mcp_server.py
    # or
    mcp run mcp_server.py
"""

from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from agent.tools import (
    analyze_calendar_events,
    create_vault_command,
    generate_challenge_from_insights,
    generate_forecast,
    generate_insights,
)
from agent.schemas import CalendarEvent, ForecastResponse, Insight

mcp = FastMCP("FutureSpend")


# ── In-memory state shared across tool calls in a session ─────────────────

_state: dict[str, Any] = {
    "events": [],
    "forecast": None,
    "insights": [],
}


# ── Mock calendar data (for demo) ────────────────────────────────────────

MOCK_EVENTS: list[dict[str, Any]] = [
    {"id": "evt-1", "title": "Team lunch - Downtown", "start": "2026-03-03T12:00:00", "end": "2026-03-03T13:30:00", "calendarType": "work", "location": "Earls Restaurant", "attendees": 4},
    {"id": "evt-2", "title": "Coffee with Sarah", "start": "2026-03-03T15:00:00", "end": "2026-03-03T16:00:00", "calendarType": "social"},
    {"id": "evt-3", "title": "Dentist appointment", "start": "2026-03-04T09:00:00", "end": "2026-03-04T10:00:00", "calendarType": "health"},
    {"id": "evt-4", "title": "Birthday dinner - Alex", "start": "2026-03-05T19:00:00", "end": "2026-03-05T22:00:00", "calendarType": "social", "attendees": 6, "location": "The Keg Steakhouse"},
    {"id": "evt-5", "title": "Uber to office (client meeting)", "start": "2026-03-06T08:30:00", "end": "2026-03-06T09:00:00", "calendarType": "work"},
    {"id": "evt-6", "title": "Weekend brunch with friends", "start": "2026-03-08T11:00:00", "end": "2026-03-08T13:00:00", "calendarType": "social", "attendees": 3, "location": "OEB Breakfast Co."},
    {"id": "evt-7", "title": "Movie night — Dune 3", "start": "2026-03-08T19:00:00", "end": "2026-03-08T22:00:00", "calendarType": "personal", "attendees": 2},
    {"id": "evt-8", "title": "Tim Hortons run", "start": "2026-03-04T07:30:00", "end": "2026-03-04T08:00:00", "calendarType": "personal"},
    {"id": "evt-9", "title": "Starbucks before class", "start": "2026-03-05T08:00:00", "end": "2026-03-05T08:30:00", "calendarType": "personal"},
    {"id": "evt-10", "title": "Uber to downtown hangout", "start": "2026-03-07T18:00:00", "end": "2026-03-07T18:30:00", "calendarType": "social"},
]


# ── Tools ─────────────────────────────────────────────────────────────────


@mcp.tool()
def analyze_events(events_json: str = "") -> str:
    """Analyze calendar events and predict spending for each.

    Takes a JSON array of calendar event objects (each with title, start, end,
    optional calendarType/location/attendees). If no events are provided,
    uses built-in demo data.

    Returns enriched events with predicted spend, category, and explanation.
    """
    if events_json.strip():
        raw_events = json.loads(events_json)
    else:
        raw_events = MOCK_EVENTS

    enriched = analyze_calendar_events(raw_events)
    _state["events"] = enriched
    result = [e.model_dump(by_alias=True) for e in enriched]
    return json.dumps(result, indent=2, default=str)


@mcp.tool()
def forecast_spending(monthly_budget: float = 1800.0, spent_so_far: float = 0.0) -> str:
    """Generate a 7-day financial forecast from previously analyzed calendar events.

    Call analyze_events first to load events. Returns daily spending breakdown,
    category totals, risk score, and recommended savings actions.

    Args:
        monthly_budget: User's monthly budget in CAD (default: 1800)
        spent_so_far: Amount already spent this month in CAD (default: 0)
    """
    if not _state["events"]:
        return json.dumps({"error": "No events analyzed yet. Call analyze_events first."})

    forecast = generate_forecast(_state["events"], monthly_budget, spent_so_far)
    _state["forecast"] = forecast
    return json.dumps(forecast.model_dump(by_alias=True), indent=2, default=str)


@mcp.tool()
def get_insights() -> str:
    """Generate actionable financial insights from calendar events and forecast.

    Call analyze_events and forecast_spending first. Detects patterns like
    transport spikes, social spending triggers, coffee habits, and weekend
    dining — then surfaces specific, actionable observations.
    """
    if not _state["events"] or not _state["forecast"]:
        return json.dumps({"error": "Need events and forecast first. Call analyze_events and forecast_spending."})

    insights = generate_insights(_state["events"], _state["forecast"])
    _state["insights"] = insights
    return json.dumps([i.model_dump() for i in insights], indent=2, default=str)


@mcp.tool()
def vault_lock_unlock(action: str, amount: float, reason: str, vault_name: str = "default") -> str:
    """Lock or unlock funds in a savings vault.

    Use 'lock' to protect money from impulse spending, or 'unlock' to
    release vault funds when needed.

    Args:
        action: Either 'lock' or 'unlock'
        amount: Amount in CAD to lock/unlock
        reason: Why the funds are being locked/unlocked
        vault_name: Name of the vault (default: 'default')
    """
    cmd = create_vault_command(action=action, amount=amount, reason=reason, vault_name=vault_name)
    return json.dumps(cmd.model_dump(), indent=2, default=str)


@mcp.tool()
def generate_challenges(user_name: str = "You") -> str:
    """Generate savings challenges based on detected spending patterns.

    Call get_insights first. Auto-creates gamification challenges
    (no-coffee week, weekend cook-off, monthly saver) based on the
    specific patterns found in the user's calendar.

    Args:
        user_name: User's display name for the leaderboard
    """
    if not _state["insights"]:
        return json.dumps({"error": "Need insights first. Call get_insights."})

    challenges = generate_challenge_from_insights(_state["insights"], user_name)
    return json.dumps(challenges.model_dump(by_alias=True), indent=2, default=str)


@mcp.tool()
def full_dashboard(monthly_budget: float = 1800.0, spent_so_far: float = 620.0) -> str:
    """Run the complete FutureSpend pipeline in one shot.

    Analyzes demo calendar events, generates forecast, insights, and
    challenges — returns the full dashboard payload. No setup needed.

    Args:
        monthly_budget: User's monthly budget in CAD (default: 1800)
        spent_so_far: Amount already spent this month in CAD (default: 620)
    """
    enriched = analyze_calendar_events(MOCK_EVENTS)
    _state["events"] = enriched

    forecast = generate_forecast(enriched, monthly_budget, spent_so_far)
    _state["forecast"] = forecast

    insights = generate_insights(enriched, forecast)
    _state["insights"] = insights

    challenges = generate_challenge_from_insights(insights)

    result = {
        "events": [e.model_dump(by_alias=True) for e in enriched],
        "forecast": forecast.model_dump(by_alias=True),
        "insights": [i.model_dump() for i in insights],
        "challenges": challenges.model_dump(by_alias=True),
    }
    return json.dumps(result, indent=2, default=str)


# ── Resources ─────────────────────────────────────────────────────────────


@mcp.resource("futurespend://calendar/demo-events")
def demo_events() -> str:
    """Demo calendar events for testing the FutureSpend pipeline."""
    return json.dumps(MOCK_EVENTS, indent=2)


@mcp.resource("futurespend://status")
def server_status() -> str:
    """Current state of the FutureSpend session."""
    return json.dumps({
        "events_loaded": len(_state["events"]),
        "forecast_ready": _state["forecast"] is not None,
        "insights_count": len(_state["insights"]),
    })


if __name__ == "__main__":
    mcp.run()
