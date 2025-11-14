/**
 * Vectorize Worker Template
 * Core integration patterns for Cloudflare Vectorize with Workers
 * Based on successful medical research platform implementation
 */

export default {
  /**
   * Vectorize index binding - configure in wrangler.toml
   *
   * [[vectorize]]
   * binding = "VECTOR_INDEX"
   * index_name = "your-index-name"
   * dimension = 1536  // OpenAI ada-002 embedding dimension
   * metric = "cosine" // cosine, euclidean, dotproduct
   */

  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route requests
      if (path === '/search') {
        return this.handleVectorSearch(request, env);
      } else if (path === '/index') {
        return this.handleVectorIndex(request, env);
      } else if (path === '/batch') {
        return this.handleBatchOperations(request, env);
      } else if (path === '/embed') {
        return this.handleEmbedding(request, env);
      } else if (path === '/health') {
        return this.handleHealthCheck(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Handle vector similarity search
   */
  async handleVectorSearch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { query, topK = 10, namespace, filter = {}, includeVectors = false } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query is required'
      }), { status: 400 });
    }

    try {
      // Generate embedding for query
      const queryVector = await this.generateEmbedding(query, env);

      // Configure search parameters
      const searchParams = {
        topK,
        returnVector: includeVectors,
        namespace: namespace || 'default'
      };

      // Add filter if provided
      if (Object.keys(filter).length > 0) {
        searchParams.filter = filter;
      }

      // Perform vector search
      const results = await env.VECTOR_INDEX.query(queryVector, searchParams);

      // Enhanced results with distance to similarity conversion
      const enhancedResults = results.matches.map(match => ({
        id: match.id,
        score: match.score,
        similarity: this.distanceToSimilarity(match.score, 'cosine'),
        metadata: match.metadata,
        vector: includeVectors ? match.vector : null,
        namespace: match.namespace
      }));

      return new Response(JSON.stringify({
        query,
        results: enhancedResults,
        total: enhancedResults.length,
        searchTime: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Vector search error:', error);
      return new Response(JSON.stringify({
        error: 'Search failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle document indexing
   */
  async handleVectorIndex(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { documents, namespace = 'default', batchSize = 100 } = await request.json();

    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({
        error: 'Documents array is required'
      }), { status: 400 });
    }

    try {
      const results = [];

      // Process documents in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);

        // Generate embeddings for batch
        const embeddings = await Promise.all(
          batch.map(doc => this.generateEmbedding(doc.content, env))
        );

        // Prepare vectors for indexing
        const vectors = batch.map((doc, index) => ({
          id: doc.id || this.generateId(),
          values: embeddings[index],
          metadata: {
            title: doc.title,
            content: doc.content.substring(0, 1000), // Truncate for metadata
            source: doc.source || 'unknown',
            timestamp: Date.now(),
            ...doc.metadata
          },
          namespace
        }));

        // Index vectors
        const indexResult = await env.VECTOR_INDEX.upsert(vectors);
        results.push({
          batch: Math.floor(i / batchSize) + 1,
          indexed: vectors.length,
          result: indexResult
        });

        // Add small delay to avoid rate limiting
        await this.sleep(100);
      }

      return new Response(JSON.stringify({
        success: true,
        totalIndexed: documents.length,
        batches: results.length,
        results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Indexing error:', error);
      return new Response(JSON.stringify({
        error: 'Indexing failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle batch operations (delete, update, etc.)
   */
  async handleBatchOperations(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { operation, ids, namespace = 'default' } = await request.json();

    if (!operation || !Array.isArray(ids)) {
      return new Response(JSON.stringify({
        error: 'Operation and IDs array are required'
      }), { status: 400 });
    }

    try {
      let result;

      switch (operation) {
        case 'delete':
          result = await env.VECTOR_INDEX.deleteByIds(ids, { namespace });
          break;

        case 'describe':
          result = await env.VECTOR_INDEX.describe();
          break;

        default:
          return new Response(JSON.stringify({
            error: `Unsupported operation: ${operation}`
          }), { status: 400 });
      }

      return new Response(JSON.stringify({
        operation,
        ids: ids.length,
        namespace,
        result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Batch operation error:', error);
      return new Response(JSON.stringify({
        error: 'Batch operation failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle embedding generation
   */
  async handleEmbedding(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { texts, model = '@cf/baai/bge-small-en-v1.5' } = await request.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({
        error: 'Texts array is required'
      }), { status: 400 });
    }

    try {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbedding(text, env, model))
      );

      return new Response(JSON.stringify({
        texts: texts.length,
        model,
        embeddings
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Embedding generation error:', error);
      return new Response(JSON.stringify({
        error: 'Embedding generation failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Health check endpoint
   */
  async handleHealthCheck(request, env) {
    try {
      // Test Vectorize connection
      const indexInfo = await env.VECTOR_INDEX.describe();

      // Test embedding generation
      const testEmbedding = await this.generateEmbedding('test', env);

      return new Response(JSON.stringify({
        status: 'healthy',
        vectorize: {
          indexName: indexInfo.indexName,
          dimension: indexInfo.dimension,
          metric: indexInfo.metric
        },
        embedding: {
          dimension: testEmbedding.length,
          model: '@cf/baai/bge-small-en-v1.5'
        },
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Health check error:', error);
      return new Response(JSON.stringify({
        status: 'unhealthy',
        error: error.message
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Generate embedding using Workers AI
   */
  async generateEmbedding(text, env, model = '@cf/baai/bge-small-en-v1.5') {
    try {
      const response = await env.AI.run(model, {
        text: text.trim()
      });

      return response.data[0];
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  },

  /**
   * Convert distance score to similarity (0-1)
   */
  distanceToSimilarity(distance, metric) {
    switch (metric) {
      case 'cosine':
        // Cosine distance ranges from 0-2, where 0 is identical
        return Math.max(0, 1 - distance / 2);
      case 'euclidean':
        // Convert using a scaling factor
        return Math.max(0, 1 - distance / 2);
      case 'dotproduct':
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, distance));
      default:
        return distance;
    }
  },

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomUUID();
  },

  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};