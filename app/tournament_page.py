import pandas as pd
import streamlit as st

from coscientist.models.custom_types import ReviewedHypothesis


def format_hypothesis_summary(hypothesis: ReviewedHypothesis, elo_rating: float) -> str:
    """Format a brief summary of the hypothesis for the list view."""
    # Truncate hypothesis to first sentence or 150 characters
    hypothesis_text = hypothesis.hypothesis
    if len(hypothesis_text) > 150:
        hypothesis_text = hypothesis_text[:150] + "..."
    elif "." in hypothesis_text:
        first_sentence = hypothesis_text.split(".")[0] + "."
        if len(first_sentence) < len(hypothesis_text):
            hypothesis_text = first_sentence

    return f"**ELO: {elo_rating:.1f}** | {hypothesis_text}"


def display_hypothesis_details(
    hypothesis: ReviewedHypothesis,
    elo_rating: float,
    win_loss_record: dict,
    available_uids: list[str],
):
    """Display detailed information about a hypothesis."""

    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown(f"### Hypothesis {hypothesis.uid}")
        st.markdown(f"**Full Hypothesis:** {hypothesis.hypothesis}")

        if hypothesis.parent_uid:
            # Check if parent hypothesis exists in available hypotheses
            if hypothesis.parent_uid in available_uids:
                if st.button(
                    f"🔗 **Evolved from:** {hypothesis.parent_uid}",
                    key=f"parent_link_{hypothesis.uid}",
                ):
                    st.session_state.selected_hypothesis = hypothesis.parent_uid
                    st.rerun()
            else:
                st.info(f"🔗 **Evolved from:** {hypothesis.parent_uid} (not available)")

    with col2:
        st.metric("ELO Rating", f"{elo_rating:.1f}")
        col2_1, col2_2 = st.columns(2)
        with col2_1:
            st.metric("Wins", win_loss_record.get("wins", 0))
        with col2_2:
            st.metric("Losses", win_loss_record.get("losses", 0))

    # Detailed sections in tabs
    tab1, tab2, tab3, tab4 = st.tabs(
        ["🔬 Predictions", "🧠 Reasoning", "📚 Verification", "🏛️ Assumptions"]
    )

    with tab1:
        st.markdown("**Testable Predictions:**")
        for i, prediction in enumerate(hypothesis.predictions, 1):
            st.markdown(f"{i}. {prediction}")

    with tab2:
        st.markdown("**Causal Reasoning:**")
        st.markdown(hypothesis.causal_reasoning)

    with tab3:
        st.markdown("**Deep Verification Result:**")
        st.markdown(hypothesis.verification_result)

    with tab4:
        st.markdown("**Core Assumptions:**")
        for i, assumption in enumerate(hypothesis.assumptions, 1):
            st.markdown(f"{i}. {assumption}")

        if hypothesis.assumption_research_results:
            st.markdown("**Research on Assumptions:**")
            for assumption, research in hypothesis.assumption_research_results.items():
                with st.expander(f"Research: {assumption[:100]}..."):
                    st.markdown(research)


def display_match_history(tournament, hypothesis_uid: str):
    """Display match history for a specific hypothesis."""
    matches = []

    for match_key, match_result in tournament.match_history.items():
        if hypothesis_uid in [match_result.uid1, match_result.uid2]:
            opponent_uid = (
                match_result.uid2
                if match_result.uid1 == hypothesis_uid
                else match_result.uid1
            )
            won = (
                match_result.uid1 == hypothesis_uid and match_result.winner == 1
            ) or (match_result.uid2 == hypothesis_uid and match_result.winner == 2)

            stage = "Round Robin" if match_key[2] == 1 else "Bracket"

            matches.append(
                {
                    "Stage": stage,
                    "Opponent": opponent_uid,
                    "Result": "Win" if won else "Loss",
                    "Debate": match_result.debate,
                }
            )

    if matches:
        st.markdown("### 🥊 Match History")
        for i, match in enumerate(matches):
            result_emoji = "🏆" if match["Result"] == "Win" else "❌"
            with st.expander(
                f"{result_emoji} {match['Stage']} vs {match['Opponent']} - {match['Result']}"
            ):
                st.markdown("**Debate Transcript:**")
                st.markdown(match["Debate"])
    else:
        st.info("No matches found for this hypothesis.")


def display_tournament_page(state):
    """Display the tournament rankings page."""
    st.markdown(
        "Explore hypotheses ranked by ELO rating with detailed information and match history."
    )

    if state is None:
        return

    # Display basic info
    st.markdown(f"**Research Goal:** {state.goal}")

    if state.tournament is None:
        st.warning("No tournament data found in this state file.")
        return

    tournament = state.tournament
    sorted_hypotheses = tournament.get_sorted_hypotheses()
    win_loss_records = tournament.get_win_loss_records()

    if not sorted_hypotheses:
        st.warning("No hypotheses found in the tournament.")
        return

    st.markdown(
        f"**Total Hypotheses:** {len(sorted_hypotheses)} | **Total Matches:** {len(tournament.match_history)}"
    )

    # Tournament Rankings
    st.header("🏆 Tournament Rankings")

    # Create a summary table
    df_data = []
    for uid, elo_rating in sorted_hypotheses:
        hypothesis = tournament.hypotheses[uid]
        record = win_loss_records.get(uid, {"wins": 0, "losses": 0})
        df_data.append(
            {
                "Rank": len(df_data) + 1,
                "UID": uid,
                "ELO": f"{elo_rating:.1f}",
                "W-L": f"{record['wins']}-{record['losses']}",
                "Hypothesis": hypothesis.hypothesis[:100] + "..."
                if len(hypothesis.hypothesis) > 100
                else hypothesis.hypothesis,
            }
        )

    df = pd.DataFrame(df_data)
    st.dataframe(df, use_container_width=True, hide_index=True)

    # Detailed view
    st.header("📊 Detailed Hypothesis View")

    # Initialize session state for selected hypothesis if not exists
    available_uids = [uid for uid, _ in sorted_hypotheses]
    if "selected_hypothesis" not in st.session_state:
        st.session_state.selected_hypothesis = (
            available_uids[0] if available_uids else None
        )

    # Ensure the selected hypothesis is still valid (in case state file changed)
    if st.session_state.selected_hypothesis not in available_uids:
        st.session_state.selected_hypothesis = (
            available_uids[0] if available_uids else None
        )

    # Let user select which hypothesis to view in detail
    selected_uid = st.selectbox(
        "Select a hypothesis for detailed view:",
        options=available_uids,
        format_func=lambda uid: f"{uid} (ELO: {dict(sorted_hypotheses)[uid]:.1f})",
        index=available_uids.index(st.session_state.selected_hypothesis)
        if st.session_state.selected_hypothesis in available_uids
        else 0,
        key="hypothesis_selector",
    )

    # Update session state when selectbox changes
    if selected_uid != st.session_state.selected_hypothesis:
        st.session_state.selected_hypothesis = selected_uid

    if selected_uid:
        hypothesis = tournament.hypotheses[selected_uid]
        elo_rating = dict(sorted_hypotheses)[selected_uid]
        win_loss_record = win_loss_records.get(selected_uid, {"wins": 0, "losses": 0})

        # Display detailed information
        display_hypothesis_details(
            hypothesis, elo_rating, win_loss_record, available_uids
        )

        # Display match history
        display_match_history(tournament, selected_uid)
