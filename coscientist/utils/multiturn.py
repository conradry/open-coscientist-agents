from typing import Any, Callable, Optional, Type, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, StateGraph

from coscientist.utils.common import load_prompt


class MultiTurnState(TypedDict):
    """Generalized state for multi-turn agent conversations."""

    transcript: list[tuple[str, str]]
    turn: int
    next_agent: str
    finished: bool


def create_agent_node_fn(
    agent_name: str,
    llm: BaseChatModel,
    prompt_name: str,
    prompt_keys_from_state: list[str],
    **prompt_kwargs: dict[str, Any],
) -> Callable[[MultiTurnState], MultiTurnState]:
    """Create an agent node function."""
    assert (
        "transcript" not in prompt_kwargs
    ), "transcript will be added from state and should not be in prompt_kwargs"

    def agent_fn(state):
        # Build prompt args from state
        # Add transcript
        transcript_str = "\n".join(
            [f"{name}: {msg}" for name, msg in state["transcript"]]
        )
        prompt_kwargs["transcript"] = transcript_str

        # Add prompt keys from state
        for key in prompt_keys_from_state:
            prompt_kwargs[key] = state.get(key, "Not Available")

        # Generate response
        prompt = load_prompt(prompt_name, **prompt_kwargs)
        response = llm.invoke(prompt).content

        return {**state, "transcript": state["transcript"] + [(agent_name, response)]}

    return agent_fn


def create_moderator_node_fn(
    agent_names: list[str],
    termination_fn: Callable[[str], bool],
    max_turns: int = 10,
) -> Callable[[MultiTurnState], MultiTurnState]:
    """Create a moderator node function."""

    def moderator_fn(state: MultiTurnState) -> MultiTurnState:
        # Check termination conditions
        if state["turn"] >= max_turns:
            return {**state, "finished": True, "next_agent": ""}

        if state["transcript"] and termination_fn(state["transcript"][-1][1]):
            return {**state, "finished": True, "next_agent": ""}

        # Round-robin scheduling
        current_index = agent_names.index(state["next_agent"])
        next_index = (current_index + 1) % len(agent_names)

        return {
            **state,
            "finished": False,
            "next_agent": agent_names[next_index],
            "turn": state["turn"] + 1,
        }

    return moderator_fn


def build_multi_turn_agent(
    state_type: Type[MultiTurnState],
    agent_node_fns: dict[str, Callable[[MultiTurnState], MultiTurnState]],
    moderator_node_fn: Callable[[MultiTurnState], MultiTurnState],
    post_processor_node_fn: Optional[Callable[[MultiTurnState], MultiTurnState]] = None,
) -> StateGraph:
    """Build a multi-turn agent from pre-built node functions."""
    graph = StateGraph(state_type)

    # Add agent nodes
    for agent_name, agent_fn in agent_node_fns.items():
        graph.add_node(agent_name, agent_fn)

    # Add moderator node
    graph.add_node("moderator", moderator_node_fn)

    # Add post-processor if provided
    if post_processor_node_fn:
        graph.add_node("post_processor", post_processor_node_fn)
        graph.add_edge("post_processor", END)

    # Define edges: agents -> moderator
    for agent_name in agent_node_fns.keys():
        graph.add_edge(agent_name, "moderator")

    # Conditional edges from moderator
    def route_after_moderator(state: state_type):
        if state["finished"]:
            return "post_processor" if post_processor_node_fn else END
        return state["next_agent"]

    routing_map = {name: name for name in agent_node_fns.keys()}
    if post_processor_node_fn:
        routing_map["post_processor"] = "post_processor"
    else:
        routing_map[END] = END

    graph.add_conditional_edges("moderator", route_after_moderator, routing_map)
    graph.set_entry_point(list(agent_node_fns.keys())[0])

    return graph.compile()
