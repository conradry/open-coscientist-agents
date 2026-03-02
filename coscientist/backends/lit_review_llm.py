"""
LLM-only literature review agent (no external tools required).

Uses the LLM directly to generate subtopic reports based on its training knowledge.
No GPTResearcher, no web search, no paper-qa.

Useful for:
- Fast unit/integration tests
- Environments where GPTResearcher is not installed
- Swapping in alternative backends (paper-qa, Semantic Scholar, etc.)

To use an alternative backend, pass a custom ``research_fn`` to
``build_lit_review_llm``. The function signature must be::

    research_fn(subtopic: str, goal: str, llm: BaseChatModel) -> str
"""

import re
from typing import Callable, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt


class LiteratureReviewState(TypedDict):
    """State for the literature review agent."""

    goal: str
    max_subtopics: int
    subtopics: list[str]
    subtopic_reports: list[str]
    meta_review: str


def parse_topic_decomposition(markdown_text: str) -> list[str]:
    """Parse the topic decomposition markdown into subtopic strings."""
    sections = re.split(r"### Subtopic \d+", markdown_text)
    return [section.strip() for section in sections[1:]]


def _topic_decomposition_node(
    state: LiteratureReviewState,
    llm: BaseChatModel,
) -> LiteratureReviewState:
    """Decompose the research goal into focused subtopics."""
    prompt = load_prompt(
        "topic_decomposition",
        goal=state["goal"],
        max_subtopics=state["max_subtopics"],
        subtopics=state.get("subtopics", ""),
        meta_review=state.get("meta_review", ""),
    )
    response_content = llm.invoke(prompt).content
    subtopics = parse_topic_decomposition(response_content)

    if not subtopics:
        raise ValueError("Failed to parse any topics from decomposition response")

    if state.get("subtopics"):
        subtopics = state["subtopics"] + subtopics

    return {"subtopics": subtopics}


def _write_subtopic_report_llm(
    subtopic: str,
    goal: str,
    llm: BaseChatModel,
) -> str:
    """
    Write a subtopic report using the LLM directly.

    This is the default research_fn for ``build_lit_review_llm``.
    Replace it with a paper-qa or retrieval-based function when available.
    """
    prompt = load_prompt("llm_subtopic_report", goal=goal, subtopic=subtopic)
    return llm.invoke(prompt).content


def _llm_research_node(
    state: LiteratureReviewState,
    llm: BaseChatModel,
    research_fn: Callable[[str, str, BaseChatModel], str],
) -> LiteratureReviewState:
    """Generate subtopic reports using the provided research function."""
    reports = [
        research_fn(subtopic, state["goal"], llm)
        for subtopic in state["subtopics"]
    ]
    if state.get("subtopic_reports"):
        reports = state["subtopic_reports"] + reports
    return {"subtopic_reports": reports}


def build_lit_review_llm(
    llm: BaseChatModel,
    research_fn: Callable[[str, str, BaseChatModel], str] = _write_subtopic_report_llm,
) -> StateGraph:
    """
    Build a literature review agent that uses the LLM directly (no GPTResearcher).

    Parameters
    ----------
    llm : BaseChatModel
        LLM for topic decomposition and (by default) report generation.
    research_fn : callable, optional
        Function with signature ``(subtopic, goal, llm) -> str`` that generates
        a report for a single subtopic. Defaults to the built-in LLM writer.

        Swap this to use paper-qa, Semantic Scholar API, or any other backend::

            def my_paper_qa_fn(subtopic, goal, llm):
                # use paper-qa or other retrieval here
                return report_str

            agent = build_lit_review_llm(llm, research_fn=my_paper_qa_fn)

    Returns
    -------
    StateGraph
        Compiled LangGraph for the literature review agent.
    """
    graph = StateGraph(LiteratureReviewState)

    graph.add_node(
        "topic_decomposition",
        lambda state: _topic_decomposition_node(state, llm),
    )
    graph.add_node(
        "llm_research",
        lambda state: _llm_research_node(state, llm, research_fn),
    )

    graph.add_edge("topic_decomposition", "llm_research")
    graph.add_edge("llm_research", END)

    graph.set_entry_point("topic_decomposition")
    return graph.compile()
