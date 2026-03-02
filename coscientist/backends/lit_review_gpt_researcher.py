"""
Literature review agent backed by GPTResearcher (web search).

Uses LangGraph to:
1. Decompose research goals into modular subtopics
2. Dispatch each subtopic to GPTResearcher workers in parallel
3. Synthesize subtopic reports into an executive summary

Requires gpt-researcher and a RETRIEVER API key (e.g. Tavily).
Config is read from ``coscientist/config/gpt_researcher_config.json``.
"""

import asyncio
import os
import re
from typing import TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "gpt_researcher_config.json")


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

    if state.get("subtopics", False):
        subtopics = state["subtopics"] + subtopics

    return {"subtopics": subtopics}


async def _write_subtopic_report(subtopic: str, main_goal: str) -> str:
    """Conduct research for a single subtopic using GPTResearcher."""
    from gpt_researcher import GPTResearcher
    from gpt_researcher.utils.enum import Tone

    researcher = GPTResearcher(
        query=subtopic,
        report_type="subtopic_report",
        report_format="markdown",
        parent_query=main_goal,
        verbose=False,
        tone=Tone.Objective,
        config_path=_CONFIG_PATH,
    )
    _ = await researcher.conduct_research()
    return await researcher.write_report()


async def _parallel_research_node(
    state: LiteratureReviewState,
) -> LiteratureReviewState:
    """Conduct parallel research for all subtopics using GPTResearcher."""
    subtopics = state["subtopics"]
    main_goal = state["goal"]

    research_tasks = [_write_subtopic_report(topic, main_goal) for topic in subtopics]

    try:
        subtopic_reports = await asyncio.gather(*research_tasks)
    except Exception as e:
        raise RuntimeError(f"Failed to conduct research for subtopics: {str(e)}")

    if state.get("subtopic_reports", False):
        subtopic_reports = state["subtopic_reports"] + subtopic_reports

    return {"subtopic_reports": subtopic_reports}


def build_lit_review_gpt_researcher(llm: BaseChatModel) -> StateGraph:
    """
    Build a literature review agent backed by GPTResearcher (web search).

    Parameters
    ----------
    llm : BaseChatModel
        LLM for topic decomposition.

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
        "parallel_research",
        _parallel_research_node,
    )

    graph.add_edge("topic_decomposition", "parallel_research")
    graph.add_edge("parallel_research", END)

    graph.set_entry_point("topic_decomposition")
    return graph.compile()
