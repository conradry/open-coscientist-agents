# 🚀 Cloudflare Workers Implementation Plan
## Sous Chef: Serverless AI Research Assistant

### Overview
**Sous Chef - Let your AI handle the prep while you focus on the science.**

Transform the intelligent research assistant into a fully serverless architecture on Cloudflare's ecosystem. The Sous Chef platform minimizes costs while delivering powerful research capabilities - handling literature review, hypothesis generation, and analysis so researchers can focus on breakthrough discoveries.

### Architecture Summary

#### Core Components
- **Cloudflare Workers**: Serverless compute for agent orchestration
- **Workers AI**: LLM inference using Llama 3.1 8B/70B models + embedding models
- **Cloudflare Vectorize**: Vector database for hypothesis similarity and search
- **Cloudflare R2**: Object storage for research data and results
- **Cloudflare KV**: Key-value storage for configuration and caching
- **Cloudflare Durable Objects**: Stateful coordination for long-running experiments
- **Cloudflare Queues**: Asynchronous task processing
- **Cloudflare Cron Triggers**: Scheduled experiment execution
- **External Search**: Tavily API for web research (no native search available)

#### Frontend: Modern Sous Chef Interface
- **React SPA** with Vite and modern design system on Cloudflare Pages
- **Real-time updates** via WebSockets using Durable Objects
- **Mobile-first responsive design** optimized for research workflows
- **Clean, scientific aesthetic** with subtle culinary elements
- **Progressive Web App** capabilities for mobile researchers
- **Built-in domain**: `sous-chef-research.pages.dev` (no custom domain purchase required)

#### Visual Design System
- **Color Palette**: Laboratory whites, scientific grays, with fresh herb green accent
- **Typography**: Clean, readable fonts optimized for scientific content
- **Mobile-optimized**: Touch-friendly controls and streamlined navigation
- **Data Visualization**: Clear, interactive charts for research insights

### Cost Analysis

#### Monthly Estimates (1-5 users, occasional usage)
| Service | Free Tier | Estimated Usage | Monthly Cost |
|---------|-----------|-----------------|--------------|
| Workers | 100k requests/day | 150k requests | $0.50 |
| Workers AI | 10k requests/day | 50k requests | $15-50 |
| Vectorize | 1M vectors free | 2M vectors | $5 |
| R2 Storage | 10GB + 1M Class A | 50GB + 2M operations | $5 |
| KV Storage | 100k reads/day | 150k reads | $0.50 |
| Durable Objects | 400k GB-secs | 600k GB-secs | $2 |
| Queues | 1M messages | 500k messages | $0.50 |
| Tavily API | 1k requests free | 5k requests | $10 |
| Pages | Unlimited | Static hosting | $0 |
| **Total** | | | **$38.50-73.50** |

#### High Usage Scenario (frequent experiments)
| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Workers AI | 500k requests | $150-500 |
| Vectorize | 10M vectors | $50 |
| Tavily API | 50k requests | $100 |
| R2 Storage | 200GB + 5M operations | $20 |
| Compute | 2M worker invocations | $10 |
| **Total** | | **$330-680** |

### 8-Week Implementation Plan

#### Week 1: Foundation Setup
- Create Cloudflare Workers project structure
- Set up TypeScript configuration and build pipeline
- Implement basic authentication and user management
- Create R2 buckets for data storage
- Set up development and deployment scripts

#### Week 2: Core Agent Framework
- Port agent interfaces to TypeScript
- Implement Workers AI client for LLM inference
- Set up Vectorize for hypothesis similarity tracking
- Create basic agent orchestration logic
- Implement Durable Objects for state management
- Set up KV storage for configuration

#### Week 3: Agent Implementation (All 8 Agents)
- Port Literature Review Agent to Workers AI + Tavily search
- Port Generation Agent with all 10 reasoning approaches to Workers AI
- Port Reflection Agent with multi-stage verification system
- Port Ranking Agent with ELO tournament to Workers + Durable Objects
- Port Evolution Agent with feedback-based refinement
- Port Meta-Review Agent for synthesis across results
- Port Final Report Agent for comprehensive reporting
- Port Supervisor Agent for workflow orchestration
- Port Configuration Agent for system setup
- Replace GPT Researcher with Tavily API + Workers AI processing
- Migrate embeddings to Workers AI BGE models + Vectorize
- Implement multi-turn debate system for hypothesis comparison
- Implement result caching in KV storage
- Add error handling and retry logic

#### Week 4: Multi-turn System & Tournament Implementation
- Implement multi-turn debate system for hypothesis comparison
- Port complete ELO tournament system with ranking logic to Workers + Durable Objects
- Create hypothesis pairing algorithms based on Vectorize similarity
- Implement agent communication protocols via Workers
- Implement asynchronous task processing with Queues
- Create tournament bracket management and scheduling
- Add comprehensive experiment monitoring and logging

#### Week 5: Vector Search & State Management Migration
- Complete Vectorize integration for hypothesis similarity (BGE models)
- Migrate NetworkX proximity graph to Vectorize vector-based search
- Implement hypothesis deduplication using vector similarity (384/768/1024-dim)
- Migrate global state management from pickle to Durable Objects
- Implement auto-save decorators for state persistence in Durable Objects
- Set up R2 storage for experiment data and artifacts
- Implement goal-based organization in R2 storage
- Create data backup and recovery system

#### Week 6: Storage & Data Management
- Implement R2 client for file operations
- Create data backup and recovery systems
- Implement semantic search using Vectorize + Workers AI embeddings
- Create data export/import functionality
- Add data retention policies

#### Week 7: Sous Chef Frontend Development
- Create React SPA with Vite and modern design system
- Implement mobile-first responsive design for research workflows
- Design clean, intuitive Sous Chef interface
- Create components for experiment monitoring with real-time updates
- Add WebSocket connections for live research progress
- Implement authentication and user preferences
- Optimize for mobile researchers with PWA features
- Design hypothesis tournament visualization
- Create touch-friendly data visualization components

#### Week 8: Integration & Testing
- Integrate all components and workflows
- Implement comprehensive error handling
- Add monitoring and analytics
- Perform load testing and optimization
- Deploy to production and document

### Technical Implementation Details

#### Workers AI Integration
```typescript
// Worker for LLM inference
export default {
  async fetch(request, env, ctx) {
    const { prompt, model } = await request.json();

    const response = await env.AI.run(model, {
      prompt,
      max_tokens: 2048,
      temperature: 0.7
    });

    return Response.json(response);
  }
};
```

#### Durable Object for Experiment State
```typescript
export class ExperimentManager {
  constructor(state, env) {
    this.state = state;
    this.experiments = new Map();
  }

  async startExperiment(config) {
    const experiment = {
      id: crypto.randomUUID(),
      status: 'running',
      config,
      results: {},
      createdAt: Date.now()
    };

    this.experiments.set(experiment.id, experiment);
    await this.state.storage.put(experiment.id, experiment);

    return experiment;
  }
}
```

#### Tournament ELO System
```typescript
export class TournamentManager {
  updateElo(winnerRating: number, loserRating: number): [number, number] {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

    const newWinnerRating = winnerRating + K * (1 - expectedScore);
    const newLoserRating = loserRating + K * (0 - (1 - expectedScore));

    return [Math.round(newWinnerRating), Math.round(newLoserRating)];
  }
}
```

### Migration Strategy

#### Data Migration
1. Export existing experiment data from local files
2. Convert to Cloudflare R2 compatible format
3. Import to R2 buckets using migration scripts
4. Validate data integrity

#### Configuration Migration
1. Extract environment variables and settings
2. Convert to Workers environment variables
3. Update API endpoints to Workers URLs
4. Test configuration validation

### Limitations & Considerations

#### Model Quality
- Llama 3.1 70B vs GPT-4/Claude quality differences
- May need prompt engineering for optimal results
- Consider hybrid approach with external APIs for critical tasks

#### Execution Limits
- Workers CPU time limits (10 minutes for paid)
- Durable Objects memory limits
- Request payload size limits
- Concurrent execution limits

#### Development Considerations
- TypeScript learning curve for Python team
- Different debugging patterns
- Local development setup complexity
- CI/CD pipeline adaptation

### Alternative Hybrid Approach

If pure Workers AI proves insufficient, consider:

1. **Railway/Render Backend**: Host Python agents
2. **Cloudflare Frontend**: Keep serverless frontend
3. **Hybrid Inference**: Use external APIs for critical reasoning
4. **Gradual Migration**: Start with frontend, migrate backend incrementally

This provides better model quality while maintaining cost efficiency for the frontend layer.

### Native Cloudflare Integrations

#### Workers AI Embeddings Integration (Replacing OpenAI Embeddings)
```typescript
// Worker for embedding generation using BGE models
export interface EmbeddingRequest {
  text: string;
  model?: "@cf/baai/bge-large-en-v1.5" | "@cf/baai/bge-base-en-v1.5" | "@cf/baai/bge-small-en-v1.5";
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model_used: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { text, model = "@cf/baai/bge-base-en-v1.5" } = await request.json() as EmbeddingRequest;

    try {
      const response = await env.AI.run(model, { text });

      // Handle different BGE model dimensions
      const dimensions = model.includes('large') ? 1024 :
                        model.includes('base') ? 768 : 384;

      return Response.json({
        embedding: response.data[0],
        dimensions,
        model_used: model
      } as EmbeddingResponse);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }
  }
};

// BGE Model Options:
// @cf/baai/bge-large-en-v1.5  - 1024 dimensions, best quality
// @cf/baai/bge-base-en-v1.5   - 768 dimensions, balanced quality/speed
// @cf/baai/bge-small-en-v1.5  - 384 dimensions, fastest
```

#### Vectorize Integration (Replacing NetworkX Proximity Graph)
```typescript
import { VectorizeIndex } from '@cloudflare/workers-types';

export class HypothesisSimilarityEngine {
  private index: VectorizeIndex;

  constructor(index: VectorizeIndex) {
    this.index = index;
  }

  async upsertHypothesis(hypothesisId: string, embedding: number[], metadata: any) {
    return await this.index.upsert([
      {
        id: hypothesisId,
        values: embedding,
        metadata: {
          hypothesis: metadata.hypothesis,
          predictions: JSON.stringify(metadata.predictions),
          assumptions: JSON.stringify(metadata.assumptions),
          created_at: Date.now()
        }
      }
    ]);
  }

  async findSimilarHypotheses(queryEmbedding: number[], threshold: number = 0.7, limit: number = 10) {
    const matches = await this.index.query(queryEmbedding, {
      topK: limit,
      returnMetadata: true
    });

    return matches.matches
      .filter(match => match.score >= threshold)
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      }));
  }

  async checkForDuplicates(embedding: number[], threshold: number = 0.9) {
    const matches = await this.index.query(embedding, { topK: 5 });
    return matches.matches.filter(match => match.score >= threshold);
  }

  async buildProximityGraph(hypotheses: any[], threshold: number = 0.8) {
    // Replicate NetworkX proximity graph functionality
    const edges: Array<{from: string, to: string, weight: number}> = [];

    for (let i = 0; i < hypotheses.length; i++) {
      for (let j = i + 1; j < hypotheses.length; j++) {
        const similar = await this.findSimilarHypotheses(
          hypotheses[i].embedding,
          threshold,
          1
        );

        if (similar.length > 0 && similar[0].id === hypotheses[j].uid) {
          edges.push({
            from: hypotheses[i].uid,
            to: hypotheses[j].uid,
            weight: similar[0].score
          });
        }
      }
    }

    return edges;
  }

  async getHypothesisNeighbors(hypothesisId: string, maxNeighbors: number = 10) {
    // Get all similar hypotheses for one hypothesis
    const hypothesis = await this.index.fetchById([hypothesisId]);
    if (!hypothesis.count) return [];

    const matches = await this.index.query(hypothesis.vectors[0].values, {
      topK: maxNeighbors,
      filter: `id != ${hypothesisId}`
    });

    return matches.matches;
  }
}
```

#### Tavily Search Integration (Replacing GPT Researcher)
```typescript
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export class LiteratureResearchClient {
  private tavilyApiKey: string;
  private ai: any;

  constructor(apiKey: string, ai: any) {
    this.tavilyApiKey = apiKey;
    this.ai = ai;
  }

  async researchTopic(topic: string, maxResults: number = 10): Promise<any> {
    // Search using Tavily API
    const searchResults = await this.searchWithTavily(topic, maxResults);

    // Process and synthesize results using Workers AI
    const synthesis = await this.synthesizeResearch(topic, searchResults);

    return {
      topic,
      search_results: searchResults,
      synthesis,
      timestamp: new Date().toISOString()
    };
  }

  private async searchWithTavily(topic: string, maxResults: number): Promise<TavilySearchResult[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tavilyApiKey}`
      },
      body: JSON.stringify({
        query: topic,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: true,
        max_results: maxResults,
        include_domains: ["arxiv.org", "pubmed.ncbi.nlm.nih.gov", "nature.com", "science.org"]
      })
    });

    const data = await response.json();
    return data.results || [];
  }

  private async synthesizeResearch(topic: string, searchResults: TavilySearchResult[]): Promise<string> {
    const prompt = `
    Synthesize the following research results about "${topic}":

    ${searchResults.map(r => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}\n`).join('\n---\n')}

    Provide a comprehensive synthesis including:
    1. Key findings and patterns
    2. Research gaps and opportunities
    3. Methodological approaches
    4. Future research directions
    `;

    const response = await this.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.3
    });

    return response.response;
  }
}
```

#### GPT Researcher Migration Strategy
```typescript
// Replace GPT Researcher with Workers AI + Tavily + Vectorize
export class CloudflareLiteratureResearcher {
  private searchClient: LiteratureResearchClient;
  private similarityEngine: HypothesisSimilarityEngine;

  constructor(env: Env) {
    this.searchClient = new LiteratureResearchClient(env.TAVILY_API_KEY, env.AI);
    this.similarityEngine = new HypothesisSimilarityEngine(env.HYPOTHESIS_INDEX);
  }

  async conductResearch(query: string, maxSubtopics: number = 3): Promise<any> {
    // 1. Decompose topic into subtopics (using Llama 3.1 70B)
    const subtopics = await this.decomposeTopic(query, maxSubtopics);

    // 2. Research each subtopic in parallel
    const researchPromises = subtopics.map(topic =>
      this.searchClient.researchTopic(topic)
    );

    const researchResults = await Promise.all(researchPromises);

    // 3. Synthesize across subtopics
    const synthesis = await this.synthesizeAcrossTopics(query, subtopics, researchResults);

    // 4. Store in Vectorize for future similarity search
    await this.similarityEngine.upsertHypothesis(
      `research_${Date.now()}`,
      await this.generateEmbedding(synthesis),
      { topic: query, synthesis }
    );

    return {
      query,
      subtopics,
      research: researchResults,
      synthesis
    };
  }

  private async decomposeTopic(topic: string, maxSubtopics: number): Promise<string[]> {
    const prompt = `Decompose the research topic "${topic}" into ${maxSubtopics} specific subtopics for investigation. Return as a numbered list.`;

    const response = await this.searchClient.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.2
    });

    return this.parseSubtopics(response.response);
  }
}
```

### Testing Framework Strategy

#### Business Logic Testing
```typescript
// Unit tests for core business logic
import { describe, it, expect, beforeEach } from 'vitest';

describe('Tournament System', () => {
  let tournamentManager: TournamentManager;

  beforeEach(() => {
    tournamentManager = new TournamentManager();
  });

  it('should correctly calculate ELO ratings', () => {
    const [newWinner, newLoser] = tournamentManager.updateElo(1500, 1400);
    expect(newWinner).toBeGreaterThan(1500);
    expect(newLoser).toBeLessThan(1400);
    expect(newWinner + newLoser).toBe(1500 + 1400); // Conservation of points
  });

  it('should prevent duplicate hypothesis entry', async () => {
    const embedding1 = await generateEmbedding("Test hypothesis");
    const embedding2 = await generateEmbedding("Test hypothesis"); // Similar
    const isDuplicate = await similarityEngine.checkForDuplicates(embedding1, 0.9);
    expect(isDuplicate.length).toBe(0); // Should not duplicate existing
  });
});
```

#### Output Quality Testing Framework
```typescript
// Automated evaluation of AI outputs
export class OutputQualityEvaluator {
  private evaluationCriteria = {
    coherence: 0.8,      // Logical consistency
    relevance: 0.85,     // Alignment with input
    novelty: 0.7,        // Originality/innovation
    feasibility: 0.75,   // Practical implementability
    clarity: 0.8         // Communication quality
  };

  async evaluateHypothesis(hypothesis: ParsedHypothesis, context: string): Promise<QualityReport> {
    const prompt = `
    Evaluate this hypothesis on multiple dimensions:
    Hypothesis: "${hypothesis.hypothesis}"
    Context: "${context}"

    Rate each dimension 0-1:
    - Coherence (logical consistency)
    - Relevance (to research context)
    - Novelty (originality of idea)
    - Feasibility (practical implementation)
    - Clarity (communication quality)

    Provide scores and brief justification.
    `;

    const evaluation = await this.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1
    });

    return this.parseEvaluationScores(evaluation.response);
  }

  async batchEvaluateQuality(hypotheses: ParsedHypothesis[]): Promise<QualityReport[]> {
    const evaluations = await Promise.all(
      hypotheses.map(h => this.evaluateHypothesis(h, ""))
    );

    return this.analyzeQualityDistribution(evaluations);
  }
}
```

#### Integration Testing
```typescript
// End-to-end workflow testing
describe('Complete Research Workflow', () => {
  it('should execute full research pipeline', async () => {
    const researcher = new CloudflareLiteratureResearcher(mockEnv);
    const result = await researcher.conductResearch("machine learning for drug discovery");

    expect(result.subtopics).toHaveLength(3);
    expect(result.research).toHaveLength(3);
    expect(result.synthesis).toBeDefined();
    expect(result.synthesis.length).toBeGreaterThan(100);
  });

  it('should handle tournament completion', async () => {
    const tournament = await setupTestTournament();
    const finalRankings = await tournament.runCompleteTournament();

    expect(finalRankings).toHaveLength(greaterThan(0));
    expect(finalRankings[0].elo).toBeGreaterThan(finalRankings[finalRankings.length - 1].elo);
  });
});
```

#### Performance Monitoring
```typescript
// Real-time performance metrics
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getMetricsSummary(): MetricSummary {
    const summary: MetricSummary = {};

    for (const [name, values] of this.metrics) {
      summary[name] = {
        count: values.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        recent: values.slice(-10) // Last 10 measurements
      };
    }

    return summary;
  }

  async monitorAgentPerformance(agentName: string, operation: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const endMemory = this.getMemoryUsage();

      this.recordMetric(`${agentName}_duration`, duration);
      this.recordMetric(`${agentName}_memory_delta`, endMemory - startMemory);
      this.recordMetric(`${agentName}_success_rate`, 1);

      return result;
    } catch (error) {
      this.recordMetric(`${agentName}_success_rate`, 0);
      this.recordMetric(`${agentName}_error_count`, 1);
      throw error;
    }
  }
}
```

### Extensibility Framework for APIs & MCPs

#### Plugin Architecture (TypeScript)
```typescript
// Base interfaces for extensibility
export interface DataSourceConfig {
  name: string;
  type: 'api' | 'mcp' | 'database' | 'file';
  endpoint?: string;
  authentication?: {
    apiKey?: string;
    basicAuth?: { username: string; password: string };
    headers?: Record<string, string>;
  };
  rateLimit?: {
    requestsPerSecond: number;
    burstSize?: number;
  };
  customParameters?: Record<string, any>;
}

export interface SearchResult {
  source: string;
  title: string;
  content: string;
  url?: string;
  score?: number;
  metadata?: Record<string, any>;
}

export abstract class DataSourcePlugin {
  protected config: DataSourceConfig;
  public readonly name: string;

  constructor(config: DataSourceConfig) {
    this.config = config;
    this.name = config.name;
  }

  abstract connect(): Promise<boolean>;
  abstract search(query: string, options?: any): Promise<SearchResult[]>;
  abstract getMetadata(): Promise<Record<string, any>>;

  async validateConnection(): Promise<boolean> {
    try {
      return await this.connect();
    } catch (error) {
      console.error(`Connection validation failed for ${this.name}:`, error);
      return false;
    }
  }
}

// MCP Client Implementation
export class MCPClient extends DataSourcePlugin {
  private serverUrl: string;
  private socket?: WebSocket;

  constructor(config: DataSourceConfig) {
    super(config);
    this.serverUrl = config.endpoint!;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        // Initialize MCP connection
        this.socket!.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'coscientist', version: '1.0.0' }
          }
        }));
        resolve(true);
      };

      this.socket.onerror = (error) => {
        console.error('MCP connection failed:', error);
        resolve(false);
      };
    });
  }

  async listAvailableTools(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'));

      this.socket.send(JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list'
      }));

      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      const originalOnMessage = this.socket.onmessage;
      this.socket.onmessage = (event) => {
        clearTimeout(timeout);
        this.socket!.onmessage = originalOnMessage;
        const response = JSON.parse(event.data);
        resolve(response.result?.tools || []);
      };
    });
  }

  async useTool(toolName: string, arguments: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'));

      this.socket.send(JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments }
      }));

      const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

      const originalOnMessage = this.socket.onmessage;
      this.socket.onmessage = (event) => {
        clearTimeout(timeout);
        this.socket!.onmessage = originalOnMessage;
        const response = JSON.parse(event.data);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      };
    });
  }

  async search(query: string, options?: any): Promise<SearchResult[]> {
    try {
      const tools = await this.listAvailableTools();
      const searchTools = tools.filter((tool: any) =>
        tool.name.toLowerCase().includes('search')
      );

      const results: SearchResult[] = [];
      for (const tool of searchTools) {
        try {
          const result = await this.useTool(tool.name, { query, ...options });
          results.push({
            source: `mcp:${this.name}:${tool.name}`,
            title: result.title || `Search result from ${tool.name}`,
            content: result.content || JSON.stringify(result),
            url: result.url,
            metadata: { tool_name: tool.name, raw_result: result }
          });
        } catch (error) {
          console.warn(`MCP tool ${tool.name} failed:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('MCP search failed:', error);
      return [];
    }
  }

  async getMetadata(): Promise<Record<string, any>> {
    return {
      type: 'mcp',
      name: this.name,
      endpoint: this.serverUrl,
      tools: await this.listAvailableTools().catch(() => [])
    };
  }
}

// Generic API Client
export class APIClient extends DataSourcePlugin {
  private baseUrl: string;

  constructor(config: DataSourceConfig) {
    super(config);
    this.baseUrl = config.endpoint!;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.buildHeaders()
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, options?: any): Promise<SearchResult[]> {
    const searchEndpoint = this.config.customParameters?.searchEndpoint || '/search';
    const url = `${this.baseUrl}${searchEndpoint}`;

    const params = new URLSearchParams({ q: query, ...options });
    const response = await fetch(`${url}?${params}`, {
      headers: this.buildHeaders()
    });

    if (!response.ok) {
      throw new Error(`API search failed: ${response.status}`);
    }

    const data = await response.json();
    return this.formatApiResponse(data);
  }

  async getMetadata(): Promise<Record<string, any>> {
    return {
      type: 'api',
      name: this.name,
      endpoint: this.baseUrl,
      customParameters: this.config.customParameters
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.authentication?.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.authentication.apiKey}`;
    } else if (this.config.authentication?.basicAuth) {
      const { username, password } = this.config.authentication.basicAuth;
      const encoded = btoa(`${username}:${password}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }

    Object.assign(headers, this.config.authentication?.headers || {});
    return headers;
  }

  private formatApiResponse(data: any): SearchResult[] {
    // Flexible response formatting based on common API patterns
    const items = data.results || data.items || data.data || [data];

    return items.map((item: any) => ({
      source: `api:${this.name}`,
      title: item.title || item.name || 'Untitled',
      content: item.content || item.description || item.abstract || JSON.stringify(item),
      url: item.url || item.link || item.id,
      score: item.score || item.relevance,
      metadata: { raw: item }
    }));
  }
}
```

#### Plugin Registry and Multi-Source Search
```typescript
export class DataSourceRegistry {
  private plugins: Map<string, DataSourcePlugin> = new Map();
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  registerPlugin(plugin: DataSourcePlugin): void {
    this.plugins.set(plugin.name, plugin);
    console.log(`Registered data source plugin: ${plugin.name}`);
  }

  getPlugin(name: string): DataSourcePlugin | undefined {
    return this.plugins.get(name);
  }

  async loadPluginsFromConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);

      for (const sourceConfig of config.data_sources || []) {
        const plugin = this.createPlugin(sourceConfig as DataSourceConfig);
        await plugin.connect();
        this.registerPlugin(plugin);
      }
    } catch (error) {
      console.error('Failed to load plugin configuration:', error);
    }
  }

  private createPlugin(config: DataSourceConfig): DataSourcePlugin {
    switch (config.type) {
      case 'mcp':
        return new MCPClient(config);
      case 'api':
        return new APIClient(config);
      case 'database':
        return new DatabaseClient(config); // Placeholder
      case 'file':
        return new FileClient(config); // Placeholder
      default:
        throw new Error(`Unsupported data source type: ${config.type}`);
    }
  }

  async searchAllSources(
    query: string,
    sources?: string[],
    maxResultsPerSource: number = 10
  ): Promise<Record<string, SearchResult[]>> {
    const searchSources = sources || Array.from(this.plugins.keys());
    const searchPromises = new Map<string, Promise<SearchResult[]>>();

    // Execute searches with rate limiting
    for (const sourceName of searchSources) {
      const plugin = this.getPlugin(sourceName);
      if (plugin && await plugin.validateConnection()) {
        searchPromises.set(sourceName, this.rateLimitedSearch(plugin, query, maxResultsPerSource));
      }
    }

    // Collect results
    const results: Record<string, SearchResult[]> = {};
    for (const [sourceName, promise] of searchPromises) {
      try {
        results[sourceName] = await promise;
      } catch (error) {
        console.error(`Search failed for ${sourceName}:`, error);
        results[sourceName] = [];
      }
    }

    return results;
  }

  private async rateLimitedSearch(
    plugin: DataSourcePlugin,
    query: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    // Simple rate limiting - can be enhanced with token bucket
    await new Promise(resolve => setTimeout(resolve, 100));
    return plugin.search(query, { limit: maxResults });
  }
}

// Enhanced Literature Research Client with Extensibility
export class ExtensibleLiteratureResearcher {
  private registry: DataSourceRegistry;
  private tavilyClient: LiteratureResearchClient;
  private ai: any;

  constructor(env: Env) {
    this.registry = new DataSourceRegistry(env);
    this.tavilyClient = new LiteratureResearchClient(env.TAVILY_API_KEY, env.AI);
    this.ai = env.AI;
  }

  async initialize(): Promise<void> {
    // Load default plugins
    await this.loadDefaultPlugins();
  }

  async conductComprehensiveResearch(query: string, maxSubtopics: number = 3): Promise<any> {
    // 1. Decompose topic
    const subtopics = await this.decomposeTopic(query, maxSubtopics);

    // 2. Search across all configured sources
    const multiSourceResults = await this.registry.searchAllSources(
      query,
      undefined,
      15 // More results from external sources
    );

    // 3. Search via Tavily for web results
    const webResults = await this.tavilyClient.researchTopic(query, 10);

    // 4. Synthesize across all sources
    const allResults = this.consolidateResults(multiSourceResults, webResults);
    const synthesis = await this.synthesizeAcrossSources(query, subtopics, allResults);

    return {
      query,
      subtopics,
      sources_used: Object.keys(multiSourceResults),
      research: allResults,
      synthesis,
      source_statistics: this.calculateSourceStatistics(multiSourceResults, webResults)
    };
  }

  private async loadDefaultPlugins(): Promise<void> {
    // Load plugins from KV storage
    try {
      const pluginConfig = await this.env.KV.get('DATA_SOURCE_PLUGINS');
      if (pluginConfig) {
        await this.registry.loadPluginsFromConfig(pluginConfig);
      }
    } catch (error) {
      console.warn('Failed to load plugin configuration:', error);
    }
  }

  private consolidateResults(
    multiSourceResults: Record<string, SearchResult[]>,
    webResults: any
  ): SearchResult[] {
    const allResults: SearchResult[] = [];

    // Add multi-source results
    for (const [source, results] of Object.entries(multiSourceResults)) {
      allResults.push(...results.map(r => ({ ...r, source_type: 'plugin' })));
    }

    // Add web results
    if (webResults.search_results) {
      allResults.push(...webResults.search_results.map((r: any) => ({
        source: `tavily_web`,
        title: r.title,
        content: r.content,
        url: r.url,
        score: r.score,
        source_type: 'web'
      })));
    }

    return this.deduplicateAndRank(allResults);
  }

  private deduplicateAndRank(results: SearchResult[]): SearchResult[] {
    // Simple deduplication based on URL similarity
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      const key = result.url || result.title + result.content.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    // Sort by score (descending) - fallback to content length
    return deduplicated.sort((a, b) => {
      const scoreA = a.score || a.content.length;
      const scoreB = b.score || b.content.length;
      return scoreB - scoreA;
    });
  }

  private calculateSourceStatistics(
    multiSourceResults: Record<string, SearchResult[]>,
    webResults: any
  ): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [source, results] of Object.entries(multiSourceResults)) {
      stats[source] = {
        result_count: results.length,
        avg_score: results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length
      };
    }

    stats.tavily_web = {
      result_count: webResults.search_results?.length || 0,
      avg_score: webResults.search_results?.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / (webResults.search_results?.length || 1) || 0
    };

    return stats;
  }

  private async synthesizeAcrossSources(
    query: string,
    subtopics: string[],
    results: SearchResult[]
  ): Promise<string> {
    const sourcesSummary = Object.entries(
      results.reduce((acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([source, count]) => `${source}: ${count} results`).join(', ');

    const topResults = results.slice(0, 20).map(r =>
      `Title: ${r.title}\nSource: ${r.source}\nContent: ${r.content.slice(0, 500)}...\n`
    ).join('\n---\n');

    const prompt = `
    Synthesize comprehensive research results for: "${query}"

    Sources consulted: ${sourcesSummary}

    Top results:
    ${topResults}

    Provide a detailed synthesis including:
    1. Key findings across all sources
    2. Patterns and trends
    3. Research gaps and opportunities
    4. Confidence assessment based on source diversity
    5. Recommended next steps

    Organize by themes and cite sources where relevant.
    `;

    const response = await this.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.3
    });

    return response.response;
  }

  private async decomposeTopic(topic: string, maxSubtopics: number): Promise<string[]> {
    const prompt = `Decompose the research topic "${topic}" into ${maxSubtopics} specific subtopics for comprehensive investigation. Consider multiple disciplines and approaches. Return as a numbered list.`;

    const response = await this.ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.2
    });

    return this.parseSubtopics(response.response);
  }

  private parseSubtopics(response: string): string[] {
    return response
      .split('\n')
      .filter(line => /^\d+\.|/.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
}
```

#### Configuration Management (KV Storage)
```typescript
// Plugin configuration stored in Cloudflare KV
interface PluginConfiguration {
  data_sources: DataSourceConfig[];
  global_settings: {
    max_concurrent_searches: number;
    default_result_limit: number;
    deduplication_threshold: number;
  };
}

export class ConfigurationManager {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async saveConfiguration(config: PluginConfiguration): Promise<void> {
    await this.kv.put('DATA_SOURCE_PLUGINS', JSON.stringify(config));
  }

  async loadConfiguration(): Promise<PluginConfiguration | null> {
    const configStr = await this.kv.get('DATA_SOURCE_PLUGINS');
    return configStr ? JSON.parse(configStr) : null;
  }

  async addDataSource(sourceConfig: DataSourceConfig): Promise<void> {
    const config = await this.loadConfiguration() || {
      data_sources: [],
      global_settings: {
        max_concurrent_searches: 5,
        default_result_limit: 10,
        deduplication_threshold: 0.8
      }
    };

    // Remove existing source with same name
    config.data_sources = config.data_sources.filter(s => s.name !== sourceConfig.name);
    config.data_sources.push(sourceConfig);

    await this.saveConfiguration(config);
  }

  async removeDataSource(name: string): Promise<void> {
    const config = await this.loadConfiguration();
    if (!config) return;

    config.data_sources = config.data_sources.filter(s => s.name !== name);
    await this.saveConfiguration(config);
  }
}
```

### Sous Chef Branding & Visual Identity

#### Logo & Visual Design
```typescript
// Serverless-optimized brand assets
export const sousChefBranding = {
  // Primary logo for web applications
  logo_svg: `<svg viewBox="0 0 200 60">
    <!-- Modern logo combining lab beaker and chef's knife -->
    <!-- Optimized for fast loading and scalability -->
  </svg>`,

  // Favicon for browser tabs
  favicon: {
    "16x16": "pixel-art molecular-chef-hat-16x16.png",
    "32x32": "pixel-art molecular-chef-hat-32x32.png",
    "192x192": "molecular-chef-hat-192x192.png"
  }
};
```

#### Mobile-First Design System
```css
/* CSS custom properties optimized for serverless delivery */
:root {
  /* Sous Chef color palette */
  --primary-green: #4CAF50;
  --dark-green: #2E7D32;
  --lab-white: #FFFFFF;
  --slate-gray: #F5F5F5;
  --text-dark: #212121;
  --text-medium: #757575;

  /* Mobile-optimized spacing */
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;

  /* Responsive typography */
  --font-sm: clamp(0.875rem, 2vw, 1rem);
  --font-md: clamp(1rem, 2.5vw, 1.125rem);
  --font-lg: clamp(1.125rem, 3vw, 1.25rem);

  /* Touch-friendly sizing */
  --touch-target: 44px;
  --border-radius: 8px;
}

/* Mobile-first responsive design */
.sous-chef-container {
  max-width: 100%;
  padding: var(--space-sm);
  margin: 0 auto;
}

@media (min-width: 768px) {
  .sous-chef-container {
    max-width: 1200px;
    padding: var(--space-md);
  }
}
```

#### AI-Generated Brand Assets
```javascript
// Brand asset generation prompts
const brandAssetPrompts = {
  logo: "Minimalist logo combining laboratory beaker and chef's knife, clean lines, modern flat design, white background, scalable vector style",

  mobile_splash: "Mobile app splash screen showing researcher using Sous Chef on phone, with floating molecular structures and recipe cards above device, clean modern interface",

  web_hero: "Website hero image showing split screen: left side shows laboratory with researcher, right side shows kitchen with chef, connected by flowing data visualization in fresh green",

  favicon_series: "16x16, 32x32, and 192x192 pixel art icons showing molecular structure transforming into chef's hat, using fresh green color scheme",

  app_icons: "Mobile app icons in various sizes, showing stylized combination of flask and whisk, clean modern design on colorful backgrounds",

  brand_pattern: "Subtle seamless pattern combining DNA helix elements with kitchen utensil silhouettes, monochromatic, suitable for website backgrounds"
};
```

#### Performance-Optimized Assets
```typescript
// Cloudflare-optimized asset delivery
export const optimizedAssets = {
  // Images optimized for different devices
  images: {
    hero_desktop: "hero-1920x1080.webp",   // Optimized for desktop
    hero_mobile: "hero-750x1334.webp",     // Optimized for mobile
    logos_webp: "logo-various-sizes.webp",  // WebP format for browsers
    logos_png: "logo-various-sizes.png",   // Fallback for older browsers
  },

  // Icon system with both emoji and SVG versions
  icons: {
    research_magnify: "🔬",
    hypothesis_lightbulb: "💡",
    tournament_trophy: "🏆",
    analysis_chart: "📊",
    processing_gears: "⚙️"
  },

  // Progressive Web App assets
  pwa: {
    manifest: "manifest.json",
    service_worker: "sw.js",
    offline_fallback: "offline.html"
  }
};
```

#### Marketing & Onboarding
```typescript
// User onboarding experience
const onboardingFlow = [
  {
    title: "Welcome to Sous Chef",
    description: "Your AI research assistant that handles the prep work so you can focus on breakthrough science",
    image: "researcher-using-tablet-interface"
  },
  {
    title: "Literature Review, Automated",
    description: "Sous Chef scans and synthesizes research papers, saving you hours of reading time",
    image: "papers-transforming-into-insights"
  },
  {
    title: "Smart Hypothesis Generation",
    description: "AI-powered reasoning approaches generate creative, testable research hypotheses",
    image: "lightbulb-emerging-from-data"
  },
  {
    title: "Tournament-Driven Selection",
    description: "Hypotheses compete in AI tournaments to identify the most promising research directions",
    image: "tournament-bracket-visualization"
  }
];

// Mobile-optimized messaging
const mobileMessaging = {
  tagline: "Research prep, done. Focus on the breakthrough.",
  features: [
    "Mobile-optimized for research on the go",
    "Real-time experiment monitoring",
    "Touch-friendly data visualization",
    "Works offline with PWA features"
  ]
};
```

#### Serverless Brand Deployment
```typescript
// Cloudflare Pages deployment configuration
export const sousChefDeployment = {
  // Build configuration for optimized delivery
  build: {
    framework: "vite",
    buildCommand: "npm run build",
    outputDirectory: "dist"
  },

  // Environment-specific branding
  environments: {
    development: {
      brandColors: "development-palette",
      logoVariant: "development-logo",
      domain: "sous-chef-dev.pages.dev"
    },
    production: {
      brandColors: "production-palette",
      logoVariant: "production-logo",
      domain: "sous-chef-research.pages.dev"
    }
  },

  // Performance optimization
  optimization: {
    enableBrotli: true,
    enableCache: true,
    imageOptimization: true,
    minifyCSS: true,
    minifyJS: true
  }
};
```

This comprehensive Cloudflare implementation provides a cost-effective, globally-scalable serverless solution for the Sous Chef AI research assistant. The modern, mobile-first interface ensures researchers can stay productive from any device, while the clean, professional branding reinforces the platform's role as a capable research assistant that handles the preparation work so scientists can focus on breakthrough discoveries.