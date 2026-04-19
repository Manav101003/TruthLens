"""
Node D — THE FIXER
For hallucinated claims, uses LLM + evidence to rewrite
the original sentence into a factually correct version.
"""
import json
from datetime import datetime, timezone
from models.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

FIXER_SYSTEM_PROMPT = """You are a precise fact-correction editor. You receive claims that have been identified as HALLUCINATED or INCONCLUSIVE (factually incorrect or unsupported).

For each problematic claim, you will receive:
1. The original claim text
2. The evidence that contradicts it or clarifies it
3. The auditor's reasoning

Your job: Rewrite ONLY the factually incorrect parts while preserving the original sentence structure and tone.

Output a JSON array where each element has:
- "claim_index": the index of the claim
- "original_text": the original claim
- "corrected_text": the factually corrected version
- "correction_source": which source provided the correct fact
- "reasoning": what you changed and why (1 sentence)

Rules:
- Only change factually wrong parts. Keep the sentence natural.
- If you can't determine the correct fact from evidence, write "Unable to verify — [original claim with caveat]"
- Be concise and precise.

Respond ONLY with a valid JSON array, no markdown fences."""


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


async def fixer_node(state: dict) -> dict:
    """
    Node D: Rewrite hallucinated claims using evidence.
    Only processes claims marked as 'hallucinated' by the Auditor.
    """
    audit_results = state.get("audit_results", [])
    evidence = state.get("evidence", [])
    claims = state.get("claims", [])
    updates = {}

    # Find hallucinated and inconclusive claims
    hallucinated = [ar for ar in audit_results if ar.get("status") in ["hallucinated", "inconclusive"]]

    if not hallucinated:
        log_update = _log(state, "fixer", "No problematic claims to fix -- all claims are clean!")
        updates.update(log_update)
        updates["fixed_claims"] = []
        return updates

    log_update = _log(state, "fixer",
        f"Fixing {len(hallucinated)} hallucinated claims",
    )
    updates.update(log_update)

    # Build prompt for the Fixer LLM
    claims_to_fix = []
    for h in hallucinated:
        idx = h.get("claim_index", 0)
        evidence_text = h.get("evidence_used", "No evidence available")

        # Also get full evidence from researcher
        full_evidence = [e for e in evidence if e.get("claim_index") == idx]
        if full_evidence:
            all_extracts = []
            for fe in full_evidence:
                for src in fe.get("sources", []):
                    all_extracts.append(f"[{src.get('source', '')}] {src.get('extract', '')[:300]}")
            evidence_text = "\n".join(all_extracts) if all_extracts else evidence_text

        claims_to_fix.append({
            "claim_index": idx,
            "original_text": h.get("claim_text", ""),
            "evidence": evidence_text[:600],
            "auditor_reasoning": h.get("reasoning", ""),
        })

    user_prompt = "Fix these hallucinated claims using the evidence:\n\n"
    for c in claims_to_fix:
        user_prompt += f"--- CLAIM #{c['claim_index'] + 1} ---\n"
        user_prompt += f"Original: \"{c['original_text']}\"\n"
        user_prompt += f"Evidence:\n{c['evidence']}\n"
        user_prompt += f"Auditor's reasoning: {c['auditor_reasoning']}\n\n"

    try:
        llm = get_llm(temperature=0.2)
        response = await llm.ainvoke([
            SystemMessage(content=FIXER_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ])

        response_text = response.content.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

        fixed_claims = json.loads(response_text)

    except Exception as e:
        log_update = _log({**state, **updates}, "fixer",
            f"⚠ Fixer LLM failed: {str(e)[:80]}. Marking claims as unfixable."
        )
        updates.update(log_update)
        fixed_claims = [
            {
                "claim_index": c["claim_index"],
                "original_text": c["original_text"],
                "corrected_text": f"[Unverified] {c['original_text']}",
                "correction_source": "Unable to auto-correct",
                "reasoning": "LLM unavailable for correction",
            }
            for c in claims_to_fix
        ]

    # Log each fix
    for fc in fixed_claims:
        idx = fc.get("claim_index", 0)
        original = fc.get("original_text", "")[:60]
        corrected = fc.get("corrected_text", "")[:60]
        log_update = _log({**state, **updates}, "fixer",
            f"Claim #{idx + 1}: Rewrote '{original}...' → '{corrected}...'",
            fc.get("reasoning", "")[:120]
        )
        updates.update(log_update)

    updates["fixed_claims"] = fixed_claims

    log_update = _log({**state, **updates}, "fixer",
        f"✅ Fixed {len(fixed_claims)} claims"
    )
    updates.update(log_update)

    return updates
