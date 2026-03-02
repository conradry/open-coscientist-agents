"""Tests for coscientist.utils (common and multiturn)."""

import pytest
from unittest.mock import MagicMock

from coscientist.utils.common import parse_hypothesis_markdown, _parse_numbered_list
from coscientist.utils.multiturn import (
    MultiTurnState,
    create_agent_node_fn,
    create_moderator_node_fn,
    build_multi_turn_agent,
)


# ---------------------------------------------------------------------------
# parse_hypothesis_markdown
# ---------------------------------------------------------------------------

VALID_MARKDOWN = """
# Hypothesis
Mitochondrial dysfunction drives neurodegeneration.

# Predictions
1. Neurons with impaired mitochondria show elevated ROS.
2. Antioxidant treatment slows neurodegeneration.

# Assumptions
1. Mitochondria are the primary ROS source.
2. Oxidative stress is upstream of cell death.
"""

FINAL_REPORT_MARKDOWN = """Some preamble text.
#FINAL REPORT#
# Hypothesis
Autophagy clears toxic aggregates.

# Predictions
1. Autophagy activation reduces aggregates.

# Assumptions
1. Aggregates are toxic to neurons.
"""


class TestParseHypothesisMarkdown:
    def test_parses_all_sections(self):
        result = parse_hypothesis_markdown(VALID_MARKDOWN)
        assert "Mitochondrial dysfunction" in result.hypothesis
        assert len(result.predictions) == 2
        assert len(result.assumptions) == 2

    def test_strips_final_report_preamble(self):
        result = parse_hypothesis_markdown(FINAL_REPORT_MARKDOWN)
        assert "Autophagy" in result.hypothesis

    def test_missing_hypothesis_raises(self):
        bad_md = "# Predictions\n1. P1\n\n# Assumptions\n1. A1"
        with pytest.raises(AssertionError, match="Hypothesis section is required"):
            parse_hypothesis_markdown(bad_md)

    def test_missing_predictions_raises(self):
        bad_md = "# Hypothesis\nH1\n\n# Assumptions\n1. A1"
        with pytest.raises(AssertionError, match="Predictions section is required"):
            parse_hypothesis_markdown(bad_md)

    def test_missing_assumptions_raises(self):
        bad_md = "# Hypothesis\nH1\n\n# Predictions\n1. P1"
        with pytest.raises(AssertionError, match="Assumptions section is required"):
            parse_hypothesis_markdown(bad_md)


# ---------------------------------------------------------------------------
# _parse_numbered_list
# ---------------------------------------------------------------------------

class TestParseNumberedList:
    def test_parses_dot_format(self):
        items = _parse_numbered_list("1. First\n2. Second\n3. Third")
        assert items == ["First", "Second", "Third"]

    def test_parses_paren_format(self):
        items = _parse_numbered_list("1) First\n2) Second")
        assert items == ["First", "Second"]

    def test_parses_dash_format(self):
        items = _parse_numbered_list("1- First\n2- Second")
        assert items == ["First", "Second"]

    def test_empty_string_returns_empty_list(self):
        assert _parse_numbered_list("") == []

    def test_multiline_item_is_concatenated(self):
        text = "1. First line\ncontinuation\n2. Second"
        items = _parse_numbered_list(text)
        assert "First line" in items[0]
        assert "continuation" in items[0]


# ---------------------------------------------------------------------------
# MultiTurn framework
# ---------------------------------------------------------------------------

class TestCreateModeratorNodeFn:
    def _make_state(self, turn=0, next_agent="agent_a", transcript=None, finished=False):
        return MultiTurnState(
            transcript=transcript or [],
            turn=turn,
            next_agent=next_agent,
            finished=finished,
        )

    def test_terminates_at_max_turns(self):
        moderator = create_moderator_node_fn(["agent_a", "agent_b"], lambda x: False, max_turns=3)
        state = self._make_state(turn=3, next_agent="agent_a")
        result = moderator(state)
        assert result["finished"] is True

    def test_terminates_when_termination_fn_returns_true(self):
        moderator = create_moderator_node_fn(
            ["agent_a", "agent_b"],
            lambda msg: "STOP" in msg,
            max_turns=10,
        )
        state = self._make_state(
            turn=1,
            next_agent="agent_a",
            transcript=[("agent_a", "Final message STOP here")],
        )
        result = moderator(state)
        assert result["finished"] is True

    def test_round_robin_scheduling(self):
        moderator = create_moderator_node_fn(["agent_a", "agent_b"], lambda x: False, max_turns=10)
        state = self._make_state(turn=0, next_agent="agent_a")
        result = moderator(state)
        assert result["next_agent"] == "agent_b"
        assert result["turn"] == 1

    def test_wraps_around_to_first_agent(self):
        moderator = create_moderator_node_fn(["agent_a", "agent_b"], lambda x: False, max_turns=10)
        state = self._make_state(turn=1, next_agent="agent_b")
        result = moderator(state)
        assert result["next_agent"] == "agent_a"
