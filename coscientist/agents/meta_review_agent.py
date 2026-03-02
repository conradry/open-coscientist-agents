"""
Meta review agent
-----------------
- Formulates a research overview with memory
- Feedback from this agent is appended to the prompts of the
others in subsequent rounds.

More details:
- Takes in the tournament state with all debates and ELO ratings,
summarizes common patterns in the reviews and debates to synthesize
the meta-review feedback.
- Feedback helps to steer the Reflection agent so that it accounts
for common reasoning failures.
- Writes top hypotheses into a research overview that highlights
areas to follow up with real and specific experiments. This
gets fed to the Generation agent in later rounds. Format of the
overview can match the style of a review paper or a grant proposal
(like an NIH Specific Aims Page).
- Decides topics for additional research to follow up on.
"""

from typing import TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt
from coscientist.models.custom_types import ReviewedHypothesis
from coscientist.agents.ranking_agent import EloTournament


class MetaReviewTournamentState(TypedDict):
    """
    State for the `meta_review_tournament` prompt agent.
    """

    goal: str
    tournament: EloTournament
    top_k: int
    result: str


def build_meta_review_agent(llm: BaseChatModel) -> StateGraph:
    """
    Builds and configures a LangGraph for meta-review analysis.

    Parameters
    ----------
    llm : BaseChatModel
        The language model to use for meta-review generation.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the meta-review agent.
    """
    graph = StateGraph(MetaReviewTournamentState)

    graph.add_node(
        "meta_review",
        lambda state: _meta_review_node(state, llm),
    )

    graph.add_edge("meta_review", END)
    graph.set_entry_point("meta_review")
    return graph.compile()


def build_top_hypotheses_review_agent(llm: BaseChatModel) -> StateGraph:
    """
    Builds and configures a LangGraph for top hypotheses review analysis.

    Parameters
    ----------
    llm : BaseChatModel
        The language model to use for top hypotheses review generation.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the top hypotheses review agent.
    """
    graph = StateGraph(MetaReviewTournamentState)

    graph.add_node(
        "top_hypotheses_review",
        lambda state: _top_hypotheses_review_node(state, llm),
    )

    graph.add_edge("top_hypotheses_review", END)
    graph.set_entry_point("top_hypotheses_review")
    return graph.compile()


def _format_hypothesis_with_rating(
    hypothesis: ReviewedHypothesis, rating: float
) -> str:
    """Helper function to format a hypothesis with its ELO rating."""
    return f"Hypothesis {hypothesis.uid} (ELO: {rating:.2f}): {hypothesis.hypothesis}"


def _get_top_hypotheses_data(
    tournament: EloTournament, top_k: int
) -> list[tuple[str, float]]:
    """Helper function to get top k hypotheses sorted by ELO rating."""
    sorted_hypotheses = tournament.get_sorted_hypotheses()
    return sorted_hypotheses[:top_k]


def _meta_review_node(
    state: MetaReviewTournamentState,
    llm: BaseChatModel,
) -> MetaReviewTournamentState:
    """
    Meta-review node that synthesizes tournament data into a comprehensive meta-analysis.
    """
    tournament = state["tournament"]

    # Build ratings text - hypotheses sorted by ELO rating (highest to lowest)
    sorted_hypotheses = tournament.get_sorted_hypotheses()
    ratings_entries = []
    for hyp_id, rating in sorted_hypotheses:
        hypothesis = tournament.hypotheses[hyp_id]
        ratings_entries.append(_format_hypothesis_with_rating(hypothesis, rating))
    ratings_text = "\n".join(ratings_entries)

    # Build debates text from match history
    debates_entries = []
    for i, match_result in enumerate(tournament.match_history.values(), 1):
        debate_header = (
            f"Debate {i}: Hypothesis {match_result.uid1} vs Hypothesis {match_result.uid2} "
            f"(Winner: {match_result.winner})"
        )
        debates_entries.append(f"{debate_header}\n{match_result.debate}")
    debates_text = "\n\n".join(debates_entries)

    prompt = load_prompt(
        "meta_review_tournament",
        goal=state["goal"],
        ratings=ratings_text,
        debates=debates_text,
    )
    response_content = llm.invoke(prompt).content
    return {**state, "result": response_content}


def _top_hypotheses_review_node(
    state: MetaReviewTournamentState,
    llm: BaseChatModel,
) -> MetaReviewTournamentState:
    """
    Top hypotheses review node that creates a research overview from top-ranked hypotheses.
    """
    tournament = state["tournament"]
    top_k = state["top_k"]

    # Get top k hypotheses
    top_hypotheses_data = _get_top_hypotheses_data(tournament, top_k)

    # Build top hypotheses text with ratings
    top_hypotheses_entries = []
    for hyp_id, rating in top_hypotheses_data:
        hypothesis = tournament.hypotheses[hyp_id]
        top_hypotheses_entries.append(
            _format_hypothesis_with_rating(hypothesis, rating)
        )
    top_hypotheses_text = "\n".join(top_hypotheses_entries)

    # Build reviews text for top hypotheses
    reviews_entries = []
    for hyp_id, rating in top_hypotheses_data:
        hypothesis = tournament.hypotheses[hyp_id]
        reviews_entries.append(f"Review for Hypothesis {hyp_id}\n{hypothesis.verification_result}")
    reviews_text = "\n\n".join(reviews_entries)

    prompt = load_prompt(
        "top_hypotheses_review",
        goal=state["goal"],
        top_hypotheses=top_hypotheses_text,
        reviews=reviews_text,
    )
    response_content = llm.invoke(prompt).content
    return {**state, "result": response_content}
