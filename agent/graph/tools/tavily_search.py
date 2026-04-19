"""
Tavily Search Tool — Deep-web search for evidence when Wikipedia is insufficient.
Falls back gracefully if Tavily API key is not configured.
"""
import os
from dotenv import load_dotenv

load_dotenv()


async def tavily_search(query: str, max_results: int = 3) -> list[dict]:
    """
    Search the web using Tavily API for deep evidence.
    Returns list of { title, content, url, score }.
    Falls back to empty list if Tavily is not configured.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key or api_key.startswith("your_"):
        return []

    try:
        from tavily import AsyncTavilyClient
        client = AsyncTavilyClient(api_key=api_key)
        response = await client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_answer=True,
        )

        results = []
        # Include the AI-generated answer if available
        if response.get("answer"):
            results.append({
                "title": "Tavily AI Answer",
                "content": response["answer"],
                "url": "tavily-answer",
                "score": 0.95,
            })

        for r in response.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "content": r.get("content", ""),
                "url": r.get("url", ""),
                "score": r.get("score", 0),
            })

        return results[:max_results]

    except Exception as e:
        print(f"⚠ Tavily search failed: {e}")
        return []


async def academic_search(query: str) -> list[dict]:
    """
    Search CrossRef for academic papers. Uses the existing CrossRef API
    (same as the Node.js backend but called directly from Python).
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.crossref.org/works",
                params={"query": query, "rows": 3},
                headers={"User-Agent": "TruthLens/1.0 (Hackathon Agent)"},
            )
            resp.raise_for_status()
            items = resp.json().get("message", {}).get("items", [])

            results = []
            for item in items:
                abstract = (item.get("abstract") or "").replace("<jats:p>", "").replace("</jats:p>", "")
                results.append({
                    "title": (item.get("title") or [""])[0],
                    "content": abstract,
                    "url": item.get("URL", ""),
                    "score": 0.6,
                })
            return results

    except Exception as e:
        print(f"⚠ CrossRef search failed: {e}")
        return []
