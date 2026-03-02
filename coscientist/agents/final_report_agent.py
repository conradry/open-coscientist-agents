"""
Final report agent
------------------
- Generates a comprehensive scientific research report
- Takes tournament results and formats them into a professional report
- Provides detailed analysis of top-ranked hypotheses with experimental suggestions

More details:
- Formats all hypotheses by ELO ranking for overview
- Provides detailed information for top k hypotheses including causal reasoning,
  verification results, and falsifiable predictions
- Generates a structured scientific report suitable for domain experts
"""

from typing import TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt
from coscientist.models.custom_types import ReviewedHypothesis
from coscientist.agents.ranking_agent import EloTournament


class FinalReportState(TypedDict):
    """
    State for the final report agent.
    """

    goal: str
    tournament: EloTournament
    top_k: int
    result: str


def build_final_report_agent(llm: BaseChatModel) -> StateGraph:
    """
    Builds and configures a LangGraph for final report generation.

    Parameters
    ----------
    llm : BaseChatModel
        The language model to use for final report generation.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the final report agent.
    """
    graph = StateGraph(FinalReportState)

    graph.add_node(
        "final_report",
        lambda state: _final_report_node(state, llm),
    )

    graph.add_edge("final_report", END)
    graph.set_entry_point("final_report")
    return graph.compile()


def _format_hypothesis_with_rating(
    hypothesis: ReviewedHypothesis, rating: float
) -> str:
    """Helper function to format a hypothesis with its ELO rating."""
    return f"Hypothesis {hypothesis.uid} (ELO: {rating:.2f}): {hypothesis.hypothesis}"


def _format_detailed_hypothesis(hypothesis: ReviewedHypothesis, rating: float) -> str:
    """Helper function to format a hypothesis with detailed information."""
    sections = [
        f"## Hypothesis {hypothesis.uid} (ELO: {rating:.2f})",
        f"**Hypothesis Statement:** {hypothesis.hypothesis}",
        f"**Causal Reasoning:** {hypothesis.causal_reasoning}",
        f"**Verification Result:** {hypothesis.verification_result}",
        f"**Falsifiable Predictions:** {' '.join(hypothesis.predictions)}",
    ]
    return "\n\n".join(sections)


def _get_top_hypotheses_data(
    tournament: EloTournament, top_k: int
) -> list[tuple[str, float]]:
    """Helper function to get top k hypotheses sorted by ELO rating."""
    sorted_hypotheses = tournament.get_sorted_hypotheses()
    return sorted_hypotheses[:top_k]


def _final_report_node(
    state: FinalReportState,
    llm: BaseChatModel,
) -> FinalReportState:
    """
    Final report node that generates a comprehensive scientific research report.
    """
    tournament = state["tournament"]
    top_k = state.get("top_k", 3)  # Default to top 3 hypotheses

    # Build hypotheses by ranking - all hypotheses sorted by ELO rating
    sorted_hypotheses = tournament.get_sorted_hypotheses()
    hypotheses_by_ranking_entries = []
    for hyp_id, rating in sorted_hypotheses:
        hypothesis = tournament.hypotheses[hyp_id]
        hypotheses_by_ranking_entries.append(
            _format_hypothesis_with_rating(hypothesis, rating)
        )
    hypotheses_by_ranking_text = "\n".join(hypotheses_by_ranking_entries)

    # Build detailed top hypotheses information
    top_hypotheses_data = _get_top_hypotheses_data(tournament, top_k)
    top_ranked_hypotheses_entries = []
    for hyp_id, rating in top_hypotheses_data:
        hypothesis = tournament.hypotheses[hyp_id]
        top_ranked_hypotheses_entries.append(
            _format_detailed_hypothesis(hypothesis, rating)
        )
    top_ranked_hypotheses_text = "\n\n".join(top_ranked_hypotheses_entries)

    prompt = load_prompt(
        "final_report",
        goal=state["goal"],
        hypotheses_by_ranking=hypotheses_by_ranking_text,
        top_ranked_hypotheses=top_ranked_hypotheses_text,
    )
    response_content = llm.invoke(prompt).content
    return {**state, "result": response_content}
