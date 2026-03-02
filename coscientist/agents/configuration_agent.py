"""
Configuration
-------------
- Takes a user prompt and create a configuration for the research plan to be
executed by the Supervisor through an interactive conversation.
"""

import uuid
from typing import Sequence, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
)
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import Annotated

from coscientist.utils.common import load_prompt


class ConfigurationState(TypedDict):
    """
    Represents the state of the interactive configuration process.

    Uses LangGraph's standard message-based state management for better
    conversation handling and persistence.

    Parameters
    ----------
    messages: Annotated[Sequence[BaseMessage], add_messages]
        The conversation messages between agent and user
    goal: str
        The initial research goal to refine
    refined_goal: str
        The final refined goal (set when process is complete)
    is_complete: bool
        Whether the configuration process is complete
    """

    messages: Annotated[Sequence[BaseMessage], add_messages]
    goal: str
    refined_goal: str
    is_complete: bool


def build_configuration_agent(llm: BaseChatModel) -> StateGraph:
    """
    Builds and configures a LangGraph for the interactive configuration agent process.

    The graph uses LangGraph's built-in message persistence and follows best practices
    for chatbot development including:
    - Proper message state management
    - Built-in checkpointer for conversation persistence
    - Message trimming for context management
    - Streaming support

    Parameters
    ----------
    llm: BaseChatModel
        The language model to use for the agent responses

    Returns
    -------
    StateGraph
        A compiled LangGraph for the interactive configuration agent
    """
    # Create the workflow
    workflow = StateGraph(state_schema=ConfigurationState)

    # Add the configuration node
    workflow.add_node("configuration", lambda state: _configuration_node(state, llm))

    # Set up the flow
    workflow.add_edge(START, "configuration")

    # Add memory for conversation persistence
    memory = InMemorySaver()

    return workflow.compile(checkpointer=memory)


def _configuration_node(
    state: ConfigurationState, llm: BaseChatModel
) -> ConfigurationState:
    """
    Node that processes the conversation and generates the agent's response.
    """
    prompt = load_prompt("research_config", goal=state["goal"])

    # Ensure we have messages to work with
    messages = state.get("messages", [])
    if not messages:
        # If no messages, create a default user message to start the conversation
        messages = [HumanMessage(content="Please help me refine my research goal.")]

    prompt_template = ChatPromptTemplate.from_messages(
        [("system", prompt), MessagesPlaceholder(variable_name="messages")]
    )

    # Prepare the input for the prompt template
    template_input = {"messages": messages}
    formatted_prompt = prompt_template.invoke(template_input)

    response = llm.invoke(formatted_prompt)

    # Check if this is a final goal statement
    is_complete = "FINAL GOAL:" in response.content
    refined_goal = state.get("refined_goal", "")

    if is_complete:
        # Extract the final goal
        try:
            refined_goal = response.content.split("FINAL GOAL:")[1].strip()
        except IndexError:
            # Fallback if parsing fails
            refined_goal = response.content

    return {
        "messages": [response],
        "goal": state["goal"],
        "refined_goal": refined_goal,
        "is_complete": is_complete,
    }


class ConfigurationChatManager:
    """
    Manages the interactive chat process for configuration refinement.

    This class handles the conversation flow between the user and the configuration
    agent, maintaining state and managing the workflow execution until completion.

    Parameters
    ----------
    llm : BaseChatModel
        The language model to use for agent responses
    research_goal : str
        The initial research goal to be refined through conversation
    """

    def __init__(self, llm: BaseChatModel, research_goal: str):
        """
        Initialize the chat manager with an LLM and research goal.

        Parameters
        ----------
        llm : BaseChatModel
            The language model for the configuration agent
        research_goal : str
            The initial research goal to refine
        """
        self.llm = llm
        self.research_goal = research_goal
        self.agent = build_configuration_agent(llm)
        self.config = {"configurable": {"thread_id": str(uuid.uuid4())}}
        self.current_state = None
        self.is_complete = False
        self.refined_goal = ""

        # Initialize the conversation
        self._initialize_conversation()

    def _initialize_conversation(self):
        """Initialize the conversation with the research goal."""
        # Start with an initial user message to trigger the agent's response
        initial_message = HumanMessage(
            content="Please help me refine my research goal and ask clarifying questions if needed."
        )
        initial_state = ConfigurationState(
            messages=[initial_message],
            goal=self.research_goal,
            refined_goal="",
            is_complete=False,
        )
        self.current_state = self.agent.invoke(initial_state, self.config)
        self.is_complete = self.current_state.get("is_complete", False)
        self.refined_goal = self.current_state.get("refined_goal", "")

    def send_human_message(self, message: str) -> str:
        """
        Send a human message to the agent and get the response.

        Parameters
        ----------
        message : str
            The human message to send to the agent

        Returns
        -------
        str
            The agent's response message

        Raises
        ------
        RuntimeError
            If the conversation is already complete
        """
        if self.is_complete:
            raise RuntimeError(
                "Conversation is already complete. The refined goal is available."
            )

        # Send human message to the agent
        input_messages = [HumanMessage(message)]
        output = self.agent.invoke({"messages": input_messages}, self.config)

        # Update state
        self.current_state = output
        self.is_complete = output.get("is_complete", False)
        self.refined_goal = output.get("refined_goal", "")

        # Get the latest AI message
        messages = output.get("messages", [])
        if messages:
            latest_message = messages[-1]
            if hasattr(latest_message, "content"):
                return latest_message.content

        return "No response received from agent."

    def get_latest_agent_message(self) -> str:
        """
        Get the latest message from the agent.

        Returns
        -------
        str
            The latest agent message content
        """
        if not self.current_state:
            return "No messages yet."

        messages = self.current_state.get("messages", [])
        if messages:
            latest_message = messages[-1]
            if hasattr(latest_message, "content"):
                return latest_message.content

        return "No agent messages found."

    def is_conversation_complete(self) -> bool:
        """
        Check if the configuration conversation is complete.

        Returns
        -------
        bool
            True if the conversation is complete, False otherwise
        """
        return self.is_complete

    def get_refined_goal(self) -> str:
        """
        Get the refined research goal.

        Returns
        -------
        str
            The refined goal if conversation is complete, empty string otherwise
        """
        return self.refined_goal if self.is_complete else ""

    def get_conversation_history(self) -> Sequence[BaseMessage]:
        """
        Get the full conversation history.

        Returns
        -------
        Sequence[BaseMessage]
            All messages in the conversation
        """
        if not self.current_state:
            return []

        return self.current_state.get("messages", [])
