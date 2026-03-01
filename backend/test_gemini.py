#!/usr/bin/env python3
"""
Quick test to verify Gemini API and the coach agent work.

Usage:
  cd backend && python test_gemini.py

Requires: GEMINI_API_KEY or GOOGLE_API_KEY in .env or environment
"""

from __future__ import annotations

import os
import sys

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def test_api_key() -> bool:
    """Check if API key is configured."""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key or key == "your-gemini-api-key-here":
        print("❌ GEMINI_API_KEY (or GOOGLE_API_KEY) not set or still placeholder")
        print("   Add it to backend/.env or export it. Get one at: https://aistudio.google.com/apikey")
        return False
    print("✅ API key found")
    return True


def test_direct_gemini() -> bool:
    """Call Gemini API directly with a simple prompt."""
    try:
        from google import genai
        from google.genai import types

        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        client = genai.Client(api_key=key)

        # Use gemini-2.0-flash for reliability (gemini-3-flash-preview may not be available yet)
        model = "gemini-2.0-flash"
        response = client.models.generate_content(
            model=model,
            contents="Reply with exactly: Hello from Gemini",
            config=types.GenerateContentConfig(
                max_output_tokens=20,
                temperature=0,
            ),
        )
        text = response.text.strip() if response.text else ""
        if text:
            print(f"✅ Direct Gemini call OK (model={model})")
            print(f"   Response: {text[:80]}")
            return True
        print("❌ Direct Gemini call returned empty text")
        return False
    except Exception as e:
        print(f"❌ Direct Gemini call failed: {e}")
        return False


def test_coach_chat(base_url: str = "http://localhost:8000") -> bool:
    """Hit the coach chat endpoint (requires server running)."""
    try:
        import urllib.request
        import json

        req = urllib.request.Request(
            f"{base_url}/api/coach/chat",
            data=json.dumps({
                "message": "Hi! What can you help me with?",
                "session_id": "test-gemini-check",
                "events": [],
                "monthly_budget": 1000,
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            reply = data.get("reply", {})
            content = reply.get("content", "")
            if "I loaded your dashboard context" in content or "I need calendar events" in content:
                # Fallback text = Gemini might have failed (or no events)
                print("⚠️  Coach chat returned (fallback response - may indicate Gemini failed or no events)")
                print(f"   Content: {content[:150]}...")
                return False
            print("✅ Coach chat endpoint OK (Gemini responded)")
            print(f"   Reply preview: {content[:120]}...")
            return True
    except urllib.error.URLError as e:
        if "Connection refused" in str(e) or "actively refused" in str(e).lower():
            print(f"❌ Coach chat: server not running at {base_url}")
            print("   Start with: cd backend && uvicorn main:app --reload")
        else:
            print(f"❌ Coach chat request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Coach chat failed: {e}")
        return False


def main() -> int:
    print("=" * 60)
    print("Gemini / Agent Integration Test")
    print("=" * 60)

    ok_key = test_api_key()
    if not ok_key:
        return 1

    print()
    ok_direct = test_direct_gemini()
    print()
    ok_coach = test_coach_chat()

    print()
    print("=" * 60)
    if ok_direct:
        print("✅ Gemini API: WORKING")
    else:
        print("❌ Gemini API: FAILED")

    if ok_coach:
        print("✅ Coach agent (via API): WORKING")
    else:
        print("⚠️  Coach agent: Check server + events (or see fallback)")
    print("=" * 60)

    return 0 if ok_direct else 1


if __name__ == "__main__":
    sys.exit(main())
