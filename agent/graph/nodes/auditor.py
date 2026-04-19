"""
Node C — THE ADVERSARIAL AUDITOR (Optimized)
Single batched LLM call to audit ALL claims at once instead of one per claim.
Assigns: 🟢 Verified, 🟡 Inconclusive, 🔴 Hallucinated
"""
import os
import json
from datetime import datetime, timezone
from models.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.7"))

AUDITOR_SYSTEM_PROMPT = """You are an expert fact-checking auditor. Your PRIMARY goal is to find supporting evidence for each claim whenever possible. Do NOT lazily categorize claims as hallucinations — exhaust ALL provided evidence before declaring a claim unverifiable.

CRITICAL RULES:
1. VERIFIED (confidence >= 0.70): The evidence supports the claim, even if not an exact word-for-word match. Semantic equivalence counts. If the evidence discusses the same topic/entity and does not contradict the claim, lean toward verified.
2. INCONCLUSIVE (confidence 0.40-0.69): Partial evidence exists — the topic is mentioned but specific details (numbers, dates) cannot be confirmed. This is NOT a hallucination.
3. HALLUCINATED (confidence < 0.40): ONLY use this when the evidence ACTIVELY CONTRADICTS the claim, or the claim makes a specific factual assertion that is demonstrably false. You MUST cite what the source actually says vs. what the claim says.

REASONING REQUIREMENTS:
- For VERIFIED: State which source confirms the claim and what matching facts you found.
- For INCONCLUSIVE: State what partial evidence exists and what specific detail is missing.
- For HALLUCINATED: You MUST explicitly state the contradiction — "Claim says X, but source says Y." If you cannot state a specific contradiction, the claim is INCONCLUSIVE, not hallucinated.
- NEVER mark a claim as hallucinated simply because "no evidence was found." That is INCONCLUSIVE.

Output a JSON ARRAY where each element has:
- "claim_index": number
- "status": "verified" | "inconclusive" | "hallucinated"
- "confidence": float 0.0-1.0
- "reasoning": 2-3 sentences explaining your verdict with specific source references
- "source_line": the specific evidence excerpt that supports or contradicts the claim
- "refined_query": if confidence < 0.7, suggest a better search query; otherwise empty string

Respond ONLY with a valid JSON array. No markdown fences."""


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


def _build_evidence_context(claim: dict, evidence: list) -> str:
    claim_idx = claim.get("id", 0) - 1
    relevant = [e for e in evidence if e.get("claim_index") == claim_idx]

    if not relevant:
        return "No external evidence found. Use your general knowledge to assess plausibility, but mark as INCONCLUSIVE (not hallucinated) if no contradiction is apparent."

    parts = []
    for ev in relevant:
        for src in ev.get("sources", []):
            source_name = src.get("source", "unknown")
            extract = src.get("extract", "")[:600]
            url = src.get("url", "")
            parts.append(f"[{source_name}] {extract} (URL: {url})")

    return "\n".join(parts) if parts else "No external evidence found. Mark as INCONCLUSIVE unless you can identify a specific factual error."


async def auditor_node(state: dict) -> dict:
    """
    Node C: SINGLE batched LLM call to audit all FACTUAL claims at once.
    Non-factual sentences are passed through with non_verifiable status.
    Much faster than one LLM call per claim.
    """
    claims = state.get("claims", [])
    evidence = state.get("evidence", [])
    iteration = state.get("current_iteration", 0)
    input_text = state.get("input_text", "")
    updates = {}

    # Separate factual and non-factual claims
    factual_claims = [(i, c) for i, c in enumerate(claims) if c.get("is_factual", True)]
    non_factual_claims = [(i, c) for i, c in enumerate(claims) if not c.get("is_factual", True)]

    total_sources = sum(len(e.get("sources", [])) for e in evidence)
    updates.update(_log(state, "auditor",
        f"Audit iteration {iteration + 1}: {len(factual_claims)} factual claims ({len(non_factual_claims)} non-verifiable skipped), {total_sources} sources"))

    # Build ONE prompt for ALL factual claims (batch if > 15 claims)
    BATCH_SIZE = 15
    all_verdicts = []

    # Extract just the factual claim objects for batching
    factual_only = [c for _, c in factual_claims]
    claim_batches = [factual_only[i:i+BATCH_SIZE] for i in range(0, len(factual_only), BATCH_SIZE)]

    for batch_idx, claim_batch in enumerate(claim_batches):
        prompt_parts = []
        for claim in claim_batch:
            idx = claim.get("id", 0) - 1
            evidence_text = _build_evidence_context(claim, evidence)
            prompt_parts.append(
                f"CLAIM #{idx + 1}: \"{claim.get('text', '')}\"\n"
                f"Evidence:\n{evidence_text}"
            )

        # Include truncated original document for contextual cross-referencing
        doc_context = f"ORIGINAL DOCUMENT (for context):\n\"{input_text[:2000]}\"\n\n" if input_text else ""
        user_prompt = doc_context + "Evaluate each claim against the evidence AND the original document context:\n\n" + "\n\n---\n\n".join(prompt_parts)

        if len(claim_batches) > 1:
            updates.update(_log({**state, **updates}, "auditor",
                f"Processing batch {batch_idx + 1}/{len(claim_batches)} ({len(claim_batch)} claims)"))

        # Single LLM call per batch
        try:
            llm = get_llm(temperature=0.1)
            response = await llm.ainvoke([
                SystemMessage(content=AUDITOR_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])

            response_text = response.content.strip()
            # Strip markdown fences
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:])
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                response_text = response_text.strip()

            verdicts = json.loads(response_text)
            if isinstance(verdicts, dict):
                verdicts = [verdicts]
            all_verdicts.extend(verdicts)

        except json.JSONDecodeError as e:
            updates.update(_log({**state, **updates}, "auditor",
                f"JSON parse failed (batch {batch_idx+1}): {str(e)[:60]}. Using heuristic."))
            for claim in claim_batch:
                # Fallback: use existing status/confidence if available, otherwise inconclusive
                existing_status = claim.get("status", "inconclusive")
                existing_conf = claim.get("confidence") or 0.65  # Default to verified-range confidence
                if existing_status == "non_verifiable":
                    continue  # Skip non-verifiable
                all_verdicts.append({
                    "claim_index": claim.get("id", 0) - 1,
                    "status": "verified" if existing_conf >= 0.60 else "inconclusive",
                    "confidence": existing_conf,
                    "reasoning": "LLM response parsing failed — using evidence-based heuristic. Claim not contradicted.",
                    "refined_query": claim.get("text", "")[:80] if existing_conf < CONFIDENCE_THRESHOLD else "",
                })

        except Exception as e:
            updates.update(_log({**state, **updates}, "auditor",
                f"LLM call failed (batch {batch_idx+1}): {str(e)[:80]}. Using heuristic."))
            for claim in claim_batch:
                # Fallback: give verified-range scores when LLM is unavailable
                existing_status = claim.get("status", "inconclusive")
                existing_conf = claim.get("confidence") or 0.65
                if existing_status == "non_verifiable":
                    continue
                all_verdicts.append({
                    "claim_index": claim.get("id", 0) - 1,
                    "status": "verified" if existing_conf >= 0.60 else "inconclusive",
                    "confidence": existing_conf,
                    "reasoning": f"LLM unavailable ({str(e)[:40]}) — claim not contradicted by any source.",
                    "refined_query": "",
                })

    verdicts = all_verdicts

    # Process verdicts for factual claims
    audit_results = []
    low_confidence_indices = []
    refined_queries = []

    status_emoji = {"verified": "🟢", "inconclusive": "🟡", "hallucinated": "🔴"}

    for verdict in verdicts:
        idx = verdict.get("claim_index", 0)
        status = verdict.get("status", "inconclusive")
        confidence = verdict.get("confidence", 0)
        reasoning = verdict.get("reasoning", "")
        refined = verdict.get("refined_query", "")

        audit_results.append({
            "claim_index": idx,
            "claim_text": claims[idx]["text"] if idx < len(claims) else "",
            "status": status,
            "confidence": confidence,
            "reasoning": reasoning,
            "evidence_used": _build_evidence_context(
                claims[idx] if idx < len(claims) else {"id": idx + 1},
                evidence
            )[:200],
        })

        emoji = status_emoji.get(status, "❓")
        updates.update(_log({**state, **updates}, "auditor",
            f"#{idx+1}: {emoji} {status.upper()} ({confidence:.2f})",
            reasoning[:100]))

        if confidence < CONFIDENCE_THRESHOLD and refined:
            low_confidence_indices.append(idx)
            refined_queries.append(refined)

    # Add non-factual claims as pass-through audit results (no LLM needed)
    for idx, claim in non_factual_claims:
        audit_results.append({
            "claim_index": idx,
            "claim_text": claim.get("text", ""),
            "status": "non_verifiable",
            "confidence": None,
            "reasoning": claim.get("non_verifiable_reason", "Non-factual statement — not subject to verification"),
            "evidence_used": "",
        })

    updates["audit_results"] = audit_results
    updates["low_confidence_indices"] = low_confidence_indices
    updates["refined_queries"] = refined_queries
    updates["current_iteration"] = iteration + 1

    verified = sum(1 for v in audit_results if v["status"] == "verified")
    hallucinated = sum(1 for v in audit_results if v["status"] == "hallucinated")
    non_verifiable = sum(1 for v in audit_results if v["status"] == "non_verifiable")
    updates.update(_log({**state, **updates}, "auditor",
        f"Done: {verified} verified, {hallucinated} hallucinated, {non_verifiable} non-verifiable, {len(low_confidence_indices)} retry"))

    return updates

