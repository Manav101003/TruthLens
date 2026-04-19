"""
TruthLens API Client — HTTP wrapper to call the existing Node.js backend.
This is how the agent treats your existing code as a 'Primary Tool'.
"""
import os
import httpx

TRUTHLENS_URL = os.getenv("TRUTHLENS_API_URL", "http://localhost:5000")
TIMEOUT = 120.0  # seconds — generous for full-document verification


async def call_extract(text: str) -> dict:
    """
    Call the fast Node.js /api/v1/extract-claims endpoint.
    Returns only the NLP extracted claims (no slow Wikipedia lookups).
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{TRUTHLENS_URL}/api/v1/extract-claims",
            json={"text": text},
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()


async def health_check() -> bool:
    """Check if the Node.js backend is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{TRUTHLENS_URL}/api/v1/health")
            return resp.status_code == 200
    except Exception:
        return False


async def call_analyze(text: str, user_tier: str = "enterprise") -> dict:
    """
    Call the full Node.js /api/v1/analyze endpoint (Standard mode).
    Used as a fallback when the LLM agent is unavailable.
    Returns the complete audit with claims, summary, and citations.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{TRUTHLENS_URL}/api/v1/analyze",
            json={"text": text, "userTier": user_tier},
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()
