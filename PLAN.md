# FutureSpend Backend Refactor Plan

## Context

The backend uses hardcoded heuristics (regex + fixed dollar amounts) for all spend estimation, insights are rule-based, challenges/leaderboard are fully mock, and the agent has no autonomy — it follows a rigid tool order. The goal is to make this production-worthy: data-driven spend estimation from bank history, agent autonomy, merged insights into forecast, and database persistence.

**Critical constraint: Demo in ~1 hour. Phase 1 must ship fast.**

**Key finding:** `InsightCards` component exists but is **never imported by any page**. Removing `generate_insights` as a tool is zero-risk for the frontend — we just keep returning an `insights` array (even empty) from the pipeline.

---

## Phase 1 — Demo-Ready (~45 min)

### 1. Merge insights into forecast
**Files:** [schemas.py](backend/agent/schemas.py), [tools.py](backend/agent/tools.py), [orchestrator.py](backend/agent/orchestrator.py)

- Add optional `observations: list[str]` field to `ForecastResponse` in schemas.py
- Add `_generate_observations()` helper in tools.py (inline the best logic from `generate_insights`: transport spikes, coffee habit, social spend, risk alerts)
- Wire `observations` into `generate_forecast()` return value
- Remove `generate_insights` from `TOOL_DEFINITIONS` list (LLM can no longer call it)
- Remove `"generate_insights"` from `TOOL_REGISTRY` in orchestrator.py
- In `run_pipeline()`: remove the `generate_insights` call, convert `forecast.observations` into `Insight` objects for backwards-compat `insights` array
- Change `generate_challenges` precondition from `("insights",)` to `("events",)` — challenges can work from events directly

### 2. Enhanced mock bank with realistic transaction history
**File:** [mock_bank.py](backend/mock_bank.py)

- Replace the thin mock with ~30 realistic transactions (Starbucks, Uber, The Keg, Tim Hortons, Earls, OEB, etc.) spanning last 30 days
- Add `_build_merchant_averages()` that pre-computes merchant → avg spend lookup
- Add `get_merchant_average(merchant_name)` function with exact + substring matching
- Keep existing `_MockBank` class in main.py untouched (vault operations still work)

### 3. Add `lookup_merchant_spend` tool
**Files:** [tools.py](backend/agent/tools.py), [orchestrator.py](backend/agent/orchestrator.py)

- New tool function: checks bank transaction history for a merchant, returns avg spend + confidence
- Add to `TOOL_DEFINITIONS` and `TOOL_REGISTRY`
- Add dispatch case in `_dispatch_tool`

### 4. Make `_estimate_event_spend` bank-aware
**File:** [tools.py](backend/agent/tools.py)

- Modify `_estimate_event_spend()` to check `get_merchant_average()` for title and location first
- Fall back to existing heuristics only when no bank history match
- Update `analyze_calendar_events` to pass `location` through

### 5. Give the agent autonomy (system prompt)
**File:** [orchestrator.py](backend/agent/orchestrator.py)

- Rewrite `SYSTEM_PROMPT`: remove rigid "ALWAYS call X FIRST then Y then Z" ordering
- Tell the agent it has tools, it decides the best order based on context
- Mention the new `lookup_merchant_spend` tool
- Keep the personality (sharp, specific, not generic bank chatbot)

### 6. Update MCP server
**File:** [mcp_server.py](backend/mcp_server.py)

- Remove `get_insights` tool
- Add `lookup_merchant` tool wrapping `lookup_merchant_spend`
- Update `full_dashboard` to use the updated pipeline (no separate insights step)
- Update `generate_challenges` to require forecast instead of insights

---

## Phase 2 — Post-Demo

### 2A. SQLite database
- New `backend/db.py` with tables: challenges, leaderboard_entries, user_profiles
- `generate_challenges` writes to DB
- Leaderboard persists across sessions

### 2B. CSV/JSON bank import
- `POST /api/bank/import` endpoint
- Accepts CSV (date, merchant, amount, category) or JSON array
- Recomputes merchant averages on import

### 2C. Web search fallback
- When `lookup_merchant_spend` returns unknown, use Gemini grounding or web search
- Cache results in SQLite

### 2D. Full heuristic elimination
- LLM-based event classification (replace all regex)
- Bank-history-first spend estimation everywhere

---

## Verification (Phase 1)

```bash
# Backend starts
cd backend && uvicorn main:app --reload --port 8000

# Dashboard returns full payload with observations
curl -s http://localhost:8000/api/dashboard | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('observations:', d['forecast'].get('observations'))
print('insights count:', len(d.get('insights',[])))
print('events:', len(d['events']))
"

# Coach chat works with new tools
curl -s http://localhost:8000/api/coach/chat -X POST \
  -H 'Content-Type: application/json' \
  -d '{"message":"How much do I usually spend at Starbucks?","session_id":"test"}'

# MCP server starts
python mcp_server.py

# Frontend loads (all pages)
open http://localhost:3000/dashboard
```

## Files Modified (Phase 1)
1. [backend/agent/schemas.py](backend/agent/schemas.py) — add `observations` field
2. [backend/agent/tools.py](backend/agent/tools.py) — add observations, lookup_merchant_spend, bank-aware estimation
3. [backend/agent/orchestrator.py](backend/agent/orchestrator.py) — remove insights from pipeline, update registry, new system prompt
4. [backend/mock_bank.py](backend/mock_bank.py) — realistic transactions + merchant averages
5. [backend/mcp_server.py](backend/mcp_server.py) — mirror tool changes
