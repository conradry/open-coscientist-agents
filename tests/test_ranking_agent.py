"""Tests for coscientist.agents.ranking_agent (EloTournament)."""

import pytest

from coscientist.agents.ranking_agent import (
    DEFAULT_ELO,
    EloTournament,
    calculate_expected_score,
    update_elo,
)
from coscientist.models.custom_types import RankingMatchResult, ReviewedHypothesis


# ---------------------------------------------------------------------------
# ELO math
# ---------------------------------------------------------------------------

class TestEloMath:
    def test_equal_ratings_give_0_5_expected(self):
        score, _ = calculate_expected_score(1200, 1200)
        assert abs(score - 0.5) < 1e-6

    def test_higher_rating_gives_higher_expected_score(self):
        score_strong, _ = calculate_expected_score(1400, 1200)
        score_weak, _ = calculate_expected_score(1200, 1400)
        assert score_strong > 0.5
        assert score_weak < 0.5
        assert abs(score_strong + score_weak - 1.0) < 1e-6

    def test_update_elo_winner_gains_points(self):
        r1, r2 = update_elo(1200, 1200, winner=1)
        assert r1 > 1200
        assert r2 < 1200

    def test_update_elo_ratings_sum_is_conserved(self):
        r1, r2 = update_elo(1200, 1200, winner=1)
        assert abs((r1 + r2) - (1200 + 1200)) < 1e-6


# ---------------------------------------------------------------------------
# EloTournament
# ---------------------------------------------------------------------------

def _make_reviewed_hypothesis(hypothesis_text: str) -> ReviewedHypothesis:
    return ReviewedHypothesis(
        hypothesis=hypothesis_text,
        predictions=["Prediction A"],
        assumptions=["Assumption A"],
        causal_reasoning="Causal chain A → B → C",
        assumption_research_results={"Assumption A": "Supported"},
        verification_result="Plausible",
    )


class TestEloTournament:
    def setup_method(self):
        self.tournament = EloTournament(goal="Test research goal")
        self.h1 = _make_reviewed_hypothesis("Hypothesis Alpha")
        self.h2 = _make_reviewed_hypothesis("Hypothesis Beta")
        self.h3 = _make_reviewed_hypothesis("Hypothesis Gamma")

    def test_add_hypothesis_sets_default_elo(self):
        self.tournament.add_hypothesis(self.h1)
        assert self.tournament.ratings[self.h1.uid] == DEFAULT_ELO

    def test_add_hypothesis_stores_hypothesis(self):
        self.tournament.add_hypothesis(self.h1)
        assert self.h1.uid in self.tournament.hypotheses

    def test_get_win_loss_records_empty_initially(self):
        self.tournament.add_hypothesis(self.h1)
        records = self.tournament.get_win_loss_records()
        assert records[self.h1.uid] == {"wins": 0, "losses": 0}

    def test_get_sorted_hypotheses_sorted_by_elo(self):
        self.tournament.add_hypothesis(self.h1)
        self.tournament.add_hypothesis(self.h2)
        self.tournament.ratings[self.h1.uid] = 1300
        self.tournament.ratings[self.h2.uid] = 1100
        sorted_hyps = self.tournament.get_sorted_hypotheses()
        assert sorted_hyps[0][0] == self.h1.uid

    def test_get_sorted_hypotheses_returns_all(self):
        for h in [self.h1, self.h2, self.h3]:
            self.tournament.add_hypothesis(h)
        sorted_hyps = self.tournament.get_sorted_hypotheses()
        assert len(sorted_hyps) == 3

    def test_summarize_trajectory_returns_string(self):
        self.tournament.add_hypothesis(self.h1)
        summary = self.tournament.summarize_tournament_trajectory()
        assert isinstance(summary, dict)
        assert "total_matches_played" in summary
        assert "top_3_elo_ratings" in summary
