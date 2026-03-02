import multiprocessing
import time

import streamlit as st
from langchain_litellm import ChatLiteLLM

# Import the background process functions
from background import (
    check_coscientist_status,
    cleanup_coscientist_run,
    coscientist_process_target,
    get_coscientist_results,
)

# Import the configuration agent and required models
from coscientist.agents.configuration_agent import ConfigurationChatManager

# Import coscientist framework components
from coscientist.global_state import CoscientistState


def get_llm_options():
    """Get available LLM options for the chat interface."""
    return {
        "o3": ChatLiteLLM(model="aisci/o3", max_tokens=5000),
        "Gemini 2.5 Pro": ChatLiteLLM(model="aisci/gemini-2.5-pro", max_tokens=5000),
        "Claude Sonnet 4": ChatLiteLLM(model="aisci/claude-sonnet-4-5-20250929", max_tokens=5000),
    }


def display_configuration_page():
    """Display the configuration agent chat page."""
    st.markdown("### 🤖 Configuration Agent Chat")
    st.markdown(
        "Refine your research goal through an interactive conversation with the configuration agent."
    )

    # Initialize session state for chat
    if "chat_manager" not in st.session_state:
        st.session_state.chat_manager = None
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []
    if "conversation_started" not in st.session_state:
        st.session_state.conversation_started = False
    if "refined_goal" not in st.session_state:
        st.session_state.refined_goal = ""
    if "coscientist_running" not in st.session_state:
        st.session_state.coscientist_running = False
    if "coscientist_result" not in st.session_state:
        st.session_state.coscientist_result = None
    if "coscientist_process" not in st.session_state:
        st.session_state.coscientist_process = None
    if "coscientist_error" not in st.session_state:
        st.session_state.coscientist_error = None

    # Configuration section
    st.subheader("🔧 Configuration")

    col1, col2 = st.columns([2, 1])

    with col1:
        # Research goal input
        initial_goal = st.text_area(
            "Enter your initial research goal:",
            height=100,
            placeholder="e.g., Investigate the relationship between protein misfolding and neurodegeneration...",
            help="Provide a research question or goal that you'd like to refine through conversation.",
        )

    with col2:
        # Model selection
        llm_options = get_llm_options()
        selected_model = st.selectbox(
            "Select Language Model:",
            options=list(llm_options.keys()),
            index=1,  # Default to GPT-4o-mini
            help="Choose the language model for the configuration agent.",
        )

        # Start/Reset buttons
        if st.button("🚀 Start New Conversation", type="primary"):
            if initial_goal.strip():
                try:
                    with st.spinner("Initializing conversation..."):
                        llm = llm_options[selected_model]
                        st.session_state.chat_manager = ConfigurationChatManager(
                            llm, initial_goal.strip()
                        )
                        st.session_state.conversation_started = True
                        st.session_state.chat_history = []
                        st.session_state.refined_goal = ""

                        # Get the initial agent message
                        initial_message = (
                            st.session_state.chat_manager.get_latest_agent_message()
                        )
                        st.session_state.chat_history.append(("Agent", initial_message))

                    st.success("Conversation started! 🎉")
                    st.rerun()
                except Exception as e:
                    st.error(f"Error starting conversation: {str(e)}")
            else:
                st.warning("Please enter a research goal first.")

        if st.session_state.conversation_started:
            if st.button("🔄 Reset Conversation"):
                if (
                    st.session_state.coscientist_process
                    and st.session_state.coscientist_process.is_alive()
                ):
                    st.session_state.coscientist_process.terminate()

                # Clear the goal directory if a goal was set
                if st.session_state.refined_goal:
                    try:
                        CoscientistState.clear_goal_directory(
                            st.session_state.refined_goal
                        )
                        st.info(
                            f"Cleared data for goal: {st.session_state.refined_goal}"
                        )
                    except Exception as e:
                        st.warning(f"Could not clear goal directory: {e}")

                st.session_state.chat_manager = None
                st.session_state.conversation_started = False
                st.session_state.chat_history = []
                st.session_state.refined_goal = ""
                st.session_state.coscientist_running = False
                st.session_state.coscientist_result = None
                st.session_state.coscientist_process = None
                st.session_state.coscientist_error = None
                st.rerun()

    # Chat interface
    if st.session_state.conversation_started and st.session_state.chat_manager:
        st.markdown("---")
        st.subheader("💬 Conversation")

        # Display chat history
        chat_container = st.container()
        with chat_container:
            for sender, message in st.session_state.chat_history:
                if sender == "Agent":
                    with st.chat_message("assistant", avatar="🤖"):
                        st.markdown(message)
                else:
                    with st.chat_message("user", avatar="👤"):
                        st.markdown(message)

        # Check if conversation is complete
        if st.session_state.chat_manager.is_conversation_complete():
            st.success("🎉 Configuration complete!")
            refined_goal = st.session_state.chat_manager.get_refined_goal()
            st.session_state.refined_goal = refined_goal

            st.markdown("### 🎯 Final Refined Goal")
            st.markdown(f"**{refined_goal}**")

            # Buttons row
            col1, col2 = st.columns(2)

            with col1:
                # Option to copy the refined goal
                if st.button("📋 Copy Refined Goal"):
                    st.code(refined_goal, language="text")
                    st.info(
                        "Refined goal displayed above - you can select and copy it."
                    )

            with col2:
                # Launch coscientist button
                if not st.session_state.coscientist_running:
                    if st.button("🚀 Launch Coscientist", type="primary"):
                        try:
                            # Ensure the directory is clean before starting
                            CoscientistState.clear_goal_directory(refined_goal)

                            process = multiprocessing.Process(
                                target=coscientist_process_target, args=(refined_goal,)
                            )
                            process.start()
                            st.session_state.coscientist_process = process
                            st.session_state.coscientist_running = True
                            st.session_state.refined_goal = refined_goal
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to launch Coscientist: {e}")

                else:
                    st.button("🚀 Coscientist Running...", disabled=True)

            # Handle coscientist execution
            if st.session_state.coscientist_running:
                with st.spinner("🔬 Coscientist is running in the background..."):
                    # Give it a moment before the first check
                    time.sleep(5)
                    st.rerun()  # Rerun to check status

            # Check status if it was running
            if (
                st.session_state.refined_goal
                and not st.session_state.coscientist_result
            ):
                status = check_coscientist_status(st.session_state.refined_goal)

                if status == "done":
                    st.session_state.coscientist_running = False
                    try:
                        with st.spinner("Fetching results..."):
                            final_report, meta_review = get_coscientist_results(
                                st.session_state.refined_goal
                            )
                            st.session_state.coscientist_result = {
                                "final_report": final_report,
                                "meta_review": meta_review,
                            }
                            cleanup_coscientist_run(st.session_state.refined_goal)
                        st.success("🎉 Coscientist completed successfully!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error fetching results: {e}")
                        st.session_state.coscientist_error = str(e)

                elif status.startswith("error:"):
                    st.session_state.coscientist_running = False
                    error_message = status.replace("error: ", "")
                    st.session_state.coscientist_error = error_message
                    cleanup_coscientist_run(st.session_state.refined_goal)
                    st.error(f"Coscientist run failed: {error_message}")
                    st.rerun()

                elif status == "running" and st.session_state.coscientist_running:
                    st.info(
                        "Coscientist is running. Feel free to navigate away or check back later."
                    )
                    if st.button("Refresh Status"):
                        st.rerun()

            # Display error if it occurred
            if st.session_state.coscientist_error:
                st.error(f"Coscientist failed: {st.session_state.coscientist_error}")

            # Display results if available
            if st.session_state.coscientist_result is not None:
                st.markdown("### 📊 Coscientist Results")
                st.json(st.session_state.coscientist_result)

                # Reset button to run again
                if st.button("🔄 Run Coscientist Again"):
                    st.session_state.coscientist_result = None
                    st.session_state.coscientist_running = False
                    st.session_state.coscientist_process = None
                    st.session_state.coscientist_error = None
                    st.rerun()

        else:
            # Chat input
            user_input = st.chat_input("Type your message here...")

            if user_input:
                try:
                    with st.spinner("Agent is thinking..."):
                        # Add user message to history
                        st.session_state.chat_history.append(("User", user_input))

                        # Get agent response
                        agent_response = (
                            st.session_state.chat_manager.send_human_message(user_input)
                        )

                        # Add agent response to history
                        st.session_state.chat_history.append(("Agent", agent_response))

                    st.rerun()
                except Exception as e:
                    st.error(f"Error sending message: {str(e)}")

    # Instructions when no conversation is active
    if not st.session_state.conversation_started:
        st.markdown("---")
        st.info(
            "👆 Enter your research goal above and click 'Start New Conversation' to begin."
        )

        st.markdown("""
        ## How to Use the Configuration Agent
        
        1. **Enter your research goal** in the text area above
        2. **Select a language model** that will power the configuration agent
        3. **Click "Start New Conversation"** to begin the interactive refinement process
        4. **Chat with the agent** to refine and improve your research goal
        5. **Receive your refined goal** when the conversation is complete
        6. **Launch Coscientist** with your refined goal to begin the research process
        
        ### What the Configuration Agent Does
        
        The configuration agent helps you:
        - **Clarify vague research questions** by asking targeted questions
        - **Identify key variables and parameters** relevant to your research
        - **Suggest specific methodological approaches** that might be appropriate
        - **Refine the scope** of your research to make it more focused and actionable
        - **Ensure your goal is well-defined** for the subsequent research agents
        
        ### Tips for Better Results
        
        - **Be specific** about your domain of interest (e.g., biology, chemistry, physics)
        - **Mention any constraints** or limitations you're aware of
        - **Indicate your level of expertise** if relevant
        - **Ask questions** if you need clarification on the agent's suggestions
        - **Iterate** - don't hesitate to refine multiple times until you're satisfied
        """)
