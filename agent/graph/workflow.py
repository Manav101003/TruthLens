"""
LangGraph Workflow — The Self-Correcting StateGraph.

Architecture:
  Miner → Researcher → Auditor →(conditional)→ Researcher (retry) OR Fixer → END

The Loop (USP): If the Auditor's confidence is below threshold,
the agent loops back to the Researcher with refined queries.
Max 3 iterations to prevent infinite loops.
"""
import os
from langgraph.graph import StateGraph, END
from graph.state import AgentState
from graph.nodes.miner import miner_node
from graph.nodes.researcher import researcher_node
from graph.nodes.auditor import auditor_node
from graph.nodes.fixer import fixer_node

MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))


def should_retry_or_fix(state: dict) -> str:
    """
    Conditional edge after the Auditor node.
    Decides whether to:
      - "retry": loop back to Researcher (confidence too low, retries remaining)
      - "fix": go to Fixer (has hallucinated claims)
      - "done": exit graph (all claims are solid)
    """
    iteration = state.get("current_iteration", 0)
    low_conf = state.get("low_confidence_indices", [])
    audit_results = state.get("audit_results", [])
    user_tier = state.get("user_tier", "enterprise")

    # Tier-aware retry limits: Basic gets 1 retry, others get MAX_RETRIES
    max_retries = 1 if user_tier == "basic" else MAX_RETRIES

    # Check if we have retries left and low-confidence claims
    if low_conf and iteration < max_retries:
        return "retry"

    # Tier Basic: No Auto-Correction (skip fixer)
    if user_tier == "basic":
        return "done"

    # Check if any claims are hallucinated or inconclusive → needs fixing
    needs_fixing = any(
        ar.get("status") in ["hallucinated", "inconclusive"]
        for ar in audit_results
    )
    if needs_fixing:
        return "fix"

    # All good — exit
    return "done"


def build_workflow():
    """
    Construct and compile the LangGraph workflow.
    Returns a compiled graph ready to invoke.
    """
    graph = StateGraph(AgentState)

    # Add all 4 nodes
    graph.add_node("miner", miner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("auditor", auditor_node)
    graph.add_node("fixer", fixer_node)

    # Set entry point
    graph.set_entry_point("miner")

    # Linear edges
    graph.add_edge("miner", "researcher")
    graph.add_edge("researcher", "auditor")

    # THE LOOP — conditional edge from Auditor
    graph.add_conditional_edges(
        "auditor",
        should_retry_or_fix,
        {
            "retry": "researcher",   # Loop back for better evidence
            "fix": "fixer",          # Fix hallucinated claims
            "done": END,             # All verified — exit
        }
    )

    # Fixer always ends the graph
    graph.add_edge("fixer", END)

    return graph.compile()


# Singleton compiled workflow
workflow = build_workflow()
