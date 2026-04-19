"""
Node A — THE MINER
Uses the existing Node.js TruthLens API to extract claims from input text.
Your existing claim extraction logic is the 'Primary Tool' here.
Now returns ALL sentences (factual + non-factual) for full-document verification.
"""
from datetime import datetime, timezone
from graph.tools.truthlens_api import call_extract

def _log(state: dict, node: str, action: str, detail: str = "") -> dict:
    """Append a thinking step to the trace log."""
    log = state.get("thinking_log", [])
    log.append({
        "step": len(log) + 1,
        "node": node,
        "action": action,
        "detail": detail,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"thinking_log": log}


async def miner_node(state: dict) -> dict:
    """
    Node A: Call the existing Node.js API to extract ALL sentences.
    Factual claims are formatted for verification; non-factual pass through.
    This preserves your NLP extraction while providing full-document coverage.
    """
    input_text = state["input_text"]
    updates = {}

    # Log start
    log_update = _log(state, "miner", f"Starting full-document extraction on {len(input_text)} chars of text")
    updates.update(log_update)

    try:
        # Call Node.js extraction (now returns ALL sentences with is_factual flag)
        api_response = await call_extract(input_text)

        all_sentences = api_response.get("claims", [])
            
        # Format all sentences — both factual and non-factual
        formatted_claims = []
        factual_count = 0
        non_factual_count = 0

        for i, c in enumerate(all_sentences):
            if isinstance(c, dict) and c.get("is_factual", True):
                factual_count += 1
                formatted_claims.append({
                    "id": i + 1,
                    "text": c.get("text", ""),
                    "status": "unverified",
                    "confidence": 0,
                    "is_factual": True,
                })
            elif isinstance(c, dict):
                non_factual_count += 1
                formatted_claims.append({
                    "id": i + 1,
                    "text": c.get("text", ""),
                    "status": "non_verifiable",
                    "confidence": None,
                    "is_factual": False,
                    "non_verifiable_reason": c.get("non_verifiable_reason", "No verifiable factual signal detected"),
                })
            else:
                factual_count += 1
                formatted_claims.append({
                    "id": i + 1,
                    "text": str(c),
                    "status": "unverified",
                    "confidence": 0,
                    "is_factual": True,
                })
            
        updates["claims"] = formatted_claims
        updates["raw_node_js_response"] = {
            "summary": {"trust_score": 0, "verified_count": 0, "hallucinated_count": 0},
            "claims": formatted_claims
        }
        updates["current_iteration"] = 0
        updates["low_confidence_indices"] = []
        updates["refined_queries"] = []
        updates["evidence"] = []

        # Log success
        log_update = _log(
            {**state, **updates}, "miner",
            f"✅ Extracted {len(formatted_claims)} sentences ({factual_count} factual, {non_factual_count} non-verifiable)",
            ""
        )
        updates.update(log_update)

    except Exception as e:
        # Log failure
        log_update = _log(
            {**state, **updates}, "miner",
            f"⚠ Node.js API unavailable: {str(e)[:100]}. Using fallback extraction.",
        )
        updates.update(log_update)

        # Minimal fallback: split into sentences as crude claims (all treated as factual)
        sentences = [s.strip() for s in input_text.split(".") if len(s.strip()) > 20]
        updates["claims"] = [
            {"id": i + 1, "text": s, "status": "unverified", "confidence": 0, "is_factual": True}
            for i, s in enumerate(sentences)
        ]
        updates["raw_node_js_response"] = None
        updates["current_iteration"] = 0
        updates["low_confidence_indices"] = []
        updates["refined_queries"] = []
        updates["evidence"] = []

    return updates

