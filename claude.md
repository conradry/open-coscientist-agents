# Claude Development Guide for Co-Scientist Swarm

## Overview

This repository implements an open-source multi-agent AI system for scientific discovery, based on Google DeepMind's AI co-scientist research. The system uses tournament-style hypothesis competition to drive research forward.

## Development with Claude

### Virtual Environment Setup

This project uses a virtual environment (`.venv`) for dependency management. **Always activate the virtual environment before running commands:**

```bash
source .venv/bin/activate
```

All future commands, tests, and Claude tasks should be run with the virtual environment activated.

### Getting Started

When working with this codebase using Claude, you have access to several specialized tools and capabilities:

- **Multi-Agent Architecture**: The system uses LangGraph for agent orchestration
- **State Management**: Comprehensive persistence and recovery system
- **Tournament System**: ELO-based hypothesis competition
- **Web Interface**: Streamlit dashboard for visualization
- **Environment Variables**: Automatic loading from `.env` file

### Key Development Patterns

#### 1. Agent Development
All agents follow this pattern:
```python
class SomeAgent:
    def __init__(self, llm, config):
        self.llm = llm
        self.config = config

    async def process(self, input_data):
        # Agent-specific processing logic
        return processed_result
```

#### 2. State Management
Use the global state system for persistence:
```python
from coscientist.global_state import CoscientistState, CoscientistStateManager

state = CoscientistState(goal="research question")
state_manager = CoscientistStateManager(state)
```

#### 3. Working with Hypotheses
```python
from coscientist.custom_types import ParsedHypothesis, ReviewedHypothesis

# Create hypothesis
hypothesis = ParsedHypothesis(
    uid="unique_id",
    hypothesis="testable statement",
    predictions=["prediction1", "prediction2"],
    assumptions=["assumption1"]
)
```

### Codebase Structure

```
coscientist/
├── agents/                  # Individual agent implementations
├── prompts/                # Jinja2 templates for LLM interactions
├── tools/                  # External tool integrations
├── framework.py           # Main orchestration logic
├── global_state.py        # State management and persistence
└── custom_types.py        # Data models and schemas

app/                       # Streamlit web interface
├── *_page.py             # UI components
└── tournament_viewer.py  # Main dashboard
```

### Agent Types

1. **Literature Review Agent** - Research and topic decomposition
2. **Generation Agent** - Creates hypotheses using 10 reasoning approaches
3. **Reflection Agent** - Multi-stage verification and analysis
4. **Ranking Agent** - ELO tournament management
5. **Evolution Agent** - Hypothesis refinement and improvement
6. **Meta-Review Agent** - Synthesizes insights across results
7. **Supervisor Agent** - Orchestrates workflow decisions
8. **Final Report Agent** - Generates comprehensive summaries

### Common Development Tasks

#### Adding New Agents
1. Create agent class in `coscientist/agents/`
2. Add agent type to `custom_types.py`
3. Create prompts in `coscientist/prompts/`
4. Integrate with framework in `framework.py`

#### Modifying Tournament Logic
- ELO calculations: `ranking_agent.py`
- Match scheduling: `framework.py`
- Rating updates: `ranking_agent.py`

#### Extending Web Interface
- Add new pages to `app/`
- Update `tournament_viewer.py` navigation
- Use Streamlit components for visualization

### Configuration

The system automatically loads credentials from the `.env` file. Required environment variables:

```bash
# LLM Provider API Keys
GOOGLE_API_KEY=your-google-api-key
ANTHROPIC_AUTH_TOKEN=your-anthropic-token
OPENAI_API_KEY=your-openai-api-key
TAVILY_API_KEY=your-tavily-api-key

# Custom Endpoints (for Zai)
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
OPENAI_API_BASE=https://api.z.ai/api/paas/v4
```

The system supports multiple LLM providers:
- **Smart Models**: o3, Gemini 2.5 Pro, Claude Sonnet 4
- **Cheap Models**: o4-mini, Gemini 2.5 Flash
- **Embeddings**: OpenAI text-embedding-3-small

**Note**: Always activate the virtual environment before running any commands:
```bash
source .venv/bin/activate
```

### Testing and Validation

#### Running the System
```bash
# Always activate virtual environment first!
source .venv/bin/activate

python -c "
import asyncio
from coscientist.framework import CoscientistConfig, CoscientistFramework
from coscientist.global_state import CoscientistState, CoscientistStateManager

goal = 'Your research question'
initial_state = CoscientistState(goal=goal)
config = CoscientistConfig()
state_manager = CoscientistStateManager(initial_state)
cosci = CoscientistFramework(config, state_manager)

final_report, final_meta_review = asyncio.run(cosci.run())
"
```

#### Web Interface
```bash
# Always activate virtual environment first!
source .venv/bin/activate

cd app
pip install -r viewer_requirements.txt
streamlit run tournament_viewer.py
```

**Note**: The `viewer_requirements.txt` has been updated to match the current working versions and includes only the dependencies actually used by the web interface.

### Development Notes

#### State Persistence
- Auto-save decorators handle periodic checkpointing
- Goal-based directories organize research sessions
- Resume capability loads latest checkpoint automatically

#### Async Processing
- Literature review runs in parallel across subtopics
- Assumption research uses concurrent execution
- Tournament matches can be processed in parallel

#### Semantic Analysis
- Proximity graph prevents hypothesis redundancy
- OpenAI embeddings calculate semantic similarity
- NetworkX provides graph analysis capabilities

### Known Limitations

1. **API Rate Limits**: Current implementation doesn't optimize for provider limits
2. **Scalability**: Designed for 20-30 hypotheses, scaling requires optimization
3. **Test Coverage**: Limited automated testing currently
4. **Documentation**: Some areas need better documentation

### Comparison with Original Paper

This implementation includes several enhancements beyond the original AI co-scientist paper:

- **Superior State Management**: More robust than paper specification
- **Multi-Model Support**: More flexible than single-model approach
- **Comprehensive Web Interface**: Significant value-add beyond paper
- **Configuration Flexibility**: More adaptable to different use cases

However, it misses some core technical innovations:
- **Test-Time Compute Scaling**: Not implemented
- **Laboratory Integration**: No experimental validation pipeline
- **Domain Specialization**: No deep domain knowledge integration

See `ai-coscientist-comparison-analysis.md` for detailed comparison.

### Contributing

When contributing to this codebase:

1. Follow existing agent patterns and structures
2. Add appropriate type hints and documentation
3. Test with small research goals first
4. Update this file if adding significant new features
5. Consider the comparison with the original paper when making architectural changes

### Support

For questions about development or architecture:
- Check the existing codebase patterns
- Review agent implementations for examples
- Consult the comparison analysis for alignment with original paper
- Use the web interface to understand system behavior