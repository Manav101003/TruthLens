"""
Serper Search Tool — Google SERP results for deep-web evidence.
Falls back gracefully if SERPER_API_KEY is not configured.
Provides web search and news search capabilities.
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SERPER_API_URL = "https://google.serper.dev"
TIMEOUT = 8.0  # seconds


async def serper_web_search(query: str, max_results: int = 3) -> list[dict]:
    """
    Search the web using Serper API (Google SERP results).
    Returns list of { title, content, url, score }.
    Falls back to empty list if Serper is not configured.
    """
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key or api_key.startswith("your_"):
        return []

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{SERPER_API_URL}/search",
                json={"q": query, "num": max_results},
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()

        results = []

        # Include the answer box if available
        if data.get("answerBox"):
            ab = data["answerBox"]
            answer_text = ab.get("answer") or ab.get("snippet") or ab.get("title", "")
            if answer_text:
                results.append({
                    "title": "Google Answer Box",
                    "content": answer_text,
                    "url": ab.get("link", "serper-answer-box"),
                    "score": 0.92,
                })

        # Include knowledge graph if available
        if data.get("knowledgeGraph"):
            kg = data["knowledgeGraph"]
            kg_text = kg.get("description", "")
            if kg_text:
                results.append({
                    "title": kg.get("title", "Knowledge Graph"),
                    "content": kg_text,
                    "url": kg.get("website", "serper-knowledge-graph"),
                    "score": 0.88,
                })

        # Include organic results
        for r in data.get("organic", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("snippet", ""),
                "url": r.get("link", ""),
                "score": 0.6,
            })

        return results[:max_results]

    except Exception as e:
        print(f"⚠ Serper web search failed: {e}")
        return []


async def serper_news_search(query: str, max_results: int = 3) -> list[dict]:
    """
    Search news articles using Serper News API.
    Useful for recent events and current affairs claims.
    Returns list of { title, content, url, score, date }.
    """
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key or api_key.startswith("your_"):
        return []

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{SERPER_API_URL}/news",
                json={"q": query, "num": max_results},
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for r in data.get("news", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("snippet", ""),
                "url": r.get("link", ""),
                "score": 0.65,
                "date": r.get("date", ""),
            })

        return results[:max_results]

    except Exception as e:
        print(f"⚠ Serper news search failed: {e}")
        return []
