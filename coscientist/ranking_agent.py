"""
Ranking agent
-------------
- Runs tournaments and assigns ELO ratings to hypotheses

More details:
- Newly added hypotheses are added to the tournament with
an ELO rating of 1200.
- Top and bottom ranked hypotheses are evaluated differently.
Two top-ranked hypotheses are paired against each other and
there is a multi-turn scientific debate. Lower ranked hypotheses
are evaluated with a single turn debate. Final output is the number
of the winning hypothesis.
- Based on the Proximity agents graph, similar hypotheses are ranked
against each other. New and top-ranked hypotheses are prioritized.

TODO: Add a queue of hypotheses ordered by rank this will limit the number of hypotheses
that need to be evaluated by dropping the lowest ranked hypotheses that drop outside of the
queue.
"""

import itertools  # Add itertools for combinations
import statistics
from typing import Optional  # Add Optional

from langchain_core.language_models.chat_models import BaseChatModel

from coscientist import multiturn
from coscientist.common import load_prompt
from coscientist.custom_types import RankingMatchResult, ReviewedHypothesis

# Constants
DEFAULT_ELO = 1200
K_FACTOR = 32


class DebateState(multiturn.MultiTurnState):
    goal: str
    hypothesis_1: str
    hypothesis_2: str
    review_1: str
    review_2: str


def _build_debate_agent(
    agent_names: list[str],
    llms: dict[str, BaseChatModel],
    max_turns: int = 10,
) -> DebateState:
    """Build collaborative generation agent."""

    # Create agent node functions
    agent_node_fns = {}
    for agent_name in agent_names:
        agent_node_fns[agent_name] = multiturn.create_agent_node_fn(
            agent_name=agent_name,
            llm=llms[agent_name],
            prompt_name="simulated_debate",
            prompt_keys_from_state=[
                "goal",
                "hypothesis_1",
                "hypothesis_2",
                "review_1",
                "review_2",
            ],
        )

    # Create moderator and post-processor
    moderator_fn = multiturn.create_moderator_node_fn(
        agent_names, lambda msg: "WINNER:" in msg, max_turns
    )

    return multiturn.build_multi_turn_agent(DebateState, agent_node_fns, moderator_fn)


def calculate_expected_score(rating1: float, rating2: float) -> tuple[float, float]:
    """Calculates the expected scores for two players based on their ELO ratings."""
    expected1 = 1 / (1 + 10 ** ((rating2 - rating1) / 400))
    expected2 = 1 / (1 + 10 ** ((rating1 - rating2) / 400))
    return expected1, expected2


def update_elo(rating1: float, rating2: float, winner: int) -> tuple[float, float]:
    """
    Updates the ELO ratings of two players based on the match outcome.

    Parameters
    ----------
    rating1 : float
        ELO rating of hypothesis 1.
    rating2 : float
        ELO rating of hypothesis 2.
    winner : int
        1 if hypothesis 1 won, 2 if hypothesis 2 won.

    Returns
    -------
    tuple of float
        A tuple containing the updated ELO ratings (new_rating1, new_rating2).
    """
    expected1, expected2 = calculate_expected_score(rating1, rating2)

    if winner == 1:
        score1, score2 = 1, 0
    elif winner == 2:
        score1, score2 = 0, 1
    else:
        raise ValueError("Winner must be 1 or 2")  # Assuming no draws for now

    new_rating1 = rating1 + K_FACTOR * (score1 - expected1)
    new_rating2 = rating2 + K_FACTOR * (score2 - expected2)

    return new_rating1, new_rating2


class EloTournament:
    """Manages a two-stage ELO ranking tournament for hypotheses."""

    def __init__(self, goal: str):
        self.goal = goal
        self.hypotheses: dict[str, ReviewedHypothesis] = {}  # id -> Hypothesis object
        self.ratings: dict[str, float] = {}  # id -> ELO rating
        self.match_history: dict[tuple[int, int, int], RankingMatchResult] = {}

        self._past_tournament_ratings: list[list[float]] = []

    def add_hypothesis(
        self, hypothesis: ReviewedHypothesis, initial_rating: float = DEFAULT_ELO
    ):
        """Adds a new hypothesis to the tournament."""
        if hypothesis.uid not in self.hypotheses:
            self.hypotheses[hypothesis.uid] = hypothesis
            self.ratings[hypothesis.uid] = initial_rating
        else:
            raise ValueError(f"Hypothesis {hypothesis.uid} already exists.")

    def get_sorted_hypotheses(self) -> list[tuple[str, float]]:
        """Returns hypotheses sorted by ELO rating (descending)."""
        return sorted(self.ratings.items(), key=lambda item: item[1], reverse=True)

    def _determine_winner(
        self,
        hypo1: ReviewedHypothesis,
        hypo2: ReviewedHypothesis,
        prompt_name: str,
        llm: BaseChatModel,
    ) -> tuple[int, str]:
        """
        Uses the LLM with a specific prompt to determine the winner between two hypotheses.

        Parameters
        ----------
        hypo1 : ReviewedHypothesis
            The first hypothesis.
        hypo2 : ReviewedHypothesis
            The second hypothesis.
        prompt_name : str
            The name of the prompt template to use (e.g., 'tournament').

        Returns
        -------
        tuple[int, str]
            - 1 if hypo1 wins, 2 if hypo2 wins, None if winner cannot be determined.
            - The response text from the LLM.
        """
        # Prepare inputs based on the prompt template structure
        prompt_input = {
            "goal": self.goal,
            "hypothesis_1": hypo1.hypothesis,
            "hypothesis_2": hypo2.hypothesis,
            "review_1": hypo1.verification_result,
            "review_2": hypo2.verification_result,
        }

        # Load and format the prompt
        if prompt_name == "tournament":
            formatted_prompt = load_prompt(prompt_name, **prompt_input)
            response_text = llm.invoke(formatted_prompt).content
        elif prompt_name == "simulated_debate":
            agent = _build_debate_agent(
                agent_names=["scientist"], llms={"scientist": llm}, max_turns=10
            )
            initial_state = DebateState(
                transcript=[],
                turn=0,
                next_agent="scientist",
                finished=False,
                **prompt_input,
            )
            final_state = agent.invoke(initial_state)
            response_text = "\n".join(
                [f"{name}: {msg}" for name, msg in final_state["transcript"]]
            )
        else:
            raise ValueError(f"Invalid prompt name: {prompt_name}")

        # Parse the response to find the winner
        winner_str = response_text.split("WINNER:")[-1].strip()
        assert ("1" in winner_str) ^ (
            "2" in winner_str
        ), f"Invalid winner string: {winner_str}"
        winner = 1 if "1" in winner_str else 2

        return winner, response_text

    def run_round_robin_stage(self, llm: BaseChatModel):
        """
        Runs the round-robin stage of the tournament.
        Every hypothesis competes against every other hypothesis once using TOURNAMENT_PROMPT.
        Updates ELO ratings based on match outcomes.
        """
        hypo_ids = list(self.hypotheses.keys())
        stage = 1
        if len(hypo_ids) < 2:
            print("Not enough hypotheses for round robin stage.")
            return

        # Use itertools.combinations to get unique pairs
        for id1, id2 in list(itertools.combinations(hypo_ids, 2)):
            hypo1 = self.hypotheses[id1]
            hypo2 = self.hypotheses[id2]
            rating1 = self.ratings[id1]
            rating2 = self.ratings[id2]

            pair = tuple(sorted((id1, id2))) + (stage,)
            previous_outcome = self.match_history.get(pair, None)
            if previous_outcome is None:
                # If no history, run the match
                winner, debate = self._determine_winner(hypo1, hypo2, "tournament", llm)

                self.match_history[pair] = RankingMatchResult(
                    uid1=id1, uid2=id2, winner=winner, debate=debate
                )
                new_rating1, new_rating2 = update_elo(rating1, rating2, winner)

                self.ratings[id1] = new_rating1
                self.ratings[id2] = new_rating2

    def run_bracket_stage(self, llm: BaseChatModel, k: int = 16) -> Optional[str]:
        """
        Runs the single-elimination bracket stage for the top k hypotheses.
        Uses SIMULATED_DEBATE_PROMPT for matches.
        Does NOT update ELO ratings, only determines a winner.

        Parameters
        ----------
        k : int, optional
            The number of top hypotheses to include in the bracket (must be power of 2).

        Returns
        -------
        Optional[str]
            The ID of the winning hypothesis, or None if the stage cannot run or fails.
        """
        stage = 2
        # Check if k is a power of 2
        if k <= 0 or (k & (k - 1) != 0):
            raise ValueError(f"K must be power of 2. Got {k}.")

        sorted_hypotheses = self.get_sorted_hypotheses()
        if len(sorted_hypotheses) < k:
            print(
                f"Not enough hypotheses ({len(sorted_hypotheses)}) for a Top {k} bracket. Need at least {k}."
            )
            return None

        # Select top k hypothesis IDs
        bracket_contenders_ids = [h_id for h_id, _ in sorted_hypotheses[:k]]

        current_round_ids = bracket_contenders_ids
        round_num = 1

        while len(current_round_ids) > 1:
            next_round_ids = []
            # Create pairings (1 vs k, 2 vs k-1, etc. for the current list)
            num_contenders = len(current_round_ids)
            for i in range(num_contenders // 2):
                id1 = current_round_ids[i]
                id2 = current_round_ids[num_contenders - 1 - i]
                hypo1 = self.hypotheses[id1]
                hypo2 = self.hypotheses[id2]
                rating1 = self.ratings[id1]
                rating2 = self.ratings[id2]

                pair = tuple(sorted((id1, id2))) + (stage,)
                previous_outcome = self.match_history.get(pair, None)
                if previous_outcome is None:
                    # Pair hasn't played, run the LLM
                    winner, debate = self._determine_winner(
                        hypo1, hypo2, "simulated_debate", llm
                    )

                    winner_id = id1 if winner == 1 else id2
                    self.match_history[pair] = RankingMatchResult(
                        uid1=id1, uid2=id2, winner=winner, debate=debate
                    )
                    new_rating1, new_rating2 = update_elo(rating1, rating2, winner)
                    self.ratings[id1] = new_rating1
                    self.ratings[id2] = new_rating2
                else:
                    winner_id = id1 if previous_outcome.winner == 1 else id2

                next_round_ids.append(winner_id)

            # Re-sort the winners based on their potentially updated ELO ratings
            next_round_ids.sort(key=lambda h_id: self.ratings[h_id], reverse=True)

            current_round_ids = next_round_ids
            round_num += 1

    def run_tournament(self, llm: BaseChatModel, k_bracket: int = 16) -> Optional[str]:
        """
        Runs the full two-stage tournament.

        Parameters
        ----------
        k_bracket : int, optional
            The number of top hypotheses for the bracket stage.

        Returns
        -------
        Optional[str]
            The ID of the final winning hypothesis from the bracket stage, or None.
        """
        self.run_round_robin_stage(llm)
        self.run_bracket_stage(llm, k=k_bracket)
        self._past_tournament_ratings.append(list(self.ratings.values()))

    def get_win_loss_records(self) -> dict[str, dict[str, int]]:
        """
        Returns a dictionary containing win-loss records for each hypothesis.

        Returns
        -------
        dict[str, dict[str, int]]
            A dictionary where each key is a hypothesis ID and the value is another dictionary
            containing 'wins' and 'losses' counts.
        """
        records = {h_id: {"wins": 0, "losses": 0} for h_id in self.hypotheses.keys()}

        for match_result in self.match_history.values():
            winner_id = (
                match_result.uid1 if match_result.winner == 1 else match_result.uid2
            )
            loser_id = (
                match_result.uid2 if match_result.winner == 1 else match_result.uid1
            )

            records[winner_id]["wins"] += 1
            records[loser_id]["losses"] += 1

        return records

    def get_ranked_hypotheses(self) -> list[str]:
        """
        Returns a list containing the ID of every ranked hypothesis.

        Returns
        -------
        list[str]
            A list where each entry is the hypothesis ID of a ranked hypothesis.
        """
        win_loss_records = self.get_win_loss_records()

        ranked_hypotheses = []
        for h_id in self.hypotheses.keys():
            if {"wins": 0, "losses": 0} != win_loss_records[h_id]:
                ranked_hypotheses.append(h_id)

        return ranked_hypotheses

    def summarize_tournament_trajectory(self) -> str:
        """
        Summarizes the trajectory of the tournament for the supervisor agent.
        """
        summary_stats_dict = {
            "max_elo_rating": [],
            "num_elo_ratings_over_1400": [],
            "median_elo_rating": [],
        }
        for round_ratings in self._past_tournament_ratings[::-1]:
            summary_stats_dict["max_elo_rating"].append(max(round_ratings))
            summary_stats_dict["num_elo_ratings_over_1400"].append(
                sum(1 for rating in round_ratings if rating >= 1400)
            )
            summary_stats_dict["median_elo_rating"].append(
                statistics.median(round_ratings)
            )

        summary_stats_dict["top_3_elo_ratings"] = [
            rating for _, rating in self.get_sorted_hypotheses()[:3]
        ]
        summary_stats_dict["total_matches_played"] = len(self.match_history)
        summary_stats_dict["total_rounds_played"] = len(self._past_tournament_ratings)

        return summary_stats_dict
