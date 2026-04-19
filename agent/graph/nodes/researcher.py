"""
Node B — MULTI-SOURCE RESEARCHER (Optimized)
Features:
- Hierarchical Grounding: Fast string-matching against reference_document (NO LLM call).
- Context-Aware Scraper: Single LLM call for domain classification (cached).
- Business Tier logic: Basic tier only uses Wikipedia.
- Async Batching: Processes multiple web searches concurrently.
"""
import asyncio
import json
from datetime import datetime, timezone
from graph.tools.serper_search import serper_web_search, serper_news_search
from models.llm import get_llm
from langchain_core.messages import HumanMessage


def _log(state: dict, node: str, action: str, detail: str = "") -> dict:
    log = state.get("thinking_log", [])
    log.append({
        "step": len(log) + 1,
        "node": node,
        "action": action,
        "detail": detail,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"thinking_log": log}


async def _classify_domain(text: str) -> str:
    """Single LLM call to classify the topic domain."""
    llm = get_llm(temperature=0.0)
    prompt = (
        "Classify this text into ONE topic domain "
        "(Tech, Finance, Legal, History, Science, Health, Politics, Sports, General). "
        "Output ONLY the domain name.\n\n"
        f"Text: {text[:500]}"
    )
    try:
        res = await llm.ainvoke([HumanMessage(content=prompt)])
        return res.content.strip()
    except Exception:
        return "General"


def _check_internal_grounding_fast(claim_text: str, reference_document: str) -> dict:
    """
    Fast string-matching internal grounding — NO LLM call.
    Checks if key words from the claim appear in the reference document.
    """
    if not reference_document or not claim_text:
        return {"found": False, "extract": ""}

    claim_lower = claim_text.lower()
    ref_lower = reference_document.lower()

    # Extract key noun phrases from claim (words > 3 chars, skip stopwords)
    stopwords = {"the", "and", "was", "were", "that", "this", "with", "from",
                 "for", "are", "has", "had", "been", "have", "its", "also",
                 "not", "but", "can", "will", "which", "their", "than", "about",
                 "over", "into", "more", "most", "only", "very", "between"}
    words = [w.strip(".,;:!?\"'()[]") for w in claim_text.split()]
    key_words = [w for w in words if len(w) > 3 and w.lower() not in stopwords]

    if not key_words:
        return {"found": False, "extract": ""}

    # Count how many key words appear in the reference document
    matches = sum(1 for w in key_words if w.lower() in ref_lower)
    match_ratio = matches / len(key_words) if key_words else 0

    if match_ratio >= 0.6:
        # Find the best matching sentence in the document
        sentences = [s.strip() for s in reference_document.replace('\n', '. ').split('.') if len(s.strip()) > 15]
        best_sentence = ""
        best_score = 0
        for sentence in sentences[:50]:  # Cap at 50 sentences for speed
            s_lower = sentence.lower()
            score = sum(1 for w in key_words if w.lower() in s_lower)
            if score > best_score:
                best_score = score
                best_sentence = sentence

        return {
            "found": True,
            "extract": best_sentence[:300] if best_sentence else "Found in document"
        }

    return {"found": False, "extract": ""}


async def _process_claim(idx, claim, iteration, refined_queries, topic_domain, user_tier, reference_document):
    """Process a single claim: Internal Grounding -> Wiki -> Serper (all fast)."""
    claim_text = claim.get("text", "")
    claim_evidence = {
        "claim_index": idx,
        "claim_text": claim_text,
        "sources": [],
        "best_extract": "",
    }
    logs = []

    # 1. Fast Internal Grounding (string match, no LLM)
    if reference_document:
        grounding = _check_internal_grounding_fast(claim_text, reference_document)
        if grounding.get("found"):
            claim_evidence["sources"].append({
                "source": "internal_document",
                "query": "internal",
                "found": True,
                "extract": grounding.get("extract", ""),
                "url": "Primary Truth",
                "relevance": 0.85,
            })
            logs.append(f"Claim #{idx+1}: Matched in Internal Document (fast match)")
            claim_evidence["best_extract"] = grounding.get("extract", "")
            return claim_evidence, logs
        else:
            logs.append(f"Claim #{idx+1}: Not in reference doc -> web search")

    # 2. Wikipedia (from Miner / Node.js response)
    wiki_confidence = claim.get("confidence", 0)
    wiki_source = claim.get("source_title")
    wiki_snippet = claim.get("source_snippet", "")

    if wiki_source:
        claim_evidence["sources"].append({
            "source": "wikipedia",
            "query": wiki_source,
            "found": True,
            "extract": wiki_snippet,
            "url": claim.get("source_url", ""),
            "relevance": wiki_confidence,
        })
        logs.append(f"Claim #{idx+1}: Wiki '{wiki_source}' ({wiki_confidence:.2f})")

    # 3. Serper (Business/Enterprise only, if wiki is weak)
    if user_tier in ["business", "enterprise"] and (wiki_confidence < 0.5 or iteration > 0):
        search_query = (
            refined_queries[idx] if iteration > 0 and idx < len(refined_queries) else claim_text
        )

        news_keywords = ["announced", "launched", "released", "today", "yesterday", "recent"]
        is_news = any(kw in claim_text.lower() for kw in news_keywords)

        if is_news:
            serper_results = await serper_news_search(f"{topic_domain} {search_query}", max_results=2)
        else:
            serper_results = await serper_web_search(f"{topic_domain} {search_query}", max_results=2)

        if serper_results:
            for sr in serper_results:
                claim_evidence["sources"].append({
                    "source": "serper",
                    "query": search_query[:60],
                    "found": True,
                    "extract": sr.get("content", "")[:300],
                    "url": sr.get("url", ""),
                    "relevance": sr.get("score", 0.5),
                })
            logs.append(f"Claim #{idx+1}: Serper found {len(serper_results)} results")
        else:
            logs.append(f"Claim #{idx+1}: Serper returned nothing")

    # Best extract
    if claim_evidence["sources"]:
        best = max(claim_evidence["sources"], key=lambda s: s.get("relevance", 0))
        claim_evidence["best_extract"] = best.get("extract", "")

    return claim_evidence, logs


async def researcher_node(state: dict) -> dict:
    claims = state.get("claims", [])
    existing_evidence = state.get("evidence", [])
    iteration = state.get("current_iteration", 0)
    low_conf_indices = state.get("low_confidence_indices", [])
    refined_queries = state.get("refined_queries", [])
    user_tier = state.get("user_tier", "enterprise").lower()
    reference_document = state.get("reference_document") or ""
    topic_domain = state.get("topic_domain", "")

    updates = {}

    # Classify domain once (single LLM call, first pass only)
    if not topic_domain and iteration == 0:
        topic_domain = await _classify_domain(state.get("input_text", ""))
        updates["topic_domain"] = topic_domain
        updates.update(_log(state, "researcher", f"Domain: {topic_domain}"))

    # Which claims to research — only factual claims, skip non_verifiable
    if iteration > 0 and low_conf_indices:
        indices = low_conf_indices
        updates.update(_log({**state, **updates}, "researcher",
            f"Retry {iteration}: re-researching {len(indices)} claims"))
    else:
        # Only research factual claims
        indices = [i for i, c in enumerate(claims) if c.get("is_factual", True)]
        factual_count = len(indices)
        non_factual_count = len(claims) - factual_count
        updates.update(_log({**state, **updates}, "researcher",
            f"Researching {factual_count} factual claims, skipping {non_factual_count} non-verifiable (Tier: {user_tier}, Domain: {topic_domain})"))

    evidence_list = list(existing_evidence)

    # Async batch all factual claims
    tasks = [
        _process_claim(idx, claims[idx], iteration, refined_queries,
                       topic_domain, user_tier, reference_document)
        for idx in indices if idx < len(claims) and claims[idx].get("is_factual", True)
    ]
    results = await asyncio.gather(*tasks)

    # Merge
    for claim_evidence, logs in results:
        idx = claim_evidence["claim_index"]
        for msg in logs:
            updates.update(_log({**state, **updates}, "researcher", msg))

        existing_idx = next((i for i, e in enumerate(evidence_list) if e.get("claim_index") == idx), None)
        if existing_idx is not None:
            evidence_list[existing_idx]["sources"].extend(claim_evidence["sources"])
            if claim_evidence["best_extract"]:
                evidence_list[existing_idx]["best_extract"] = claim_evidence["best_extract"]
        else:
            evidence_list.append(claim_evidence)

    updates["evidence"] = evidence_list
    total = sum(len(e.get("sources", [])) for e in evidence_list)
    updates.update(_log({**state, **updates}, "researcher", f"Done: {total} sources gathered"))

    return updates

