"""
Supervisor agent
----------------
- Analyzes the current state of the research process
- Decides what actions to take next to advance scientific hypothesis
  generation, evaluation, and refinement
- Uses strategic decision-making framework to balance exploration vs exploitation

More details:
- Takes in comprehensive system statistics and meta-reviews
- Makes strategic decisions about next steps in the research process
- Balances between generating new hypotheses, evolving existing ones,
  running tournaments, expanding literature review, or finishing
- Considers quality metrics, diversity metrics, and research momentum
"""

import re
from typing import TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt


class SupervisorDecisionState(TypedDict):
    """
    State for the supervisor decision agent.
    """

    goal: str
    meta_review: str
    previous_meta_review: str
    total_actions: int
    latest_actions: str
    total_hypotheses: int
    num_unranked_hypotheses: int
    num_meta_reviews: int
    new_hypotheses_since_meta_review: int
    total_matches_played: int
    total_rounds_played: int
    top_3_elo_ratings: str
    max_elo_rating: str
    num_elo_ratings_over_1400: str
    median_elo_rating: str
    cosine_similarity_trajectory: str
    cluster_count_trajectory: str
    literature_review_subtopics_completed: int
    action: str
    decision_reasoning: str


def build_supervisor_agent(llm: BaseChatModel) -> StateGraph:
    """
    Builds and configures a LangGraph for supervisor decision-making.

    Parameters
    ----------
    llm : BaseChatModel
        The language model to use for supervisor decisions.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the supervisor agent.
    """
    graph = StateGraph(SupervisorDecisionState)

    graph.add_node(
        "supervisor_decision",
        lambda state: _supervisor_decision_node(state, llm),
    )

    graph.add_edge("supervisor_decision", END)
    graph.set_entry_point("supervisor_decision")
    return graph.compile()


def _parse_supervisor_response(response: str) -> tuple[str, str]:
    """
    Parse the structured supervisor response to extract action and reasoning.

    Expected format:
    DECISION: [chosen_action]

    REASONING:
    - Primary factors influencing this decision
    - Key metrics that support this choice
    - Strategic rationale for timing

    Parameters
    ----------
    response : str
        The raw response from the LLM

    Returns
    -------
    tuple[str, str]
        A tuple of (action, decision_reasoning)
    """
    # Extract action from DECISION line
    decision_match = re.search(r"DECISION:\s*(.+)", response, re.IGNORECASE)
    action = decision_match.group(1).strip() if decision_match else ""

    # Extract reasoning section
    reasoning_match = re.search(
        r"REASONING:\s*(.*)", response, re.IGNORECASE | re.DOTALL
    )
    decision_reasoning = reasoning_match.group(1).strip() if reasoning_match else ""

    return action, decision_reasoning


def _supervisor_decision_node(
    state: SupervisorDecisionState,
    llm: BaseChatModel,
) -> SupervisorDecisionState:
    """
    Supervisor decision node that analyzes system state and decides next action.
    """
    prompt = load_prompt(
        "supervisor_decision",
        goal=state["goal"],
        meta_review=state["meta_review"],
        previous_meta_review=state["previous_meta_review"],
        total_actions=state["total_actions"],
        latest_actions=state["latest_actions"],
        total_hypotheses=state["total_hypotheses"],
        num_unranked_hypotheses=state["num_unranked_hypotheses"],
        num_meta_reviews=state["num_meta_reviews"],
        new_hypotheses_since_meta_review=state["new_hypotheses_since_meta_review"],
        total_matches_played=state["total_matches_played"],
        total_rounds_played=state["total_rounds_played"],
        top_3_elo_ratings=state["top_3_elo_ratings"],
        max_elo_rating=state["max_elo_rating"],
        num_elo_ratings_over_1400=state["num_elo_ratings_over_1400"],
        median_elo_rating=state["median_elo_rating"],
        cosine_similarity_trajectory=state["cosine_similarity_trajectory"],
        cluster_count_trajectory=state["cluster_count_trajectory"],
        literature_review_subtopics_completed=state[
            "literature_review_subtopics_completed"
        ],
    )

    response_content = llm.invoke(prompt).content
    action, decision_reasoning = _parse_supervisor_response(response_content)
    return {**state, "action": action, "decision_reasoning": decision_reasoning}
