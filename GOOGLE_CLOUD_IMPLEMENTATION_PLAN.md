# 🏗️ Google Cloud Implementation Plan
## Vertex AI + Google ADK Multi-Agent System for Scientific Discovery

### Overview
Leverage Google's enterprise-grade cloud ecosystem to deploy the co-scientist system using Vertex AI for model inference and Google ADK for agent orchestration, providing superior model quality and comprehensive features.

### Architecture Summary

#### Core Components
- **Vertex AI**: Gemini 2.5 Pro/Flash models for LLM inference
- **Google ADK**: Agent Development Kit for orchestration
- **Vertex AI Search**: Google-quality search with web grounding capabilities
- **Vertex AI Vector Search**: Managed vector database for embeddings
- **Cloud Run**: Containerized agent services
- **Cloud Functions**: Serverless task execution
- **Firestore**: Real-time database for state management
- **Cloud Storage**: Object storage for research artifacts
- **Pub/Sub**: Event-driven communication
- **Cloud Scheduler**: Automated experiment execution
- **Artifact Registry**: Container registry
- **Cloud Monitoring**: Observability and logging

#### Frontend Migration
- **React SPA** replacing Streamlit for better integration
- **Material-UI** components for consistent design
- **Real-time updates** via Firestore listeners
- **Firebase Hosting** on built-in domains:
  - `your-project.web.app` (primary)
  - `your-project.firebaseappapp.com` (secondary)
  - No custom domain purchase required

### Cost Analysis

#### Monthly Estimates (1-5 users, occasional usage)
| Service | Free Tier | Estimated Usage | Monthly Cost |
|---------|-----------|-----------------|--------------|
| Vertex AI (Gemini 2.5 Flash) | Free tier available | 10M tokens | $24 |
| Vertex AI (Gemini 2.5 Pro) | Free tier available | 2M tokens | $60 |
| Vertex AI Search | Free tier available | 50k queries | $15 |
| Vertex AI Vector Search | Free tier available | 1M vectors | $5 |
| Cloud Run | 180k vCPU-sec free | 400k vCPU-sec | $12 |
| Cloud Functions | 2M invocations free | 500k invocations | $1 |
| Firestore | 1GB storage + 50k reads | 5GB + 150k reads | $5 |
| Cloud Storage | 5GB free | 50GB + operations | $2 |
| Pub/Sub | 10GB message volume | 20GB messages | $1 |
| Cloud Scheduler | 3 jobs free | 10 jobs | $0.50 |
| Artifact Registry | 0.5GB free | 5GB storage | $1 |
| **Total** | | | **$126.50** |

#### High Usage Scenario (frequent experiments)
| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Vertex AI (Gemini 2.5 Pro) | 50M tokens | $1,500 |
| Vertex AI Search | 500k queries | $150 |
| Vertex AI Vector Search | 10M vectors | $50 |
| Cloud Run | 2M vCPU-sec | $60 |
| Storage & Database | 200GB + high operations | $50 |
| **Total** | | **$1,810** |

### 8-Week Implementation Plan

#### Week 1: Google Cloud Foundation
- Set up Google Cloud project and billing
- Configure APIs (Vertex AI, Cloud Run, Firestore, etc.)
- Create service accounts and IAM roles
- Set up Artifact Registry for container storage
- Configure CI/CD with Cloud Build

#### Week 2: Google ADK Integration & Search Setup
- Install and configure Google ADK
- Create agent definitions using ADK framework
- Set up Vertex AI Search with web grounding for literature research
- Configure Vertex AI Vector Search for hypothesis similarity
- Implement basic agent communication protocols
- Set up Vertex AI client for model inference
- Create development and testing environment

#### Week 3: Core Agent Migration (All 8 Agents)
- Port Literature Review Agent to ADK + Vertex AI Vector Search + external search
- Port Generation Agent with all 10 reasoning approaches to ADK
- Port Reflection Agent with multi-stage verification system
- Port Ranking Agent with ELO tournament system to Cloud Run + Firestore
- Port Evolution Agent with feedback-based refinement
- Port Meta-Review Agent for synthesis across results
- Port Final Report Agent for comprehensive reporting
- Port Supervisor Agent for workflow orchestration
- Port Configuration Agent for system setup
- Implement multi-turn debate system for hypothesis comparison
- Migrate NetworkX proximity graph to Vertex AI Vector Search
- Create agent state management in Firestore
- Implement asynchronous task processing with Pub/Sub
- Add comprehensive error handling and logging

#### Week 4: Multi-turn System & Tournament Implementation
- Implement multi-turn debate system for hypothesis comparison
- Port complete ELO tournament system with ranking logic
- Create hypothesis pairing algorithms based on similarity and rankings
- Implement agent collaboration workflows
- Create tournament bracket management and scheduling
- Add comprehensive experiment monitoring and tracking
- Implement performance metrics and analytics for all agents

#### Week 5: Vector Search & State Management Migration
- Complete Vertex AI Vector Search integration for hypothesis similarity
- Migrate NetworkX proximity graph to vector-based similarity search
- Implement hypothesis deduplication using vector similarity (768-dim embeddings)
- Migrate global state management from pickle to Firestore
- Implement auto-save decorators for state persistence
- Set up Cloud Storage for experiment data and artifacts
- Implement goal-based directory organization in Cloud Storage
- Create data backup and recovery system

#### Week 6: Event-Driven Architecture
- Implement Pub/Sub for agent communication
- Create Cloud Functions for trigger events
- Set up Cloud Scheduler for automated execution
- Implement real-time updates via Firestore listeners
- Add notification system for experiment completion

#### Week 7: Frontend Migration
- Create React SPA with Material-UI
- Implement authentication with Google Identity
- Create experiment monitoring dashboard
- Add real-time updates with Firestore integration
- Implement data visualization components

#### Week 8: Integration & Production Deployment
- Comprehensive system integration testing
- Performance optimization and tuning
- Security audit and compliance checks
- Production deployment with gradual rollout
- Documentation and team training

### Technical Implementation Details

#### Google ADK Agent Configuration
```python
from google.adk import Agent, AgentConfig, LLMConfig

# Literature Review Agent
literature_config = AgentConfig(
    name="literature_review_agent",
    llm=LLMConfig(
        model="gemini-2.5-pro",
        temperature=0.1,
        max_tokens=4096
    ),
    tools=["vertex_ai_search", "google_scholar_search"],
    system_prompt="""You are a literature review agent specializing in scientific research..."""
)

literature_agent = Agent(config=literature_config)
```

#### Vertex AI Integration
```python
from vertexai.generative_models import GenerativeModel, Part
import vertexai

class VertexAIClient:
    def __init__(self, project_id: str, location: str):
        vertexai.init(project=project_id, location=location)
        self.model = GenerativeModel("gemini-2.5-pro")

    async def generate_response(self, prompt: str, context: List[str] = None) -> str:
        contents = [Part.from_text(prompt)]
        if context:
            contents.extend([Part.from_text(c) for c in context])

        response = await self.model.generate_content_async(contents)
        return response.text
```

#### Firestore State Management
```python
from google.cloud import firestore
from datetime import datetime

class ExperimentState:
    def __init__(self, project_id: str):
        self.db = firestore.Client(project=project_id)

    async def save_experiment(self, experiment_id: str, data: dict):
        doc_ref = self.db.collection('experiments').document(experiment_id)
        data['updated_at'] = datetime.utcnow()
        await doc_ref.set(data)

    async def get_experiment(self, experiment_id: str) -> dict:
        doc_ref = self.db.collection('experiments').document(experiment_id)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else None
```

#### Cloud Run Service Definition
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/coscientist/literature-agent', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/coscientist/literature-agent']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args: ['run', 'deploy', 'literature-agent', '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/coscientist/literature-agent', '--region', 'us-central1', '--platform', 'managed']
```

### Migration Strategy

#### Phase 1: Backend Migration (Weeks 1-4)
1. Set up Google Cloud project and services
2. Containerize existing Python agents
3. Integrate with Vertex AI and Google ADK
4. Migrate data storage to Firestore and Cloud Storage
5. Implement agent orchestration with ADK

#### Phase 2: Frontend Migration (Weeks 5-7)
1. Create React SPA to replace Streamlit
2. Implement authentication with Google Identity
3. Migrate visualization components
4. Add real-time capabilities with Firestore
5. Implement responsive design

#### Phase 3: Production Deployment (Week 8)
1. Comprehensive testing and validation
2. Performance optimization
3. Security and compliance
4. Gradual production rollout
5. User training and documentation

### Advantages over Cloudflare Approach

#### Model Quality
- **Superior Models**: Gemini 2.5 Pro provides state-of-the-art reasoning
- **Consistency**: Reliable model performance and availability
- **Multimodal**: Support for text, images, and code
- **Fine-tuning**: Options for domain-specific customization

#### Enterprise Features
- **Scalability**: Auto-scaling with high throughput
- **Security**: Enterprise-grade security and compliance
- **Monitoring**: Comprehensive observability and logging
- **Support**: Professional technical support
- **SLA**: Service level agreements for production workloads

#### Development Experience
- **Python Native**: No language migration required
- **Rich SDKs**: Comprehensive Google Cloud client libraries
- **Development Tools**: Integrated development environment
- **Testing**: Built-in testing and simulation tools

### Deployment Architecture

#### Microservices Structure
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Literature    │    │   Generation    │    │   Reflection    │
│     Agent       │    │     Agent       │    │     Agent       │
│   (Cloud Run)   │    │   (Cloud Run)   │    │   (Cloud Run)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Google ADK    │
                    │ Orchestration   │
                    │                 │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │    Vertex AI    │
                    │   (Gemini Pro)  │
                    └─────────────────┘
```

#### Data Flow
1. **User Request** → React Frontend
2. **API Gateway** → Cloud Functions (authentication)
3. **Orchestration** → Google ADK
4. **Agent Execution** → Cloud Run services
5. **Model Inference** → Vertex AI
6. **State Management** → Firestore
7. **Results Storage** → Cloud Storage
8. **Real-time Updates** → Firestore listeners

### Monitoring & Observability

#### Metrics Collection
```python
from google.cloud import monitoring_v3

class MetricsCollector:
    def __init__(self, project_id: str):
        self.client = monitoring_v3.MetricServiceClient()
        self.project_name = f"projects/{project_id}"

    def record_agent_execution(self, agent_name: str, duration: float, success: bool):
        series = monitoring_v3.TimeSeries()
        # Configure metric series
        self.client.create_time_series(name=self.project_name, time_series=[series])
```

#### Logging Strategy
- **Structured Logging**: JSON format with consistent fields
- **Correlation IDs**: Track requests across services
- **Log Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Log Aggregation**: Cloud Logging with filters and alerts
- **Performance Metrics**: Latency, throughput, error rates

### Security & Compliance

#### Authentication & Authorization
- **Google Identity**: OAuth 2.0 with Google accounts
- **Service Accounts**: Secure service-to-service communication
- **IAM Roles**: Principle of least privilege
- **API Keys**: Secure key management and rotation

#### Data Protection
- **Encryption at Rest**: Automatic with Google Cloud Storage
- **Encryption in Transit**: TLS 1.3 for all communications
- **Data Residency**: Configurable geographic regions
- **Access Controls**: Fine-grained permissions

#### Compliance Considerations
- **SOC 2**: Security and availability controls
- **GDPR**: Data protection and privacy
- **HIPAA**: Healthcare data protection (if applicable)
- **Data Retention**: Configurable retention policies

### Native Google Cloud Integrations

#### Vertex AI Search Integration (Replacing GPT Researcher)
```python
from vertexai.generative_models import GenerativeModel, Tool
from vertexai.preview.generative_models import grounding

class LiteratureSearchClient:
    def __init__(self, project_id: str, location: str):
        vertexai.init(project=project_id, location=location)
        self.model = GenerativeModel("gemini-2.5-pro")

        # Configure search with web grounding
        self.search_tool = Tool.from_google_search_retrieval(
            google_search_retrieval=grounding.GoogleSearchRetrieval(
                dynamic_retrieval_config=grounding.DynamicRetrievalConfig(
                    mode=grounding.Mode.MODE_DYNAMIC,
                    dynamic_threshold=0.3
                )
            )
        )

    async def research_topic(self, topic: str, max_subtopics: int = 3) -> dict:
        prompt = f"""
        Research this scientific topic comprehensively: {topic}
        Provide:
        1. Overview of current state of research
        2. Key findings and breakthroughs
        3. Research gaps and opportunities
        4. Recent publications and papers
        5. Future research directions

        Format as structured research report with citations.
        """

        response = await self.model.generate_content_async(
            prompt,
            tools=[self.search_tool]
        )
        return response.text
```

#### Vertex AI Vector Search Integration (Replacing OpenAI Embeddings)
```python
from vertexai.language_models import TextEmbeddingModel
from vertexai.vision_model_garden_service import VisionModelGardenServiceClient
from google.cloud import aiplatform
import numpy as np

class VectorSearchManager:
    def __init__(self, project_id: str, location: str, index_endpoint_id: str):
        aiplatform.init(project=project_id, location=location)
        self.client = VisionModelGardenServiceClient()
        self.index_endpoint_id = index_endpoint_id
        # Use textembedding-gecko (768 dimensions)
        self.embedding_model = TextEmbeddingModel.from_pretrained("textembedding-gecko@003")

    def create_embedding(self, text: str) -> np.ndarray:
        """Create embeddings using Vertex AI textembedding-gecko (768 dimensions)"""
        embeddings = self.embedding_model.get_embeddings([text])
        return np.array(embeddings[0].values)  # 768-dimensional vector

    def upsert_hypothesis(self, hypothesis_id: str, text: str, metadata: dict):
        """Add/update hypothesis in vector index"""
        embedding = self.create_embedding(text)

        # Update vector index with restrictions
        datapoint = {
            "datapoint_id": hypothesis_id,
            "feature_vector": embedding.tolist(),
            "restricts": [{"namespace": "hypothesis", "allow_list": [hypothesis_id]}],
            "crowding_tag": hash(text) % 1000  # Prevent overcrowding
        }

        # Index the datapoint
        self.client.upsert_datapoints(
            index_endpoint=self.index_endpoint_id,
            datapoints=[datapoint]
        )

    def find_similar_hypotheses(self, query_text: str, similarity_threshold: float = 0.8, num_neighbors: int = 10):
        """Find similar hypotheses using vector similarity"""
        query_embedding = self.create_embedding(query_text)

        # Search for similar vectors
        response = self.client.find_neighbors(
            index_endpoint=self.index_endpoint_id,
            queries=[{
                "datapoint_id": "",
                "feature_vector": query_embedding.tolist(),
                "neighbor_count": num_neighbors
            }]
        )

        # Filter by similarity threshold
        neighbors = response.nearest_neighbors[0] if response.nearest_neighbors else []
        return [n for n in neighbors if n.distance <= (1 - similarity_threshold)]

    def build_proximity_graph(self, hypotheses: list, similarity_threshold: float = 0.8):
        """Build proximity graph similar to NetworkX implementation"""
        edges = []
        for i, hyp1 in enumerate(hypotheses):
            for j, hyp2 in enumerate(hypotheses[i+1:], i+1):
                similar_hypotheses = self.find_similar_hypotheses(hyp1.hypothesis, similarity_threshold, 1)
                for similar in similar_hypotheses:
                    if similar.datapoint_id == hyp2.uid:
                        edges.append((hyp1.uid, hyp2.uid, 1 - similar.distance))
                        break
        return edges
```

#### GPT Researcher Migration Strategy
The current `gpt-researcher` dependency will be replaced with:

1. **Vertex AI Search + Web Grounding**: For web search and source retrieval
2. **Custom Search Implementation**: For academic paper discovery
3. **Vertex AI Vector Search**: For source clustering and organization
4. **Google Custom Search API**: Fallback for specialized academic searches

```python
class GCPLiteratureResearcher:
    """Replaces GPT Researcher with native Google Cloud services"""

    def __init__(self, project_id: str, location: str):
        self.search_client = LiteratureSearchClient(project_id, location)
        self.vector_manager = VectorSearchManager(project_id, location, "index_endpoint_id")

    async def conduct_research(self, query: str, max_subtopics: int = 3) -> dict:
        # 1. Decompose topic into subtopics (using Gemini)
        subtopics = await self._decompose_topic(query, max_subtopics)

        # 2. Research each subtopic in parallel
        research_tasks = [self.search_client.research_topic(topic) for topic in subtopics]
        research_results = await asyncio.gather(*research_tasks)

        # 3. Synthesize results and store in vector search for future reference
        synthesis = await self._synthesize_research(subtopics, research_results)

        # 4. Store for similarity search
        self.vector_manager.upsert_hypothesis(f"research_{query}", synthesis)

        return {
            "topic": query,
            "subtopics": subtopics,
            "research": research_results,
            "synthesis": synthesis
        }
```

#### Configuration Migration
```python
# Replace researcher_config.json with Cloud-native configuration
GCP_RESEARCHER_CONFIG = {
    "VERTEX_AI_SEARCH": {
        "model": "gemini-2.5-pro",
        "temperature": 0.4,
        "max_tokens": 8192,
        "grounding_mode": "MODE_DYNAMIC",
        "grounding_threshold": 0.3
    },
    "VECTOR_SEARCH": {
        "embedding_model": "textembedding-gecko@003",
        "dimensions": 768,
        "similarity_metric": "DOT_PRODUCT_DISTANCE",
        "approximate_neighbor_count": 150
    },
    "STORAGE": {
        "bucket_name": "coscientist-research-data",
        "backup_retention_days": 90
    },
    "SEARCH_LIMITS": {
        "max_subtopics": 3,
        "max_search_results_per_query": 10,
        "concurrent_searches": 4
    }
}
```

### Testing Framework Strategy

#### Business Logic Testing (Python)
```python
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock

class TestTournamentSystem:
    def test_elo_calculations(self):
        """Test ELO rating calculations maintain mathematical properties"""
        from coscientist.ranking_agent import update_elo

        initial_winner, initial_loser = 1500, 1400
        new_winner, new_loser = update_elo(initial_winner, initial_loser)

        # Conservation of total rating points
        assert new_winner + new_loser == initial_winner + initial_loser
        # Winner's rating should increase
        assert new_winner > initial_winner
        # Loser's rating should decrease
        assert new_loser < initial_loser

    @pytest.mark.asyncio
    async def test_hypothesis_similarity_search(self):
        """Test vector similarity search functionality"""
        from gcp.coscientist.vector_search_manager import VectorSearchManager

        manager = Mock(spec=VectorSearchManager)
        embedding = [0.1, 0.2, 0.3] * 256  # 768-dim embedding

        # Test similarity threshold filtering
        manager.find_similar_hypotheses.return_value = [
            {"id": "hyp1", "score": 0.95, "metadata": {}},
            {"id": "hyp2", "score": 0.85, "metadata": {}},
            {"id": "hyp3", "score": 0.65, "metadata": {}}  # Below 0.7 threshold
        ]

        similar = await manager.find_similar_hypotheses(embedding, 0.7, 10)
        assert len(similar) == 2  # Only high-similarity matches
        assert all(result["score"] >= 0.7 for result in similar)

    def test_tournament_scheduling(self):
        """Test tournament bracket creation and pairing"""
        from gcp.coscientist.tournament_manager import TournamentManager

        manager = TournamentManager()
        hypotheses = [f"hyp_{i}" for i in range(8)]  # 8 hypotheses

        matches = manager.create_tournament_round(hypotheses)
        assert len(matches) == 4  # 8 hypotheses -> 4 matches
        assert all(len(match) == 2 for match in matches)

        # Ensure no hypothesis appears more than once
        all_hypotheses = [h for match in matches for h in match]
        assert len(all_hypotheses) == len(set(all_hypotheses))
```

#### Output Quality Testing Framework
```python
from typing import Dict, List
import numpy as np
from google.cloud import aiplatform

class OutputQualityEvaluator:
    """Automated evaluation system for AI-generated outputs"""

    def __init__(self, model_name: str = "gemini-2.5-pro"):
        self.model = aiplatform.gapic.ModelServiceClient()
        self.model_name = model_name
        self.evaluation_criteria = {
            'coherence': 0.8,      # Logical consistency
            'relevance': 0.85,     # Alignment with research goal
            'novelty': 0.7,        # Originality and innovation
            'feasibility': 0.75,   # Practical implementability
            'clarity': 0.8         # Communication quality
        }

    async def evaluate_hypothesis(self, hypothesis: ParsedHypothesis, context: str) -> Dict:
        """Evaluate hypothesis quality across multiple dimensions"""
        prompt = f"""
        Evaluate this scientific hypothesis on multiple dimensions (0-1 scale):

        Hypothesis: "{hypothesis.hypothesis}"
        Predictions: {hypothesis.predictions}
        Assumptions: {hypothesis.assumptions}
        Research Context: {context}

        Provide scores for:
        1. Coherence (logical consistency, internal logic)
        2. Relevance (alignment with research context and goals)
        3. Novelty (originality, innovative aspects)
        4. Feasibility (practical implementation possibility)
        5. Clarity (clear communication, unambiguous language)

        Format as JSON with scores and brief justification for each dimension.
        """

        response = await self._generate_evaluation(prompt)
        return self._parse_evaluation_response(response)

    async def batch_evaluate_research_quality(self, research_outputs: List[Dict]) -> Dict:
        """Batch evaluation for research outputs with comparative analysis"""
        evaluations = []

        for output in research_outputs:
            evaluation = {
                'output_id': output['id'],
                'scores': await self.evaluate_research_output(output),
                'length': len(output.get('content', '')),
                'citation_count': len(output.get('citations', []))
            }
            evaluations.append(evaluation)

        # Comparative analysis
        quality_distribution = self._analyze_quality_distribution(evaluations)
        comparative_ranking = self._rank_by_quality(evaluations)

        return {
            'individual_evaluations': evaluations,
            'quality_distribution': quality_distribution,
            'comparative_ranking': comparative_ranking,
            'recommendations': self._generate_improvement_recommendations(evaluations)
        }

    def _analyze_quality_distribution(self, evaluations: List[Dict]) -> Dict:
        """Analyze distribution of quality scores across batch"""
        metrics = {}

        for criterion in self.evaluation_criteria.keys():
            scores = [eval['scores'][criterion] for eval in evaluations]
            metrics[criterion] = {
                'mean': np.mean(scores),
                'std': np.std(scores),
                'min': np.min(scores),
                'max': np.max(scores),
                'quartiles': np.percentile(scores, [25, 50, 75])
            }

        return metrics
```

#### Integration Testing Framework
```python
import pytest
from google.cloud import firestore
from testcontainers.compose import DockerCompose

class TestCompleteWorkflow:
    """End-to-end integration tests for the complete research workflow"""

    @pytest.fixture(scope="class")
    def gcp_environment(self):
        """Set up test GCP environment using Docker containers"""
        with DockerCompose("../docker", compose_file_name="gcp-test.yml") as compose:
            # Wait for services to be ready
            firestore_port = compose.get_service_port("firestore-emulator", 8080)
            emulator_host = f"localhost:{firestore_port}"

            yield {
                'firestore_host': emulator_host,
                'project_id': 'test-project'
            }

    @pytest.mark.asyncio
    async def test_literature_review_pipeline(self, gcp_environment):
        """Test complete literature review workflow"""
        from gcp.coscientist.literature_researcher import GCPLiteratureResearcher

        researcher = GCPLiteratureResearcher(
            project_id=gcp_environment['project_id'],
            location='us-central1'
        )

        result = await researcher.conduct_research(
            "machine learning applications in drug discovery",
            max_subtopics=3
        )

        # Validate structure
        assert 'topic' in result
        assert 'subtopics' in result
        assert 'research' in result
        assert 'synthesis' in result

        # Validate content quality
        assert len(result['subtopics']) == 3
        assert len(result['research']) == 3
        assert len(result['synthesis']) > 500  # Substantial synthesis
        assert 'key findings' in result['synthesis'].lower()

    @pytest.mark.asyncio
    async def test_tournament_completion_workflow(self, gcp_environment):
        """Test complete tournament workflow from generation to ranking"""
        # Generate hypotheses
        hypotheses = await self._generate_test_hypotheses(10)

        # Run tournament
        tournament = self._setup_tournament(gcp_environment)
        final_rankings = await tournament.run_complete_tournament(hypotheses)

        # Validate tournament results
        assert len(final_rankings) == 10
        assert final_rankings[0]['elo'] > final_rankings[-1]['elo']

        # Validate tournament properties
        elo_scores = [h['elo'] for h in final_rankings]
        assert sum(elo_scores) == 10 * 1500  # Conservation of total ELO

        # Test hypothesis quality
        quality_evaluator = OutputQualityEvaluator()
        quality_scores = await quality_evaluator.batch_evaluate_research_quality(final_rankings)
        assert quality_scores['quality_distribution']['coherence']['mean'] > 0.7

    def _setup_tournament(self, gcp_environment):
        """Set up tournament infrastructure for testing"""
        from gcp.coscientist.tournament_manager import TournamentManager

        return TournamentManager(
            firestore_client=firestore.Client(project=gcp_environment['project_id']),
            vector_search_client=self._mock_vector_search()
        )
```

#### Performance Monitoring & Benchmarking
```python
import time
import psutil
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class PerformanceMetrics:
    agent_name: str
    operation: str
    duration_ms: float
    memory_usage_mb: float
    cpu_usage_percent: float
    success: bool
    error_message: Optional[str] = None
    tokens_processed: Optional[int] = None
    input_length: Optional[int] = None

class PerformanceMonitor:
    """Comprehensive performance monitoring for agent operations"""

    def __init__(self):
        self.metrics: List[PerformanceMetrics] = []
        self.logger = logging.getLogger(__name__)

        # Performance thresholds
        self.thresholds = {
            'max_response_time_ms': 30000,  # 30 seconds
            'max_memory_usage_mb': 2048,     # 2GB
            'max_cpu_usage_percent': 80.0    # 80%
        }

    async def monitor_agent_operation(
        self,
        agent_name: str,
        operation: str,
        func: callable
    ) -> any:
        """Monitor an agent operation and collect performance metrics"""
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        start_cpu = psutil.cpu_percent()

        try:
            result = await func()

            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            duration_ms = (end_time - start_time) * 1000
            memory_delta = end_memory - start_memory

            metrics = PerformanceMetrics(
                agent_name=agent_name,
                operation=operation,
                duration_ms=duration_ms,
                memory_usage_mb=end_memory,
                cpu_usage_percent=psutil.cpu_percent(),
                success=True,
                input_length=len(str(func.args)) if func.args else 0
            )

            # Check performance thresholds
            if duration_ms > self.thresholds['max_response_time_ms']:
                self.logger.warning(
                    f"Slow response detected: {agent_name}.{operation} took {duration_ms:.2f}ms"
                )

            if memory_delta > self.thresholds['max_memory_usage_mb']:
                self.logger.warning(
                    f"High memory usage: {agent_name}.{operation} used {memory_delta:.2f}MB"
                )

        except Exception as e:
            metrics = PerformanceMetrics(
                agent_name=agent_name,
                operation=operation,
                duration_ms=(time.time() - start_time) * 1000,
                memory_usage_mb=psutil.Process().memory_info().rss / 1024 / 1024,
                cpu_usage_percent=psutil.cpu_percent(),
                success=False,
                error_message=str(e)
            )
            self.logger.error(f"Operation failed: {agent_name}.{operation}: {e}")
            raise

        self.metrics.append(metrics)
        return result

    def get_performance_summary(self, agent_name: Optional[str] = None) -> Dict:
        """Get performance summary for specific agent or all agents"""
        filtered_metrics = self.metrics
        if agent_name:
            filtered_metrics = [m for m in self.metrics if m.agent_name == agent_name]

        if not filtered_metrics:
            return {}

        summary = {
            'total_operations': len(filtered_metrics),
            'success_rate': sum(1 for m in filtered_metrics if m.success) / len(filtered_metrics),
            'avg_response_time_ms': np.mean([m.duration_ms for m in filtered_metrics]),
            'avg_memory_usage_mb': np.mean([m.memory_usage_mb for m in filtered_metrics]),
            'operations_per_agent': {}
        }

        # Per-agent breakdown
        for agent in set(m.agent_name for m in filtered_metrics):
            agent_metrics = [m for m in filtered_metrics if m.agent_name == agent]
            summary['operations_per_agent'][agent] = {
                'count': len(agent_metrics),
                'success_rate': sum(1 for m in agent_metrics if m.success) / len(agent_metrics),
                'avg_response_time': np.mean([m.duration_ms for m in agent_metrics]),
                'avg_memory_usage': np.mean([m.memory_usage_mb for m in agent_metrics])
            }

        return summary

# Usage example in agent classes
class LiteratureReviewAgent:
    def __init__(self):
        self.performance_monitor = PerformanceMonitor()

    async def conduct_literature_review(self, query: str) -> Dict:
        return await self.performance_monitor.monitor_agent_operation(
            agent_name="literature_review",
            operation="conduct_review",
            func=self._actually_conduct_review(query)
        )
```

### Continuous Integration & Testing Pipeline
```yaml
# .github/workflows/test-gcp.yml
name: GCP Integration Tests

on: [push, pull_request]

jobs:
  test-business-logic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run unit tests
        run: pytest tests/unit/ -v --cov=gcp.coscientist --cov-report=xml

      - name: Run integration tests
        run: pytest tests/integration/ -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  test-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup GCP Emulators
        run: |
          docker-compose -f docker/gcp-test.yml up -d
          sleep 10  # Wait for emulators to start

      - name: Run performance benchmarks
        run: |
          python -m pytest tests/performance/ -v --benchmark-json=benchmark.json

      - name: Analyze performance regression
        run: |
          python scripts/analyze_performance.py benchmark.json
```

### Extensibility Framework for APIs & MCPs

#### Plugin Architecture for Data Sources
```python
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import json
from dataclasses import dataclass

@dataclass
class DataSourceConfig:
    """Configuration for external data sources"""
    name: str
    type: str  # 'api', 'mcp', 'database', 'file', etc.
    endpoint: Optional[str] = None
    authentication: Optional[Dict] = None
    rate_limit: Optional[Dict] = None
    retry_config: Optional[Dict] = None
    custom_parameters: Optional[Dict] = None

class DataSourcePlugin(ABC):
    """Abstract base class for data source plugins"""

    def __init__(self, config: DataSourceConfig):
        self.config = config
        self.name = config.name

    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to data source"""
        pass

    @abstractmethod
    async def search(self, query: str, **kwargs) -> List[Dict]:
        """Search for relevant data"""
        pass

    @abstractmethod
    async def get_metadata(self) -> Dict:
        """Get metadata about the data source"""
        pass

    async def validate_connection(self) -> bool:
        """Validate connection health"""
        try:
            return await self.connect()
        except Exception as e:
            logging.error(f"Connection validation failed for {self.name}: {e}")
            return False

class MCPClient(DataSourcePlugin):
    """Model Context Protocol client implementation"""

    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.server_url = config.endpoint
        self.auth_headers = config.authentication or {}

    async def connect(self) -> bool:
        """Connect to MCP server"""
        try:
            # MCP connection handshake
            response = await self._make_request('initialize', {
                'protocolVersion': '2024-11-05',
                'capabilities': {'tools': {}},
                'clientInfo': {'name': 'coscientist', 'version': '1.0.0'}
            })
            return response.get('status') == 'success'
        except Exception as e:
            logging.error(f"MCP connection failed: {e}")
            return False

    async def list_available_tools(self) -> List[Dict]:
        """List available MCP tools"""
        response = await self._make_request('tools/list')
        return response.get('tools', [])

    async def use_tool(self, tool_name: str, arguments: Dict) -> Dict:
        """Execute MCP tool"""
        response = await self._make_request('tools/call', {
            'name': tool_name,
            'arguments': arguments
        })
        return response

    async def search(self, query: str, **kwargs) -> List[Dict]:
        """Search using MCP tools"""
        tools = await self.list_available_tools()
        search_tools = [t for t in tools if 'search' in t.get('name', '').lower()]

        results = []
        for tool in search_tools:
            try:
                result = await self.use_tool(tool['name'], {'query': query, **kwargs})
                results.append({
                    'source': f"mcp:{self.name}:{tool['name']}",
                    'data': result,
                    'tool_name': tool['name']
                })
            except Exception as e:
                logging.warning(f"MCP tool {tool['name']} failed: {e}")

        return results

class APIClient(DataSourcePlugin):
    """Generic API client for REST endpoints"""

    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.base_url = config.endpoint
        self.auth = config.authentication or {}
        self.rate_limit = config.rate_limit or {'requests_per_second': 10}

    async def connect(self) -> bool:
        """Test API connectivity"""
        try:
            async with aiohttp.ClientSession() as session:
                headers = self._build_headers()
                async with session.get(f"{self.base_url}/health", headers=headers) as response:
                    return response.status == 200
        except Exception:
            return False

    async def search(self, query: str, **kwargs) -> List[Dict]:
        """Search via API"""
        search_endpoint = self.config.custom_parameters.get('search_endpoint', '/search')
        url = f"{self.base_url}{search_endpoint}"

        params = {'q': query, **kwargs}
        headers = self._build_headers()

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._format_api_response(data)
                else:
                    raise Exception(f"API search failed: {response.status}")

    def _build_headers(self) -> Dict:
        """Build request headers with authentication"""
        headers = {'Content-Type': 'application/json'}

        if 'api_key' in self.auth:
            headers['Authorization'] = f"Bearer {self.auth['api_key']}"
        elif 'basic_auth' in self.auth:
            import base64
            credentials = base64.b64encode(
                f"{self.auth['basic_auth']['username']}:{self.auth['basic_auth']['password']}"
                .encode()
            ).decode()
            headers['Authorization'] = f"Basic {credentials}"

        return headers
```

#### Plugin Registry and Manager
```python
class DataSourceRegistry:
    """Registry for managing data source plugins"""

    def __init__(self):
        self.plugins: Dict[str, DataSourcePlugin] = {}
        self.plugin_configs: Dict[str, DataSourceConfig] = {}

    def register_plugin(self, plugin: DataSourcePlugin):
        """Register a new data source plugin"""
        self.plugins[plugin.name] = plugin
        logging.info(f"Registered data source plugin: {plugin.name}")

    def get_plugin(self, name: str) -> Optional[DataSourcePlugin]:
        """Get plugin by name"""
        return self.plugins.get(name)

    async def load_plugins_from_config(self, config_path: str):
        """Load plugins from configuration file"""
        with open(config_path, 'r') as f:
            config = json.load(f)

        for source_config in config.get('data_sources', []):
            plugin_config = DataSourceConfig(**source_config)
            plugin = self._create_plugin(plugin_config)
            await plugin.connect()
            self.register_plugin(plugin)

    def _create_plugin(self, config: DataSourceConfig) -> DataSourcePlugin:
        """Factory method to create plugin based on type"""
        plugin_classes = {
            'mcp': MCPClient,
            'api': APIClient,
            'database': DatabaseClient,  # Placeholder
            'file': FileClient          # Placeholder
        }

        plugin_class = plugin_classes.get(config.type)
        if not plugin_class:
            raise ValueError(f"Unsupported data source type: {config.type}")

        return plugin_class(config)

class MultiSourceSearchEngine:
    """Orchestrate search across multiple data sources"""

    def __init__(self, registry: DataSourceRegistry):
        self.registry = registry

    async def search_all_sources(
        self,
        query: str,
        sources: Optional[List[str]] = None,
        max_results_per_source: int = 10
    ) -> Dict[str, List[Dict]]:
        """Search across all or specified data sources"""
        if sources is None:
            sources = list(self.registry.plugins.keys())

        search_tasks = {}
        for source_name in sources:
            plugin = self.registry.get_plugin(source_name)
            if plugin and await plugin.validate_connection():
                search_tasks[source_name] = plugin.search(query, limit=max_results_per_source)

        # Execute searches in parallel
        results = {}
        if search_tasks:
            completed = await asyncio.gather(*search_tasks.values(), return_exceptions=True)

            for i, (source_name, task) in enumerate(search_tasks.items()):
                result = completed[i]
                if isinstance(result, Exception):
                    logging.error(f"Search failed for {source_name}: {result}")
                    results[source_name] = []
                else:
                    results[source_name] = result[:max_results_per_source]

        return results

    async def get_comprehensive_results(self, query: str) -> Dict:
        """Get comprehensive search results with ranking and deduplication"""
        raw_results = await self.search_all_sources(query)

        # Flatten and rank results
        all_results = []
        for source, source_results in raw_results.items():
            for result in source_results:
                result['_source'] = source
                all_results.append(result)

        # Rank by relevance (simple implementation)
        ranked_results = self._rank_results(all_results, query)

        # Deduplicate based on content similarity
        deduplicated_results = self._deduplicate_results(ranked_results)

        return {
            'query': query,
            'total_results': len(deduplicated_results),
            'results': deduplicated_results,
            'sources_used': list(raw_results.keys()),
            'source_counts': {k: len(v) for k, v in raw_results.items()}
        }

    def _rank_results(self, results: List[Dict], query: str) -> List[Dict]:
        """Rank results by relevance to query"""
        # Simple keyword-based ranking (can be enhanced with embeddings)
        query_terms = query.lower().split()

        for result in results:
            content = str(result).lower()
            score = sum(1 for term in query_terms if term in content)
            result['_relevance_score'] = score / len(query_terms)

        return sorted(results, key=lambda x: x['_relevance_score'], reverse=True)

    def _deduplicate_results(self, results: List[Dict], threshold: float = 0.8) -> List[Dict]:
        """Remove duplicate results based on similarity"""
        deduplicated = []
        seen_contents = []

        for result in results:
            content = str(result)
            is_duplicate = False

            for seen in seen_contents:
                # Simple string similarity (can be enhanced with embeddings)
                similarity = self._text_similarity(content, seen)
                if similarity > threshold:
                    is_duplicate = True
                    break

            if not is_duplicate:
                deduplicated.append(result)
                seen_contents.append(content)

        return deduplicated

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        return len(intersection) / len(union) if union else 0
```

#### Configuration Example
```json
{
  "data_sources": [
    {
      "name": "arxiv_api",
      "type": "api",
      "endpoint": "http://export.arxiv.org/api/query",
      "authentication": {},
      "rate_limit": {"requests_per_second": 5},
      "custom_parameters": {
        "search_endpoint": "",
        "response_format": "xml"
      }
    },
    {
      "name": "github_search",
      "type": "mcp",
      "endpoint": "ws://localhost:3001",
      "authentication": {
        "api_key": "github_pat_xxx"
      },
      "custom_parameters": {
        "tools": ["search_repositories", "search_code"]
      }
    },
    {
      "name": "semantic_scholar",
      "type": "api",
      "endpoint": "https://api.semanticscholar.org/graph/v1",
      "authentication": {
        "api_key": "semantic_key_xxx"
      },
      "rate_limit": {"requests_per_second": 10}
    }
  ]
}
```

This Google Cloud implementation provides enterprise-grade reliability, superior model quality, comprehensive features, a robust testing framework, and a flexible extensibility system for integrating additional data sources, APIs, and MCPs.