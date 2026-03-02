import hashlib
import os
import pickle
import shutil
from datetime import datetime
from zoneinfo import ZoneInfo
from functools import wraps
from pathlib import Path
from typing import Literal, Optional, Union

from langchain_core.language_models import BaseChatModel

from coscientist.models.custom_types import ParsedHypothesis, ReviewedHypothesis
from coscientist.agents.evolution_agent import EvolveFromFeedbackState, OutOfTheBoxState
from coscientist.agents.final_report_agent import FinalReportState
from coscientist.agents.generation_agent import CollaborativeState, IndependentState
from coscientist.backends.lit_review_llm import LiteratureReviewState
from coscientist.agents.meta_review_agent import MetaReviewTournamentState
from coscientist.agents.proximity_agent import ProximityGraph
from coscientist.agents.ranking_agent import EloTournament
from coscientist.agents.reflection_agent import ReflectionState
from coscientist.agents.supervisor_agent import SupervisorDecisionState

# Global configuration for output directory
_OUTPUT_DIR = os.environ.get("COSCIENTIST_DIR", os.path.expanduser("/home/open-coscientist-agents"))


def _maybe_save(n: int = 1):
    """
    Decorator to auto-save state after every n method calls.

    Each decorated method maintains its own independent counter.

    Parameters
    ----------
    n : int
        Save frequency - save after every n calls (default: 1, set to 0 to disable)
    """

    def decorator(func):
        # Initialize counter for this specific method
        func._save_counter = 0
        func._save_frequency = n

        @wraps(func)
        def wrapper(self, *args, **kwargs):
            # Execute the original method
            result = func(self, *args, **kwargs)

            # Handle auto-save logic if enabled
            if func._save_frequency > 0:
                func._save_counter += 1
                if func._save_counter >= func._save_frequency:
                    func._save_counter = 0  # Reset counter
                    self._state.save()

            return result

        return wrapper

    return decorator


class CoscientistState:
    """
    Global state for the Coscientist multi-agent system.

    This class manages the outputs from all six main agents and provides
    persistence capabilities for the entire system state.
    """

    def __init__(self, goal: str):
        self.goal = goal
        self.literature_review = None
        self.generated_hypotheses = []
        self.reviewed_hypotheses = []
        self.tournament = None
        self.evolved_hypotheses = []
        self.meta_reviews = []
        self.proximity_graph = None
        self.reflection_queue = []
        self.supervisor_decisions = []
        self.final_report = None

        # Fields needed for the summary given to the supervisor agent
        self.num_ranked_hypotheses_at_meta_review = 0
        self.actions = []
        self.cosine_similarity_trajectory = []
        self.cluster_count_trajectory = []

        self._iteration = 0  # Hidden parameter for tracking saves

        # Create goal-specific output directory
        goal_hash = self._hash_goal(goal)
        self._output_dir = os.path.join(_OUTPUT_DIR, goal_hash)

        # Check if directory already exists
        if os.path.exists(self._output_dir):
            raise FileExistsError(
                f"Directory for goal already exists: {self._output_dir}\n"
                f"Please use CoscientistState.load_latest(goal='{goal}') to resume, "
                f"or call CoscientistState.clear_goal_directory('{goal}') to start fresh."
            )

        # Create the directory
        Path(self._output_dir).mkdir(parents=True, exist_ok=True)

        # Store goal metadata for discoverability
        goal_file = os.path.join(self._output_dir, "goal.txt")
        with open(goal_file, "w", encoding="utf-8") as f:
            f.write(goal)

    @staticmethod
    def _normalize_goal(goal: str) -> str:
        """
        Normalize the goal string for consistent hashing.

        Parameters
        ----------
        goal : str
            The research goal string

        Returns
        -------
        str
            Normalized goal string (stripped and lowercased)
        """
        return goal.strip().lower()

    @staticmethod
    def _hash_goal(goal: str) -> str:
        """
        Generate a hash string from the goal for directory naming.

        Parameters
        ----------
        goal : str
            The research goal string

        Returns
        -------
        str
            First 12 characters of SHA256 hash of the normalized goal
        """
        normalized_goal = CoscientistState._normalize_goal(goal)
        return hashlib.sha256(normalized_goal.encode("utf-8")).hexdigest()[:12]

    @classmethod
    def list_all_goals(cls) -> list[tuple[str, str]]:
        """
        List all research goals with their corresponding hash directories.

        Returns
        -------
        list[tuple[str, str]]
            List of (original_goal, hash_directory) tuples for all existing goal directories
        """
        if not os.path.exists(_OUTPUT_DIR):
            return []

        goals = []
        for item in os.listdir(_OUTPUT_DIR):
            item_path = os.path.join(_OUTPUT_DIR, item)
            if os.path.isdir(item_path):
                goal_file = os.path.join(item_path, "goal.txt")
                if os.path.exists(goal_file):
                    try:
                        with open(goal_file, encoding="utf-8") as f:
                            original_goal = f.read().strip()
                        goals.append((original_goal, item))
                    except (OSError, UnicodeDecodeError):
                        # Skip directories with unreadable goal files
                        continue

        # Sort by goal string for consistent ordering
        goals.sort(key=lambda x: x[0])
        return goals

    @classmethod
    def clear_goal_directory(cls, goal: str) -> str:
        """
        Clear the directory for a specific goal.

        Parameters
        ----------
        goal : str
            The research goal whose directory should be cleared

        Returns
        -------
        str
            Confirmation message with the path that was cleared
        """
        goal_hash = cls._hash_goal(goal)
        goal_dir = os.path.join(_OUTPUT_DIR, goal_hash)

        if os.path.exists(goal_dir):
            shutil.rmtree(goal_dir)
            return f"Successfully cleared directory: {goal_dir}"
        else:
            return f"Directory does not exist: {goal_dir}"

    # Persistence methods
    def save(self) -> str:
        """
        Save the current state to a pickle file.

        Returns
        -------
        str
            Path to the saved checkpoint file
        """
        # Generate filename with datetime and iteration
        timestamp = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y%m%d_%H%M%S")
        filename = f"state_{timestamp}_iter_{self._iteration:04d}.pkl"
        filepath = os.path.join(self._output_dir, filename)

        # Save state to pickle file
        with open(filepath, "wb") as f:
            pickle.dump(self, f)

        # Increment iteration counter
        self._iteration += 1

        return filepath

    @classmethod
    def load(cls, filepath: str) -> "CoscientistState":
        """
        Load a CoscientistState from a pickle file.

        Parameters
        ----------
        filepath : str
            Path to the pickle file to load

        Returns
        -------
        CoscientistState
            The loaded state object
        """
        with open(filepath, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def list_checkpoints(
        directory: Optional[str] = None, goal: Optional[str] = None
    ) -> list[str]:
        """
        List all available checkpoint files in the directory.

        Parameters
        ----------
        directory : Optional[str]
            Directory to search for checkpoints. Cannot be used with goal parameter.
        goal : Optional[str]
            Research goal to search checkpoints for. Cannot be used with directory parameter.

        Returns
        -------
        list[str]
            List of checkpoint filepaths, sorted by modification time (newest first)

        Raises
        ------
        ValueError
            If both directory and goal are provided, or if neither is provided
        """
        if directory is not None and goal is not None:
            raise ValueError("Cannot specify both directory and goal parameters")
        if directory is None and goal is None:
            raise ValueError("Must specify either directory or goal parameter")

        if goal is not None:
            goal_hash = CoscientistState._hash_goal(goal)
            search_directory = os.path.join(_OUTPUT_DIR, goal_hash)
        else:
            search_directory = directory

        if not os.path.exists(search_directory):
            return []

        # Find all pickle files matching our naming pattern
        checkpoint_files = []
        for filename in os.listdir(search_directory):
            if filename.startswith("state_") and filename.endswith(".pkl"):
                filepath = os.path.join(search_directory, filename)
                checkpoint_files.append(filepath)

        # Sort by modification time (newest first)
        checkpoint_files.sort(key=os.path.getmtime, reverse=True)

        return checkpoint_files

    @classmethod
    def load_latest(
        cls, directory: Optional[str] = None, goal: Optional[str] = None
    ) -> Optional["CoscientistState"]:
        """
        Load the most recent checkpoint from the directory.

        Parameters
        ----------
        directory : Optional[str]
            Directory to search for checkpoints. Cannot be used with goal parameter.
        goal : Optional[str]
            Research goal to search checkpoints for. Cannot be used with directory parameter.

        Returns
        -------
        Optional[CoscientistState]
            The loaded state object, or None if no checkpoints found

        Raises
        ------
        ValueError
            If both directory and goal are provided, or if neither is provided
        """
        checkpoints = cls.list_checkpoints(directory=directory, goal=goal)
        if not checkpoints:
            return None

        return cls.load(checkpoints[0])  # Load the newest checkpoint


class CoscientistStateManager:
    """
    Manager class for coordinating operations on CoscientistState.

    This class provides higher-level operations for managing the flow
    of hypotheses through the multi-agent pipeline.
    """

    def __init__(self, state: CoscientistState):
        """
        Initialize the manager with a CoscientistState.

        Parameters
        ----------
        state : CoscientistState
            The state object to manage
        """
        # This state should not be accessed directly. All the methods
        # that update the state have logic to save checkpoints.
        self._state = state
        self._setup()

    # State field properties
    @property
    def goal(self) -> str:
        """The research goal."""
        return self._state.goal

    @property
    def is_started(self) -> bool:
        """
        Check if the Coscientist system has started.
        """
        # Completing the first meta-review signals that
        # the system has finished one full iteration.
        return len(self._state.meta_reviews) > 0

    @property
    def is_finished(self) -> bool:
        """
        Check if the Coscientist system has finished.
        """
        return self._state.final_report is not None

    @property
    def has_literature_review(self) -> bool:
        """
        Check if the Coscientist system has completed the literature review.
        """
        return self._state.literature_review is not None

    @property
    def final_report(self) -> str:
        """
        Get the final report state.
        """
        return self._state.final_report["result"]

    @property
    def meta_review(self) -> str:
        """
        Get the meta-review state.
        """
        return self._state.meta_reviews[-1]["result"]

    def get_tournament_hypotheses_for_evolution(self) -> list[str]:
        """
        Get the ranked tournament hypotheses that are qualified for evolution.
        """
        # This gets us all the hypotheses in the tournament ordered
        # by rank. Some of them may not have competed yet though.
        ranked_order = self._state.tournament.get_sorted_hypotheses()
        # The records dictionary tells us which hypotheses have competed
        # already and are therefore qualified for evolution.
        have_competed = self._state.tournament.get_win_loss_records().keys()

        return [h_id for h_id, _ in ranked_order if h_id in have_competed]

    def summarize_tournament_trajectory(self) -> str:
        """
        Summarizes the trajectory of the tournament for the supervisor agent.
        """
        return self._state.tournament.summarize_tournament_trajectory()

    def get_hypothesis_by_uid(
        self,
        uid: str,
        location: Literal[
            "tournament", "generated", "reviewed", "evolved", "reflection_queue"
        ],
    ) -> ParsedHypothesis | ReviewedHypothesis:
        """
        Get a hypothesis by its UID. Must specify the location of the hypothesis.
        This prevents us from accidentally using a hypothesis that isn't at the right
        stage of development for a task.
        """
        if location == "tournament":
            return self._state.tournament.hypotheses[uid]
        elif location == "generated":
            for hypothesis in self._state.generated_hypotheses:
                if hypothesis.uid == uid:
                    return hypothesis
            raise ValueError(
                f"Hypothesis with UID '{uid}' not found in generated hypotheses"
            )
        elif location == "reviewed":
            for hypothesis in self._state.reviewed_hypotheses:
                if hypothesis.uid == uid:
                    return hypothesis
            raise ValueError(
                f"Hypothesis with UID '{uid}' not found in reviewed hypotheses"
            )
        elif location == "evolved":
            for hypothesis in self._state.evolved_hypotheses:
                if hypothesis.uid == uid:
                    return hypothesis
            raise ValueError(
                f"Hypothesis with UID '{uid}' not found in evolved hypotheses"
            )
        elif location == "reflection_queue":
            for hypothesis in self._state.reflection_queue:
                if hypothesis.uid == uid:
                    return hypothesis
            raise ValueError(
                f"Hypothesis with UID '{uid}' not found in reflection queue"
            )
        else:
            raise ValueError(
                f"Invalid location '{location}'. Must be 'tournament', 'generated', "
                "'reviewed', 'evolved', or 'reflection_queue'"
            )

    @property
    def total_hypotheses(self) -> int:
        """
        Get the total number of hypotheses in the system.
        """
        return (
            len(self._state.generated_hypotheses)
            + len(self._state.reviewed_hypotheses)
            + len(self._state.evolved_hypotheses)
            + len(self._state.tournament.hypotheses)
        )

    @property
    def num_tournament_hypotheses(self) -> int:
        """
        Get the number of hypotheses currently in the tournament.
        """
        return len(self._state.tournament.hypotheses)

    @property
    def num_unranked_hypotheses(self) -> int:
        """
        Get the number of hypotheses that have not yet been ranked in the tournament.
        """
        return len(self._state.tournament.hypotheses) - len(
            self._state.tournament.get_win_loss_records()
        )

    @property
    def reflection_queue_is_empty(self) -> bool:
        """
        Check if the reflection queue is empty.
        """
        return len(self._state.reflection_queue) == 0

    @_maybe_save(n=1)
    def add_generated_hypothesis(
        self, hypothesis: Union[IndependentState, CollaborativeState]
    ) -> None:
        """
        Add a generated hypothesis to the collection.

        Parameters
        ----------
        hypothesis : Union[IndependentState, CollaborativeState]
            The hypothesis state to add
        """
        self._state.generated_hypotheses.append(hypothesis)

    @_maybe_save(n=1)
    def add_reviewed_hypothesis(self, reviewed_hypothesis: ReviewedHypothesis) -> None:
        """
        Add a reviewed hypothesis result to the collection.

        Parameters
        ----------
        reviewed_hypothesis : ReviewedHypothesis
            The reviewed hypothesis state to add
        """
        self._state.reviewed_hypotheses.append(reviewed_hypothesis)

    @_maybe_save(n=1)
    def add_evolved_hypothesis(
        self, evolved_hypothesis: Union[EvolveFromFeedbackState, OutOfTheBoxState]
    ) -> None:
        """
        Add an evolved hypothesis to the collection.

        Parameters
        ----------
        evolved_hypothesis : Union[EvolveFromFeedbackState, OutOfTheBoxState]
            The evolved hypothesis state to add
        """
        self._state.evolved_hypotheses.append(evolved_hypothesis)

    @_maybe_save(n=1)
    def add_action(self, action: str) -> None:
        """
        Add a tournament hypothesis to the collection.
        """
        self._state.actions.append(action)

    @_maybe_save(n=1)
    def add_cosine_similarity(self, cosine_similarity: float) -> None:
        """
        Add a cosine similarity score to the collection.
        """
        self._state.cosine_similarity_trajectory.append(cosine_similarity)

    @_maybe_save(n=1)
    def add_cluster_count(self, cluster_count: int) -> None:
        """
        Add a cluster count to the collection.
        """
        self._state.cluster_count_trajectory.append(cluster_count)

    @_maybe_save(n=1)
    def update_literature_review(
        self, literature_review: LiteratureReviewState
    ) -> None:
        """
        Update the literature review state.

        Parameters
        ----------
        literature_review : LiteratureReviewState
            The new literature review state
        """
        self._state.literature_review = literature_review

    @_maybe_save(n=1)
    def update_meta_review(self, meta_review: MetaReviewTournamentState) -> None:
        """
        Update the meta-review state.

        Parameters
        ----------
        meta_review : MetaReviewTournamentState
            The new meta-review state
        """
        self._state.meta_reviews.append(meta_review)
        self._state.num_ranked_hypotheses_at_meta_review = len(
            self._state.tournament.get_win_loss_records()
        )

    @_maybe_save(n=1)
    def update_proximity_graph_edges(self) -> None:
        """
        Update the proximity graph state.
        """
        assert (
            self._state.proximity_graph is not None
        ), "Proximity graph is not initialized"
        self._state.proximity_graph.update_edges()
        self._state.cosine_similarity_trajectory.append(
            self._state.proximity_graph.average_cosine_similarity
        )
        self._state.cluster_count_trajectory.append(
            len(self._state.proximity_graph.get_semantic_communities())
        )

    @_maybe_save(n=1)
    def update_supervisor_decision(
        self, supervisor_decision: SupervisorDecisionState
    ) -> None:
        """
        Update the supervisor decision state.
        """
        self._state.supervisor_decisions.append(supervisor_decision)

    @_maybe_save(n=1)
    def update_final_report(self, final_report: FinalReportState) -> None:
        """
        Update the final report state.
        """
        self._state.final_report = final_report

    @_maybe_save(n=3)
    def advance_hypothesis(self, kind: Literal["generated", "evolved"]) -> None:
        """
        Move a hypothesis from generation/evolution to the reflection queue.

        This method pops the first hypothesis from the specified list,
        adds it to the reflection queue, and updates the proximity graph.

        Parameters
        ----------
        kind : Literal["generated", "evolved"]
            The type of hypothesis to advance - either "generated" or "evolved"

        Raises
        ------
        IndexError
            If the specified list is empty
        ValueError
            If kind is not "generated" or "evolved"
        """
        if kind == "generated":
            if not self._state.generated_hypotheses:
                raise IndexError("No generated hypotheses available to advance")

            parsed_hypothesis = self._state.generated_hypotheses.pop(0)

        elif kind == "evolved":
            if not self._state.evolved_hypotheses:
                raise IndexError("No evolved hypotheses available to advance")

            parsed_hypothesis = self._state.evolved_hypotheses.pop(0)

        else:
            raise ValueError(f"Invalid kind '{kind}'. Must be 'generated' or 'evolved'")

        # Add to reflection queue
        self._state.reflection_queue.append(parsed_hypothesis)

        # Add to proximity graph if it exists
        assert (
            self._state.proximity_graph is not None
        ), "Proximity graph is not initialized"
        self._state.proximity_graph.add_hypothesis(parsed_hypothesis)

    @_maybe_save(n=1)
    def advance_reviewed_hypothesis(self) -> None:
        """
        Move a hypothesis from reviewed_hypotheses to the EloTournament.

        This method pops the first reviewed hypothesis from the reviewed_hypotheses list
        and adds it to the EloTournament by calling the add_hypothesis method.

        Raises
        ------
        IndexError
            If the reviewed_hypotheses list is empty
        """
        if not self._state.reviewed_hypotheses:
            raise IndexError("No reviewed hypotheses available to advance")

        reviewed_hypothesis_state = self._state.reviewed_hypotheses.pop(0)
        # Add to tournament
        assert self._state.tournament is not None, "Tournament is not initialized"
        self._state.tournament.add_hypothesis(reviewed_hypothesis_state)

    @_maybe_save(n=1)
    def run_tournament(self, llm: BaseChatModel, k_bracket: int = 16) -> None:
        """
        Run the tournament.
        """
        assert self._state.tournament is not None, "Tournament is not initialized"
        self._state.tournament.run_tournament(llm=llm, k_bracket=k_bracket)

    def _setup(self) -> None:
        """
        Initialize EloTournament and ProximityGraph if they are None.

        This method ensures that the required objects are created
        and available for use by other components.
        """
        if self._state.tournament is None:
            self._state.tournament = EloTournament(self._state.goal)

        if self._state.proximity_graph is None:
            self._state.proximity_graph = ProximityGraph()

    def next_literature_review_state(
        self, max_subtopics: int = 5
    ) -> LiteratureReviewState:
        """
        Create an initial state for the literature review agent.

        Parameters
        ----------
        max_subtopics : int
            Maximum number of subtopics to decompose the research goal into

        Returns
        -------
        LiteratureReviewState
            Initial state with goal and max_subtopics set, empty lists for subtopics and reports
        """
        if self._state.literature_review is not None:
            subtopics = self._state.literature_review.get("subtopics", [])
            subtopic_reports = self._state.literature_review.get("subtopic_reports", [])
        else:
            subtopics = []
            subtopic_reports = []

        if self._state.meta_reviews:
            meta_review = self._state.meta_reviews[-1]["result"]
        else:
            meta_review = ""

        return LiteratureReviewState(
            goal=self._state.goal,
            max_subtopics=max_subtopics,
            subtopics=subtopics,
            subtopic_reports=subtopic_reports,
            meta_review=meta_review,
        )

    def next_generation_state(
        self,
        mode: Literal["independent", "collaborative"],
        first_agent_name: str | None = None,
    ) -> Union[IndependentState, CollaborativeState]:
        """
        Create an initial state for the generation agent.

        Parameters
        ----------
        mode : Literal["independent", "collaborative"]
            The type of generation state to create
        first_agent_name : str | None
            The name of the first agent in the collaborative mode. If None, the
            mode must be "independent".

        Returns
        -------
        Union[IndependentState, CollaborativeState]
            Initial state with goal and literature_review set, meta_review included if available
        """
        # Get literature review content
        if self._state.literature_review is None:
            raise ValueError(
                "Literature review must be completed before generation can begin"
            )

        # Join subtopic reports into a single literature review string
        literature_review_content = "\n\n".join(
            self._state.literature_review["subtopic_reports"]
        )

        # Create base state with required fields
        base_state = {
            "goal": self._state.goal,
            "literature_review": literature_review_content,
        }

        # Add meta_review if available
        if self._state.meta_reviews:
            base_state["meta_review"] = self._state.meta_reviews[-1]["result"]

        if mode == "independent":
            return IndependentState(**base_state)
        elif mode == "collaborative":
            # Add MultiTurnState fields for collaborative mode
            collaborative_state = CollaborativeState(
                **base_state,
                transcript=[],
                turn=0,
                next_agent=first_agent_name,
                finished=False,
            )
            return collaborative_state
        else:
            raise ValueError(
                f"Invalid mode '{mode}'. Must be 'independent' or 'collaborative'"
            )

    def next_reflection_state(self) -> ReflectionState:
        """
        Create an initial state for the reflection agent.

        Pops a hypothesis from the reflection queue and creates a ReflectionState
        with that hypothesis and default initial values for all other fields.

        Returns
        -------
        ReflectionState
            Initial state with hypothesis_to_review set and all other fields initialized

        Raises
        ------
        IndexError
            If the reflection queue is empty
        """
        if not self._state.reflection_queue:
            raise IndexError(
                "No hypotheses available in reflection queue. Please advance a hypothesis first."
            )

        # Pop the first hypothesis from the queue
        hypothesis_to_review = self._state.reflection_queue.pop(0)

        return ReflectionState(hypothesis_to_review=hypothesis_to_review)

    def next_evolution_state(
        self,
        mode: Literal["evolve_from_feedback", "out_of_the_box"],
        uid_to_evolve: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> Union[EvolveFromFeedbackState, OutOfTheBoxState]:
        """
        Create an initial state for the evolution agent.

        Parameters
        ----------
        mode : Literal["evolve_from_feedback", "out_of_the_box"]
            The type of evolution state to create
        uid_to_evolve : Optional[str]
            The UID of the hypothesis to evolve (required for "evolve_from_feedback" mode)
        top_k : Optional[int]
            Number of top hypotheses to include (required for "out_of_the_box" mode)

        Returns
        -------
        Union[EvolveFromFeedbackState, OutOfTheBoxState]
            Initial state with goal and required hypothesis data

        Raises
        ------
        ValueError
            If tournament is not initialized or required parameters are missing
        KeyError
            If uid_to_evolve is not found in tournament hypotheses
        """
        if self._state.tournament is None:
            raise ValueError(
                "Tournament must be initialized before evolution can begin"
            )

        if mode == "evolve_from_feedback":
            if uid_to_evolve is None:
                raise ValueError(
                    "uid_to_evolve is required for 'evolve_from_feedback' mode"
                )

            if uid_to_evolve not in self._state.tournament.hypotheses:
                raise KeyError(
                    f"Hypothesis with UID '{uid_to_evolve}' not found in tournament"
                )

            parent_hypothesis = self._state.tournament.hypotheses[uid_to_evolve]

            # Create base state
            base_state = {
                "goal": self._state.goal,
                "parent_hypothesis": parent_hypothesis,
            }

            # Add meta_review if available
            if self._state.meta_reviews:
                base_state["meta_review"] = self._state.meta_reviews[-1]["result"]
            else:
                base_state["meta_review"] = "Not Available"

            return EvolveFromFeedbackState(**base_state)

        elif mode == "out_of_the_box":
            if top_k is None:
                raise ValueError("top_k is required for 'out_of_the_box' mode")

            # Get sorted hypotheses and select top k
            sorted_hypotheses = self._state.tournament.get_sorted_hypotheses()
            if len(sorted_hypotheses) < top_k:
                raise ValueError(
                    f"Not enough hypotheses in tournament. Requested {top_k}, but only {len(sorted_hypotheses)} available"
                )

            # Get the top k hypotheses
            elo_ratings = []
            top_hypotheses = []
            for uid, rating in sorted_hypotheses[:top_k]:
                top_hypotheses.append(self._state.tournament.hypotheses[uid])
                elo_ratings.append(rating)

            return OutOfTheBoxState(
                goal=self._state.goal,
                top_hypotheses=top_hypotheses,
                elo_ratings=elo_ratings,
            )

        else:
            raise ValueError(
                f"Invalid mode '{mode}'. Must be 'evolve_from_feedback' or 'out_of_the_box'"
            )

    def next_meta_review_state(self, top_k: int) -> MetaReviewTournamentState:
        """
        Create an initial state for the meta-review agent.

        Parameters
        ----------
        top_k : int
            Number of top hypotheses to include in the meta-review analysis

        Returns
        -------
        MetaReviewTournamentState
            Initial state with goal, tournament, and top_k set

        Raises
        ------
        ValueError
            If tournament is not initialized
        """
        if self._state.tournament is None:
            raise ValueError(
                "Tournament must be initialized before meta-review can begin"
            )

        # Compute the cosine similarity between all hypotheses
        # before meta-review
        return MetaReviewTournamentState(
            goal=self._state.goal,
            tournament=self._state.tournament,
            top_k=top_k,
        )

    def next_final_report_state(self, top_k: int = 3) -> FinalReportState:
        """
        Create an initial state for the final report agent.
        """
        return FinalReportState(
            goal=self._state.goal,
            tournament=self._state.tournament,
            top_k=top_k,
        )

    def next_supervisor_state(self) -> SupervisorDecisionState:
        """
        Create an initial state for the supervisor agent.
        """
        # Get meta review content
        meta_review = (
            self._state.meta_reviews[-1]["result"] if self._state.meta_reviews else ""
        )
        previous_meta_review = (
            self._state.meta_reviews[-2]["result"]
            if len(self._state.meta_reviews) > 1
            else ""
        )

        # Get tournament statistics if tournament exists
        if self._state.tournament is not None:
            tournament_stats = self._state.tournament.summarize_tournament_trajectory()
            total_matches_played = tournament_stats["total_matches_played"]
            total_rounds_played = tournament_stats["total_rounds_played"]
            top_3_elo_ratings = str(tournament_stats["top_3_elo_ratings"])
            max_elo_rating = str(tournament_stats["max_elo_rating"])
            num_elo_ratings_over_1400 = str(
                tournament_stats["num_elo_ratings_over_1400"]
            )
            median_elo_rating = str(tournament_stats["median_elo_rating"])
        else:
            total_matches_played = 0
            total_rounds_played = 0
            top_3_elo_ratings = "[]"
            max_elo_rating = "[]"
            num_elo_ratings_over_1400 = "[]"
            median_elo_rating = "[]"

        # Get literature review subtopics completed
        literature_review_subtopics_completed = (
            len(self._state.literature_review.get("subtopics", []))
            if self._state.literature_review
            else 0
        )

        # Format latest actions (most recent first)
        latest_actions = ", ".join(reversed(self._state.actions[-10:]))

        # Calculate new hypotheses since last meta-review
        current_ranked_hypotheses = (
            len(self._state.tournament.get_win_loss_records())
            if self._state.tournament
            else 0
        )
        new_hypotheses_since_meta_review = (
            current_ranked_hypotheses - self._state.num_ranked_hypotheses_at_meta_review
        )

        # Count total meta-reviews completed (initial + supervisor-decided ones)
        num_meta_reviews = 1 + self._state.actions.count("run_meta_review")

        return SupervisorDecisionState(
            goal=self._state.goal,
            meta_review=meta_review,
            previous_meta_review=previous_meta_review,
            total_actions=len(self._state.actions),
            latest_actions=latest_actions,
            total_hypotheses=self.total_hypotheses,
            num_unranked_hypotheses=self.num_unranked_hypotheses,
            num_meta_reviews=num_meta_reviews,
            new_hypotheses_since_meta_review=new_hypotheses_since_meta_review,
            total_matches_played=total_matches_played,
            total_rounds_played=total_rounds_played,
            top_3_elo_ratings=top_3_elo_ratings,
            max_elo_rating=max_elo_rating,
            num_elo_ratings_over_1400=num_elo_ratings_over_1400,
            median_elo_rating=median_elo_rating,
            cosine_similarity_trajectory=str(
                self._state.cosine_similarity_trajectory[::-1]
            ),
            cluster_count_trajectory=str(self._state.cluster_count_trajectory[::-1]),
            literature_review_subtopics_completed=literature_review_subtopics_completed,
        )
