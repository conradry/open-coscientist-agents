"""
Literature review backends for the Coscientist framework.

Each backend is a factory function that takes an LLM and returns a compiled LangGraph.
Available backends:

- ``llm``: Pure LLM, no external tools (default, fastest)
- ``gpt_researcher``: Web search via GPTResearcher
- ``paperqa``: (future) Paper-based retrieval

Usage::

    from coscientist.framework import CoscientistConfig

    # Option 1: Use backend string (recommended)
    config = CoscientistConfig(literature_review_backend="gpt_researcher")

    # Option 2: Set via environment variable
    # export COSCIENTIST_LIT_REVIEW_BACKEND=gpt_researcher
    config = CoscientistConfig()  # reads from env
"""


def resolve(backend: str):
    """
    Resolve backend name to builder function.

    Parameters
    ----------
    backend : str
        Backend name: "llm", "gpt_researcher", etc.

    Returns
    -------
    callable
        Builder function for the specified backend.
    """
    backend = backend.lower()
    if backend == "gpt_researcher":
        from .lit_review_gpt_researcher import build_lit_review_gpt_researcher

        return build_lit_review_gpt_researcher
    elif backend == "llm":
        from .lit_review_llm import build_lit_review_llm

        return build_lit_review_llm
    else:
        raise ValueError(
            f"Unknown literature_review_backend: {backend}. "
            f"Valid options: llm, gpt_researcher"
        )


def __getattr__(name):
    if name == "build_lit_review_llm":
        from .lit_review_llm import build_lit_review_llm

        return build_lit_review_llm
    if name == "build_lit_review_gpt_researcher":
        from .lit_review_gpt_researcher import build_lit_review_gpt_researcher

        return build_lit_review_gpt_researcher
    raise AttributeError(f"module 'coscientist.backends' has no attribute {name!r}")
