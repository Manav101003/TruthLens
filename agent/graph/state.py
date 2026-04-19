"""
AgentState — The shared state that flows through all LangGraph nodes.
Every node reads from and writes to this state object.
"""
from typing import TypedDict, Optional


class SourceResult(TypedDict, total=False):
    source: str
    query: str
    found: bool
    extract: str
    url: str
    relevance: float


class ClaimEvidence(TypedDict, total=False):
    claim_index: int
    claim_text: str
    sources: list[SourceResult]
    best_extract: str


class AuditVerdict(TypedDict, total=False):
    claim_index: int
    claim_text: str
    status: str            # "verified" | "inconclusive" | "hallucinated"
    confidence: float      # 0.0 - 1.0
    reasoning: str
    evidence_used: str


class FixedClaim(TypedDict, total=False):
    claim_index: int
    original_text: str
    corrected_text: str
    correction_source: str
    reasoning: str


class ThinkingStep(TypedDict, total=False):
    step: int
    node: str              # "miner" | "researcher" | "auditor" | "fixer"
    action: str            # Human-readable description
    detail: str            # Optional extra detail
    ts: str                # ISO timestamp


class AgentState(TypedDict, total=False):
    """The full state that flows through the LangGraph pipeline."""
    # Input
    input_text: str
    reference_document: Optional[str]      # Internal Knowledge Base
    user_tier: str                         # "basic" | "business" | "enterprise"
    topic_domain: str                      # e.g., "Finance", "Tech", "Legal"

    # Node A output
    claims: list[dict]
    raw_node_js_response: Optional[dict]   # Full response from existing API

    # Node B output
    evidence: list[ClaimEvidence]

    # Node C output
    audit_results: list[AuditVerdict]

    # Node D output
    fixed_claims: list[FixedClaim]

    # Loop control
    current_iteration: int
    low_confidence_indices: list[int]      # Claim indices needing re-research
    refined_queries: list[str]             # Better queries for retry

    # Traceability
    thinking_log: list[ThinkingStep]

    # Error handling
    error: Optional[str]
