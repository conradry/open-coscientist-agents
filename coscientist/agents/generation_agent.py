"""
Generation agent
---------------
- Literature exploration
- Simulated scientific debates
"""

from dataclasses import dataclass
from typing import TypedDict, Union

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils import multiturn
from coscientist.utils.common import load_prompt, parse_hypothesis_markdown
from coscientist.models.custom_types import ParsedHypothesis
from coscientist.models.reasoning_types import ReasoningType


class IndependentState(TypedDict):
    goal: str
    literature_review: str
    meta_review: str
    hypothesis: ParsedHypothesis
    _raw_result: str  # Private temporary field for markdown output


class CollaborativeState(IndependentState, multiturn.MultiTurnState):
    pass


@dataclass
class IndependentConfig:
    """Configuration for independent generation mode."""

    field: str
    reasoning_type: ReasoningType
    llm: BaseChatModel


@dataclass
class CollaborativeConfig:
    """Configuration for collaborative generation mode."""

    agent_names: list[str]
    agent_fields: dict[str, str]
    agent_reasoning_types: dict[str, ReasoningType]
    llms: dict[str, BaseChatModel]
    max_turns: int = 10


def build_generation_agent(
    mode: str,
    config: Union[IndependentConfig, CollaborativeConfig],
) -> StateGraph:
    """
    Unified builder function for generation agents that supports both independent and collaborative modes.

    Parameters
    ----------
    mode : str
        The mode of operation, either "independent" or "collaborative".
    config : Union[IndependentConfig, CollaborativeConfig]
        Configuration object containing all necessary parameters for the selected mode.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the generation agent.

    Raises
    ------
    ValueError
        If mode is invalid or required parameters are missing for the selected mode.
    """
    if mode == "independent":
        if not isinstance(config, IndependentConfig):
            raise ValueError("config must be an IndependentConfig instance")
        return _build_independent_generation_agent(
            config.field, config.reasoning_type, config.llm
        )
    elif mode == "collaborative":
        if not isinstance(config, CollaborativeConfig):
            raise ValueError("config must be a CollaborativeConfig instance")
        # Use the simplified multi-turn system
        return _build_collaborative_generation_agent(
            config.agent_names,
            config.agent_fields,
            config.agent_reasoning_types,
            config.llms,
            config.max_turns,
        )
    else:
        raise ValueError("mode must be either 'independent' or 'collaborative'")


def _independent_generation_node(
    state: IndependentState,
    field: str,
    reasoning_type: ReasoningType,
    llm: BaseChatModel,
) -> IndependentState:
    """
    Represents the action of a single generation agent using the independent_generation.md template.
    The output is expected to be markdown with sections: Evidence, Hypothesis, Reasoning, Assumptions Table.
    """
    # Handle meta_review field with fallback
    meta_review = state.get("meta_review", "Not Available")

    prompt = load_prompt(
        "independent_generation",
        goal=state["goal"],
        field=field,
        literature_review=state["literature_review"],
        meta_review=meta_review,
        reasoning_type=reasoning_type.value,
    )
    response_content = llm.invoke(prompt).content
    return {**state, "_raw_result": response_content}


def _parsing_node(state: IndependentState) -> IndependentState:
    """
    Parse the raw markdown result into a structured ParsedHypothesis object.
    """
    parsed_hypothesis = parse_hypothesis_markdown(state["_raw_result"])
    return {**state, "hypothesis": parsed_hypothesis}


def _build_independent_generation_agent(
    field: str, reasoning_type: ReasoningType, llm: BaseChatModel
):
    """
    Builds and configures a LangGraph for a single-agent generation process using the independent_generation.md template.
    The agent's output is parsed into a structured ParsedHypothesis object.

    Parameters
    ----------
    field : str
        Field or domain of expertise.
    reasoning_type : ReasoningType
        Reasoning type for the agent.
    llm : BaseChatModel
        The language model to use.

    Returns
    -------
    StateGraph
        A compiled LangGraph for the generation agent.
    """
    graph = StateGraph(IndependentState)
    graph.add_node(
        "generator",
        lambda state: _independent_generation_node(state, field, reasoning_type, llm),
    )
    graph.add_node("parser", _parsing_node)

    graph.add_edge("generator", "parser")
    graph.add_edge("parser", END)

    graph.set_entry_point("generator")
    return graph.compile()


def _collaborative_parsing_node(state: CollaborativeState) -> CollaborativeState:
    """
    Parse the final result from collaborative generation into a structured ParsedHypothesis object.

    The final report is always written by the last agent in the transcript (the one
    whose message triggered termination). Parsing only the last message avoids false
    splits caused by earlier agents casually referring to '#FINAL REPORT#' in questions.
    """
    _, last_message = state["transcript"][-1]
    parsed_hypothesis = parse_hypothesis_markdown(last_message)
    return {**state, "hypothesis": parsed_hypothesis}


def _build_collaborative_generation_agent(
    agent_names: list[str],
    agent_fields: dict[str, str],
    agent_reasoning_types: dict[str, ReasoningType],
    llms: dict[str, BaseChatModel],
    max_turns: int = 10,
) -> StateGraph:
    """Build collaborative generation agent with structured output parsing."""

    # Create agent node functions
    agent_node_fns = {}
    for agent_name in agent_names:
        agent_node_fns[agent_name] = multiturn.create_agent_node_fn(
            agent_name=agent_name,
            llm=llms[agent_name],
            prompt_name="collaborative_generation",
            prompt_keys_from_state=["goal", "literature_review", "meta_review"],
            # kwargs for the prompt
            field=agent_fields[agent_name],
            reasoning_type=agent_reasoning_types[agent_name].value,
        )

    # Create moderator and post-processor
    moderator_fn = multiturn.create_moderator_node_fn(
        agent_names, _termination_fn, max_turns
    )

    # Build the base multi-turn agent graph (without compiling it yet)
    base_graph = StateGraph(CollaborativeState)

    # Add agent nodes
    for agent_name, agent_fn in agent_node_fns.items():
        base_graph.add_node(agent_name, agent_fn)

    # Add moderator node
    base_graph.add_node("moderator", moderator_fn)

    # Add our custom parsing node
    base_graph.add_node("parser", _collaborative_parsing_node)

    # Define edges: agents -> moderator
    for agent_name in agent_node_fns.keys():
        base_graph.add_edge(agent_name, "moderator")

    # Conditional edges from moderator
    def route_after_moderator(state: CollaborativeState):
        if state["finished"]:
            return "parser"
        return state["next_agent"]

    routing_map = {name: name for name in agent_node_fns.keys()}
    routing_map["parser"] = "parser"

    base_graph.add_conditional_edges("moderator", route_after_moderator, routing_map)

    # Parser goes to END
    base_graph.add_edge("parser", END)

    # Set entry point
    base_graph.set_entry_point(list(agent_node_fns.keys())[0])

    return base_graph.compile()


def _termination_fn(msg: str) -> bool:
    """
    Check if the message contains all required sections to prevent parser assertions.
    Returns True if the message has hypothesis, predictions, and assumptions sections.
    """
    # Check if the message contains all required sections
    if "#FINAL REPORT#" in msg:
        text = msg.split("#FINAL REPORT#")[1]
    else:
        return False

    # Split the text by # to get sections
    sections = text.split("#")

    # Check for required sections
    has_hypothesis = False
    has_predictions = False
    has_assumptions = False

    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Split section into title and content
        lines = section.split("\n", 1)
        if len(lines) < 2:
            continue

        title = lines[0].strip().lower()
        content = lines[1].strip()

        # Check if content is not empty
        if not content:
            continue

        # Match section titles (case-insensitive)
        if "hypothesis" in title:
            has_hypothesis = True
        elif "prediction" in title:
            has_predictions = True
        elif "assumption" in title:
            has_assumptions = True

    return has_hypothesis and has_predictions and has_assumptions
