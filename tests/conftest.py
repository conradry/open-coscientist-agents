"""Shared pytest fixtures for the coscientist test suite."""

import pytest

from coscientist.models.custom_types import ParsedHypothesis, ReviewedHypothesis, RankingMatchResult


@pytest.fixture
def sample_hypothesis():
    return ParsedHypothesis(
        hypothesis="Mitochondrial dysfunction drives neurodegeneration via oxidative stress.",
        predictions=[
            "Neurons with impaired mitochondria will show elevated ROS levels.",
            "Antioxidant treatment will slow neurodegeneration in affected cells.",
        ],
        assumptions=[
            "Mitochondria are the primary source of ROS in neurons.",
            "Oxidative stress is causally upstream of cell death in this context.",
        ],
    )


@pytest.fixture
def sample_reviewed_hypothesis(sample_hypothesis):
    return ReviewedHypothesis(
        **sample_hypothesis.model_dump(),
        causal_reasoning="Impaired electron transport chain → elevated ROS → lipid peroxidation → apoptosis.",
        assumption_research_results={
            "Mitochondria are the primary source of ROS in neurons.": "Supported by multiple in-vitro studies.",
            "Oxidative stress is causally upstream of cell death in this context.": "Partial support; other pathways may contribute.",
        },
        verification_result="Hypothesis is plausible with moderate confidence. Key assumptions are supported but not conclusive.",
    )
