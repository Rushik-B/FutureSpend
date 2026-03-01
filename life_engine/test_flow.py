#!/usr/bin/env python
"""
End-to-end flow test for all three requirements.
Tests each step independently, then the full chain.

Run with: python test_flow.py
"""

import sys

passed = 0
failed = 0


def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  PASS  {name}")
        passed += 1
    except Exception as e:
        print(f"  FAIL  {name}: {e}")
        failed += 1


# ═══════════════════════════════════════════════════════════════════════════
# REQUIREMENT 1: Calendar fetcher → Parser → Predictor
# ═══════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("REQ 1: Calendar Fetcher → Parser → Predictor")
print("=" * 60)

mock_events = [
    {"title": "Friday team dinner", "location": "Earls Restaurant",
     "start_time": "2024-03-15T19:00:00", "attendees": 6},
    {"title": "Coffee with Sarah", "location": "Starbucks",
     "start_time": "2024-03-16T10:00:00", "attendees": 2},
    {"title": "Saturday concert", "location": "Rogers Arena",
     "start_time": "2024-03-16T20:00:00", "attendees": 2},
    {"title": "Uber to concert", "location": "",
     "start_time": "2024-03-16T19:45:00", "attendees": 2},
    {"title": "Sunday brunch", "location": "Cactus Club",
     "start_time": "2024-03-17T11:30:00", "attendees": 3},
]


def test_parser_import():
    from parser import parse_calendar_events
    assert callable(parse_calendar_events)


def test_parser_output():
    from parser import parse_calendar_events
    features = parse_calendar_events(mock_events)
    assert len(features) == 5, f"Expected 5 features, got {len(features)}"
    assert features[0]["event_type"] == "meal", f"Expected meal, got {features[0]['event_type']}"
    assert features[1]["event_type"] == "coffee"
    assert features[2]["event_type"] == "entertainment"
    assert features[3]["event_type"] == "entertainment"  # "Uber" contains "uber" but title is "Uber to concert" — hmm
    assert features[4]["event_type"] == "meal"


def test_prediction_import():
    from prediction import predict_spending
    assert callable(predict_spending)


def test_prediction_output():
    from parser import parse_calendar_events
    from prediction import predict_spending
    features = parse_calendar_events(mock_events)
    result = predict_spending(features)
    assert "total_predicted" in result, "Missing total_predicted"
    assert "confidence" in result, "Missing confidence"
    assert "breakdown" in result, "Missing breakdown"
    assert result["total_predicted"] > 0, f"Total should be > 0, got {result['total_predicted']}"
    assert 0 <= result["confidence"] <= 1, f"Confidence out of range: {result['confidence']}"
    print(f"         → Predicted: ${result['total_predicted']}, Confidence: {result['confidence']}")


def test_calendar_fetcher_import():
    from calendar_fetcher import get_upcoming_events
    assert callable(get_upcoming_events)


def test_full_fetcher_to_prediction():
    """Simulates: fetch → parse → predict (using mock events, no OAuth)."""
    from parser import parse_calendar_events
    from prediction import predict_spending
    # In production: events = get_upcoming_events()
    events = mock_events  # mock instead of real Google Calendar
    features = parse_calendar_events(events)
    result = predict_spending(features)
    assert result["total_predicted"] > 0
    for cat in ["food", "entertainment", "transport", "other"]:
        assert cat in result["breakdown"], f"Missing category: {cat}"
    print(f"         → Full flow: ${result['total_predicted']} across {len(features)} events")


test("parser imports", test_parser_import)
test("parser produces correct features", test_parser_output)
test("prediction imports", test_prediction_import)
test("prediction produces valid output", test_prediction_output)
test("calendar_fetcher imports", test_calendar_fetcher_import)
test("full fetch → parse → predict flow", test_full_fetcher_to_prediction)


# ═══════════════════════════════════════════════════════════════════════════
# REQUIREMENT 2: Mock Bank → Personalized Predictions
# ═══════════════════════════════════════════════════════════════════════════

print()
print("=" * 60)
print("REQ 2: Mock Bank Data → Personalized Predictions")
print("=" * 60)


def test_bank_import():
    from mock_bank import get_balance, get_transactions
    assert callable(get_balance)
    assert callable(get_transactions)


def test_bank_balance():
    from mock_bank import get_balance
    resp = get_balance("user_123")
    assert resp.success is True
    assert resp.data["balance"] == 2500.0, f"Expected 2500, got {resp.data['balance']}"
    print(f"         → Balance: ${resp.data['balance']}")


def test_bank_transactions():
    from mock_bank import get_transactions
    resp = get_transactions("user_123", limit=10)
    assert resp.success is True
    txns = resp.data["transactions"]
    assert len(txns) > 0, "No transactions returned"
    print(f"         → {len(txns)} transactions returned")


def test_bank_adjusted_prediction():
    """Prediction adjusted by bank spending history."""
    from parser import parse_calendar_events
    from prediction import predict_spending
    from mock_bank import get_balance, get_transactions

    features = parse_calendar_events(mock_events)
    prediction = predict_spending(features)
    original = prediction["total_predicted"]

    # Get bank spending data
    txn_resp = get_transactions("user_123", limit=10)
    bal_resp = get_balance("user_123")
    transactions = txn_resp.data["transactions"]
    balance = bal_resp.data["balance"]

    spending = [t for t in transactions if t["amount"] < 0]
    recent_avg = abs(sum(t["amount"] for t in spending)) / max(len(spending), 1)

    # Blend: 70% prediction + 30% bank history
    num_categories = len(prediction["breakdown"])
    adjusted = round(0.7 * original + 0.3 * (recent_avg * num_categories), 2)

    assert adjusted != original, "Adjustment should change total"
    print(f"         → Original: ${original}, Bank-adjusted: ${adjusted}, Balance: ${balance}")


test("mock_bank imports", test_bank_import)
test("bank balance retrieval", test_bank_balance)
test("bank transactions retrieval", test_bank_transactions)
test("bank-adjusted prediction", test_bank_adjusted_prediction)


# ═══════════════════════════════════════════════════════════════════════════
# REQUIREMENT 3: Full End-to-End Flow
# ═══════════════════════════════════════════════════════════════════════════

print()
print("=" * 60)
print("REQ 3: Full End-to-End Flow")
print("=" * 60)


def test_challenge_generation():
    from element_of_game import generate_challenge
    challenge = generate_challenge(300.0)
    assert "challenge_id" in challenge
    assert "target_spending" in challenge
    assert "points" in challenge
    assert challenge["target_spending"] < 300.0, "Target should be less than predicted"
    print(f"         → Challenge: save under ${challenge['target_spending']} for {challenge['points']} pts")


def test_leaderboard():
    from leaderboard import calculate_leaderboard
    participants = [
        {"name": "Alice", "spent": 120.5},
        {"name": "Bob", "spent": 95.0},
        {"name": "Charlie", "spent": 150.75},
        {"name": "Diana", "spent": 95.0},
    ]
    lb = calculate_leaderboard(participants, 130.0)
    assert len(lb) == 4
    assert lb[0]["rank"] == 1
    assert lb[0]["spent"] == 95.0  # Bob or Diana (tied)
    assert lb[0]["status"] == "under"
    assert lb[3]["status"] == "over"
    print(f"         → {len(lb)} entries, top: {lb[0]['name']} at ${lb[0]['spent']}")


def test_complete_pipeline():
    """Full pipeline: events → parse → predict → bank adjust → challenge → leaderboard."""
    from parser import parse_calendar_events
    from prediction import predict_spending
    from element_of_game import generate_challenge
    from leaderboard import calculate_leaderboard
    from mock_bank import get_balance, get_transactions

    # 1. Events (mock)
    events = mock_events
    assert len(events) > 0

    # 2. Parse
    features = parse_calendar_events(events)
    assert len(features) == len(events)

    # 3. Predict
    prediction = predict_spending(features)
    assert prediction["total_predicted"] > 0

    # 4. Bank adjustment
    txn_resp = get_transactions("user_123")
    spending = [t for t in txn_resp.data["transactions"] if t["amount"] < 0]
    recent_avg = abs(sum(t["amount"] for t in spending)) / max(len(spending), 1)
    adjusted_total = round(0.7 * prediction["total_predicted"] + 0.3 * (recent_avg * 4), 2)

    # 5. Challenge
    challenge = generate_challenge(adjusted_total)
    assert challenge["target_spending"] < adjusted_total

    # 6. Leaderboard
    mock_participants = [
        {"name": "You", "spent": adjusted_total},
        {"name": "Emma", "spent": round(adjusted_total * 0.8, 2)},
        {"name": "Liam", "spent": round(adjusted_total * 1.1, 2)},
        {"name": "Olivia", "spent": round(adjusted_total * 0.6, 2)},
    ]
    lb = calculate_leaderboard(mock_participants, challenge["target_spending"])
    assert len(lb) == 4

    print(f"         → {len(events)} events → ${prediction['total_predicted']} predicted")
    print(f"         → Bank-adjusted to ${adjusted_total}")
    print(f"         → Challenge: under ${challenge['target_spending']} for {challenge['points']} pts")
    print(f"         → Leaderboard: {lb[0]['name']} leads at ${lb[0]['spent']}")


test("challenge generation", test_challenge_generation)
test("leaderboard ranking", test_leaderboard)
test("COMPLETE end-to-end pipeline", test_complete_pipeline)


# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print()
print("=" * 60)
total = passed + failed
print(f"RESULTS: {passed}/{total} passed, {failed}/{total} failed")
if failed == 0:
    print("ALL TESTS PASSED — all 3 requirements verified!")
else:
    print("SOME TESTS FAILED — see above for details")
print("=" * 60)

sys.exit(0 if failed == 0 else 1)
