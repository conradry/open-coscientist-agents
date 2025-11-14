from setuptools import find_packages, setup

with open("README.md", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="open-coscientist-agents",
    version="0.0.1",
    author="conradry",
    author_email="",  # Add your email if you want to include it
    description="Implementation of multi-agent system for AI co-scientist",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/conradry/open-coscientist-agents",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.9",
    install_requires=[
        # Core dependencies
        "jinja2>=3.1.2",
        "networkx>=3.5",
        "scikit-learn>=1.7.0",
        "typing-extensions>=4.5.0",
        "python-dotenv>=1.0.0",

        # LLM and LangChain dependencies (compatible versions)
        "langchain>=1.0.0,<2.0.0",
        "langchain-core>=1.0.0,<2.0.0",
        "langchain-community>=0.4.0",
        "langchain-anthropic>=1.0.0",
        "langchain-openai>=1.0.0",
        "langchain-google-genai>=3.0.0",
        "langchain-text-splitters>=1.0.0",
        "langgraph>=1.0.0",

        # Research dependencies
        # gpt-researcher from PyPI (same as https://github.com/assafelovic/gpt-researcher)
        "gpt-researcher>=0.14.5",

        # Additional core dependencies
        "numpy>=2.0.0,<2.3.0",
        "pydantic>=2.11.0",
        "pydantic-settings>=2.9.0",
        "anthropic>=0.69.0",
        "openai>=1.82.0",
        "google-ai-generativelanguage>=0.9.0",

        # For notebook support
        "ipython>=8.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "isort>=5.0.0",
            "mypy>=1.0.0",
            "ruff>=0.0.1",
            "pre-commit>=3.0.0",
        ],
        "docs": [
            "sphinx>=7.0.0",
            "sphinx-rtd-theme>=1.0.0",
        ],
    },
)
