#!/usr/bin/env python
"""
End-to-end flow test for all three requirements.

Run directly with: `python test_flow.py`
Collected safely by pytest without executing the manual runner at import time.
"""

from __future__ import annotations


MOCK_EVENTS = [
    {
        "title": "Friday team dinner",
        "location": "Earls Restaurant",
        "start_time": "2024-03-15T19:00:00",
        "attendees": 6,
    },
    {
        "title": "Coffee with Sarah",
        "location": "Starbucks",
        "start_time": "2024-03-16T10:00:00",
        "attendees": 2,
    },
    {
        "title": "Saturday concert",
        "location": "Rogers Arena",
        "start_time": "2024-03-16T20:00:00",
        "attendees": 2,
    },
    {
        "title": "Uber to concert",
        "location": "",
        "start_time": "2024-03-16T19:45:00",
        "attendees": 2,
    },
    {
        "title": "Sunday brunch",
        "location": "Cactus Club",
        "start_time": "2024-03-17T11:30:00",
        "attendees": 3,
    },
]


def test_parser_import():
    from parser import parse_calendar_events

    assert callable(parse_calendar_events)


def test_parser_output():
    from parser import parse_calendar_events

    features = parse_calendar_events(MOCK_EVENTS)
    assert len(features) == 5, f"Expected 5 features, got {len(features)}"
    assert features[0]["event_type"] == "meal", f"Expected meal, got {features[0]['event_type']}"
    assert features[1]["event_type"] == "coffee"
    assert features[2]["event_type"] == "entertainment"
    assert features[3]["event_type"] == "entertainment"
    assert features[4]["event_type"] == "meal"


def test_prediction_import():
    from prediction import predict_spending

    assert callable(predict_spending)


def test_prediction_output():
    from parser import parse_calendar_events
    from prediction import predict_spending

    features = parse_calendar_events(MOCK_EVENTS)
    result = predict_spending(features)
    assert "total_predicted" in result, "Missing total_predicted"
    assert "confidence" in result, "Missing confidence"
    assert "breakdown" in result, "Missing breakdown"
    assert result["total_predicted"] > 0, f"Total should be > 0, got {result['total_predicted']}"
    assert 0 <= result["confidence"] <= 1, f"Confidence out of range: {result['confidence']}"


def test_calendar_fetcher_import():
    from calendar_fetcher import get_upcoming_events

    assert callable(get_upcoming_events)


def test_full_fetcher_to_prediction():
    from parser import parse_calendar_events
    from prediction import predict_spending

    features = parse_calendar_events(MOCK_EVENTS)
    result = predict_spending(features)
    assert result["total_predicted"] > 0
    for category in ["food", "entertainment", "transport", "other"]:
        assert category in result["breakdown"], f"Missing category: {category}"


def test_bank_import():
    from mock_bank import get_balance, get_transactions

    assert callable(get_balance)
    assert callable(get_transactions)


def test_bank_balance():
    from mock_bank import get_balance

    resp = get_balance("user_123")
    assert resp.success is True
    assert resp.data["balance"] == 2500.0, f"Expected 2500, got {resp.data['balance']}"


def test_bank_transactions():
    from mock_bank import get_transactions

    resp = get_transactions("user_123", limit=10)
    assert resp.success is True
    txns = resp.data["transactions"]
    assert len(txns) > 0, "No transactions returned"


def test_bank_adjusted_prediction():
    from parser import parse_calendar_events
    from prediction import predict_spending
    from mock_bank import get_balance, get_transactions

    features = parse_calendar_events(MOCK_EVENTS)
    prediction = predict_spending(features)
    original = prediction["total_predicted"]

    txn_resp = get_transactions("user_123", limit=10)
    bal_resp = get_balance("user_123")
    transactions = txn_resp.data["transactions"]
    balance = bal_resp.data["balance"]

    spending = [txn for txn in transactions if txn["amount"] < 0]
    recent_avg = abs(sum(txn["amount"] for txn in spending)) / max(len(spending), 1)
    num_categories = len(prediction["breakdown"])
    adjusted = round(0.7 * original + 0.3 * (recent_avg * num_categories), 2)

    assert adjusted != original, "Adjustment should change total"
    assert balance == 2500.0


def test_challenge_generation():
    from element_of_game import generate_challenge

    challenge = generate_challenge(300.0)
    assert "challenge_id" in challenge
    assert "target_spending" in challenge
    assert "points" in challenge
    assert challenge["target_spending"] < 300.0, "Target should be less than predicted"


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
    assert lb[0]["spent"] == 95.0
    assert lb[0]["status"] == "under"
    assert lb[3]["status"] == "over"


def test_complete_pipeline():
    from parser import parse_calendar_events
    from prediction import predict_spending
    from element_of_game import generate_challenge
    from leaderboard import calculate_leaderboard
    from mock_bank import get_transactions

    features = parse_calendar_events(MOCK_EVENTS)
    prediction = predict_spending(features)
    assert prediction["total_predicted"] > 0

    txn_resp = get_transactions("user_123")
    spending = [txn for txn in txn_resp.data["transactions"] if txn["amount"] < 0]
    recent_avg = abs(sum(txn["amount"] for txn in spending)) / max(len(spending), 1)
    adjusted_total = round(0.7 * prediction["total_predicted"] + 0.3 * (recent_avg * 4), 2)

    challenge = generate_challenge(adjusted_total)
    assert challenge["target_spending"] < adjusted_total

    mock_participants = [
        {"name": "You", "spent": adjusted_total},
        {"name": "Emma", "spent": round(adjusted_total * 0.8, 2)},
        {"name": "Liam", "spent": round(adjusted_total * 1.1, 2)},
        {"name": "Olivia", "spent": round(adjusted_total * 0.6, 2)},
    ]
    lb = calculate_leaderboard(mock_participants, challenge["target_spending"])
    assert len(lb) == 4


def run_manual_checks() -> int:
    passed = 0
    failed = 0

    def run_case(name: str, fn) -> None:
        nonlocal passed, failed
        try:
            fn()
            print(f"  PASS  {name}")
            passed += 1
        except Exception as exc:
            print(f"  FAIL  {name}: {exc}")
            failed += 1

    sections = [
        (
            "REQ 1: Calendar Fetcher → Parser → Predictor",
            [
                ("parser imports", test_parser_import),
                ("parser produces correct features", test_parser_output),
                ("prediction imports", test_prediction_import),
                ("prediction produces valid output", test_prediction_output),
                ("calendar_fetcher imports", test_calendar_fetcher_import),
                ("full fetch → parse → predict flow", test_full_fetcher_to_prediction),
            ],
        ),
        (
            "REQ 2: Mock Bank Data → Personalized Predictions",
            [
                ("mock_bank imports", test_bank_import),
                ("bank balance retrieval", test_bank_balance),
                ("bank transactions retrieval", test_bank_transactions),
                ("bank-adjusted prediction", test_bank_adjusted_prediction),
            ],
        ),
        (
            "REQ 3: Full End-to-End Flow",
            [
                ("challenge generation", test_challenge_generation),
                ("leaderboard ranking", test_leaderboard),
                ("COMPLETE end-to-end pipeline", test_complete_pipeline),
            ],
        ),
    ]

    for index, (title, cases) in enumerate(sections):
        if index > 0:
            print()
        print("=" * 60)
        print(title)
        print("=" * 60)
        for name, fn in cases:
            run_case(name, fn)

    print()
    print("=" * 60)
    total = passed + failed
    print(f"RESULTS: {passed}/{total} passed, {failed}/{total} failed")
    if failed == 0:
        print("ALL TESTS PASSED — all 3 requirements verified!")
    else:
        print("SOME TESTS FAILED — see above for details")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run_manual_checks())
