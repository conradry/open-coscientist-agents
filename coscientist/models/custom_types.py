import uuid

from pydantic import BaseModel, Field


class ParsedHypothesis(BaseModel):
    """Structured output for parsed hypothesis."""

    uid: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for the hypothesis",
    )
    hypothesis: str = Field(description="The main hypothesis statement")
    predictions: list[str] = Field(
        description="A list of predictions that could be tested to disprove the hypothesis"
    )
    assumptions: list[str] = Field(
        description="A list of assumptions that are implicit or explicit in the hypothesis"
    )
    parent_uid: str | None = Field(
        default=None,
        description="The unique identifier of the parent hypothesis, if applicable",
    )


class ReviewedHypothesis(ParsedHypothesis):
    """Structured output for reviewed hypothesis."""

    causal_reasoning: str = Field(description="The causal reasoning for the hypothesis")
    assumption_research_results: dict[str, str] = Field(
        description="A dictionary of assumption research results"
    )
    verification_result: str = Field(
        description="The result of the deep verification process"
    )


class RankingMatchResult(BaseModel):
    """Result of a match between two hypotheses."""

    uid1: str = Field(description="Unique identifier for the first hypothesis")
    uid2: str = Field(description="Unique identifier for the second hypothesis")
    winner: int = Field(description="The winner of the match (1 or 2)")
    debate: str = Field(description="The debate between the two hypotheses")
