"""
VerityLens Agent — FastAPI server for the Self-Correcting Agentic System.
Runs on port 8000 alongside the existing Node.js backend on port 5000.
"""
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from graph.workflow import workflow
from auth_service import register_user, login_user

app = FastAPI(
    title="VerityLens Agent",
    description="Self-Correcting Agentic Verification System powered by LangGraph",
    version="2.0.0",
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=50, max_length=35000)
    user_tier: Optional[str] = Field(default="enterprise")
    reference_document: Optional[str] = Field(default=None)


class AgentResponse(BaseModel):
    session_id: str | None = None
    created_at: str
    summary: dict
    claims: list[dict]
    citations: list[dict] = []
    capped: bool = False
    thinking_log: list[dict] = []
    fixed_claims: list[dict] = []
    iterations_used: int = 0
    agent_mode: bool = True


class AuthRequest(BaseModel):
    email: str
    password: str

@app.get("/")
async def root():
    return {
        "name": "VerityLens Agent API",
        "version": "2.0.0",
        "description": "Self-Correcting Agentic Verification System",
        "graph_nodes": ["miner", "researcher", "auditor", "fixer"],
        "loop": "Auditor → Researcher retry when confidence < 0.7",
    }


@app.get("/health")
async def health():
    from graph.tools.truthlens_api import health_check
    nodejs_ok = await health_check()
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "VerityLens Agent (LangGraph)",
        "nodejs_backend": "connected" if nodejs_ok else "unreachable",
    }

@app.post("/auth/signup")
async def signup(req: AuthRequest):
    success, msg = register_user(req.email, req.password)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg}

@app.post("/auth/login")
async def login(req: AuthRequest):
    success, msg = login_user(req.email, req.password)
    if not success:
        raise HTTPException(status_code=401, detail=msg)
    return {"status": "success", "message": msg}


@app.post("/agent/analyze")
async def agent_analyze(req: AnalyzeRequest):
    """
    Run the full LangGraph self-correcting pipeline.
    
    Flow: Miner → Researcher → Auditor →(loop if needed)→ Fixer → Done
    
    Returns the same structure as the Node.js API PLUS:
      - thinking_log: every agent step with timestamps
      - fixed_claims: rewritten hallucinated claims
      - iterations_used: how many retry loops were needed
    """
    try:
        # Run the LangGraph workflow
        initial_state = {
            "input_text": req.text,
            "user_tier": req.user_tier,
            "reference_document": req.reference_document,
            "claims": [],
            "evidence": [],
            "audit_results": [],
            "fixed_claims": [],
            "thinking_log": [],
            "current_iteration": 0,
            "low_confidence_indices": [],
            "refined_queries": [],
        }

        final_state = await workflow.ainvoke(initial_state)

        # Build response — merge Node.js response with agent enhancements
        raw_response = final_state.get("raw_node_js_response", {}) or {}
        claims = final_state.get("claims", [])
        audit_results = final_state.get("audit_results", [])
        fixed_claims = final_state.get("fixed_claims", [])

        # Check if ALL audit results are inconclusive (LLM was completely unavailable)
        factual_audits = [ar for ar in audit_results if ar.get("status") != "non_verifiable"]
        all_inconclusive = len(factual_audits) > 0 and all(
            ar.get("status") == "inconclusive" for ar in factual_audits
        )

        if all_inconclusive:
            # LLM was unavailable — fall back to Standard mode (Wikipedia-based verification)
            try:
                from graph.tools.truthlens_api import call_analyze
                standard_result = await call_analyze(req.text, req.user_tier)
                if standard_result and standard_result.get("claims"):
                    # Use Standard mode results directly, add agent metadata
                    std_claims = standard_result["claims"]
                    std_summary = standard_result.get("summary", {})
                    std_summary["llm_fallback"] = True
                    return {
                        "session_id": standard_result.get("session_id"),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "summary": std_summary,
                        "claims": std_claims,
                        "citations": standard_result.get("citations", []),
                        "capped": standard_result.get("capped", False),
                        "thinking_log": final_state.get("thinking_log", []) + [
                            {"step": 99, "node": "fallback", "action": "LLM unavailable — using Standard mode verification results", "detail": "", "ts": datetime.now(timezone.utc).isoformat()}
                        ],
                        "fixed_claims": [],
                        "iterations_used": final_state.get("current_iteration", 0),
                        "agent_mode": True,
                    }
            except Exception:
                pass  # Standard mode also failed — continue with inconclusive results

        # Merge audit verdicts back into claims (skip non_verifiable)
        for ar in audit_results:
            idx = ar.get("claim_index", 0)
            if idx < len(claims) and ar.get("status") != "non_verifiable":
                raw_status = ar["status"]
                conf = ar.get("confidence") or 0

                # Remap agent statuses to frontend statuses:
                # - verified → verified
                # - hallucinated → hallucinated
                # - inconclusive with high confidence → verified (evidence supports but LLM was uncertain)
                # - inconclusive with low confidence → unverified
                if raw_status == "verified":
                    mapped_status = "verified"
                elif raw_status == "hallucinated":
                    mapped_status = "hallucinated"
                elif raw_status == "inconclusive" and conf >= 0.55:
                    mapped_status = "verified"  # High enough confidence = verified
                else:
                    mapped_status = "unverified"

                claims[idx]["status"] = mapped_status
                claims[idx]["confidence"] = conf
                claims[idx]["agent_reasoning"] = ar.get("reasoning", "")
                claims[idx]["source_line"] = ar.get("source_line", "")

                # Update confidence label (matches scoring.js thresholds)
                if conf >= 0.80:
                    claims[idx]["confidence_label"] = "High Confidence"
                elif conf >= 0.55:
                    claims[idx]["confidence_label"] = "Verified"
                elif conf >= 0.30:
                    claims[idx]["confidence_label"] = "Medium Confidence"
                else:
                    claims[idx]["confidence_label"] = "Low Confidence"

        # Merge fixed claims
        for fc in fixed_claims:
            idx = fc.get("claim_index", 0)
            if idx < len(claims):
                claims[idx]["corrected_text"] = fc.get("corrected_text", "")
                claims[idx]["correction_source"] = fc.get("correction_source", "")

        # Recompute summary with agent-updated statuses (factual claims only)
        total_sentences = len(claims)
        factual_claims = [c for c in claims if c.get("is_factual", True)]
        non_verifiable_claims = [c for c in claims if not c.get("is_factual", True)]
        total = len(factual_claims)
        verified = sum(1 for c in factual_claims if c.get("status") == "verified")
        hallucinated = sum(1 for c in factual_claims if c.get("status") == "hallucinated")
        unverified = total - verified - hallucinated

        summary = raw_response.get("summary", {})
        summary.update({
            "total_claims": total,
            "total_sentences": total_sentences,
            "verified_count": verified,
            "unverified_count": unverified,
            "hallucinated_count": hallucinated,
            "non_verifiable_count": len(non_verifiable_claims),
            "trust_score": round((verified / total) * 100, 1) if total > 0 else 0,
        })

        return {
            "session_id": raw_response.get("session_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "summary": summary,
            "claims": claims,
            "citations": raw_response.get("citations", []),
            "capped": raw_response.get("capped", False),
            "thinking_log": final_state.get("thinking_log", []),
            "fixed_claims": fixed_claims,
            "iterations_used": final_state.get("current_iteration", 0),
            "agent_mode": True,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent pipeline error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", "8000"))
    print(f"\n[Agent] VerityLens Agent starting on http://localhost:{port}")
    print(f"   LLM Provider: {os.getenv('LLM_PROVIDER', 'openai')}")
    print(f"   Model: {os.getenv('LLM_MODEL', 'gpt-4o-mini')}")
    print(f"   Max retries: {os.getenv('MAX_RETRIES', '3')}")
    print(f"   Node.js backend: {os.getenv('TRUTHLENS_API_URL', 'http://localhost:5000')}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
