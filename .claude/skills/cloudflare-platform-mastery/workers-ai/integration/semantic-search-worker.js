/**
 * Semantic Search Worker with AI Embeddings
 *
 * Combines Cloudflare Workers AI embeddings with Vectorize for semantic search
 */

import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const ai = new Ai(env.AI);

    try {
      const url = new URL(request.url);
      const { pathname, searchParams } = url;

      // Route to appropriate function
      switch (pathname) {
        case '/search':
          return await handleSemanticSearch(request, ai, env);
        case '/index':
          return await handleDocumentIndexing(request, ai, env);
        case '/similar':
          return await handleSimilaritySearch(request, ai, env);
        case '/batch-index':
          return await handleBatchIndexing(request, ai, env);
        case '/health':
          return await handleHealthCheck(env);
        default:
          return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      console.error('Semantic Search Error:', error);
      return Response.json({
        error: 'Search service temporarily unavailable',
        message: error.message
      }, { status: 500 });
    }
  }
};

/**
 * Handle semantic search requests
 */
async function handleSemanticSearch(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    query,
    topK = 10,
    namespace = 'default',
    filters = {},
    includeMetadata = true,
    threshold = 0.7
  } = await request.json();

  // Validate input
  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(ai, query);
  if (!queryEmbedding) {
    return Response.json({ error: 'Failed to generate query embedding' }, { status: 500 });
  }

  // Search in Vectorize
  const searchResults = await env.VECTORIZE_INDEX.query(queryEmbedding, {
    topK,
    namespace,
    includeMetadata,
    filter: buildVectorizeFilter(filters)
  });

  // Filter by threshold and format results
  const filteredResults = searchResults.matches
    .filter(match => match.score >= threshold)
    .map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      distance: 1 - match.score // Convert to distance
    }));

  return Response.json({
    query,
    results: filteredResults,
    total: filteredResults.length,
    threshold,
    namespace,
    processingTime: Date.now()
  });
}

/**
 * Handle document indexing
 */
async function handleDocumentIndexing(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    id,
    content,
    metadata = {},
    namespace = 'default',
    chunkSize = 500,
    overlap = 50
  } = await request.json();

  // Validate input
  if (!id || !content) {
    return Response.json({ error: 'ID and content are required' }, { status: 400 });
  }

  // Split content into chunks
  const chunks = chunkDocument(content, chunkSize, overlap);
  const vectors = [];

  // Generate embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(ai, chunk.text);

    if (embedding) {
      vectors.push({
        id: `${id}_chunk_${i}`,
        values: embedding,
        metadata: {
          ...metadata,
          documentId: id,
          chunkIndex: i,
          chunkText: chunk.text,
          chunkStart: chunk.start,
          chunkEnd: chunk.end,
          totalChunks: chunks.length
        }
      });
    }
  }

  // Index vectors in batches
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await env.VECTORIZE_INDEX.upsert(batch, { namespace });
  }

  return Response.json({
    success: true,
    documentId: id,
    chunksIndexed: vectors.length,
    namespace
  });
}

/**
 * Handle similarity search
 */
async function handleSimilaritySearch(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    documentId,
    topK = 5,
    namespace = 'default',
    includeMetadata = true
  } = await request.json();

  // Validate input
  if (!documentId) {
    return Response.json({ error: 'Document ID is required' }, { status: 400 });
  }

  // Get document chunks
  const documentResults = await env.VECTORIZE_INDEX.fetchById(
    [`${documentId}_chunk_0`], // Get first chunk as reference
    { namespace }
  );

  if (!documentResults.matches || documentResults.matches.length === 0) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const referenceVector = documentResults.matches[0].vector;

  // Find similar documents
  const similarResults = await env.VECTORIZE_INDEX.query(referenceVector, {
    topK: topK + 1, // +1 to exclude the original document
    namespace,
    includeMetadata
  });

  // Filter out the original document
  const filteredResults = similarResults.matches
    .filter(match => !match.id.startsWith(documentId))
    .slice(0, topK)
    .map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      documentId: match.metadata?.documentId || match.id.split('_chunk_')[0]
    }));

  return Response.json({
    documentId,
    similarDocuments: filteredResults,
    total: filteredResults.length
  });
}

/**
 * Handle batch document indexing
 */
async function handleBatchIndexing(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    documents,
    namespace = 'default',
    chunkSize = 500,
    overlap = 50,
    concurrency = 5
  } = await request.json();

  if (!Array.isArray(documents) || documents.length === 0) {
    return Response.json({ error: 'Documents array is required' }, { status: 400 });
  }

  const results = [];
  const errors = [];

  // Process documents in parallel batches
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);

    const batchPromises = batch.map(async (doc, batchIndex) => {
      try {
        const docIndex = i + batchIndex;
        const chunks = chunkDocument(doc.content, chunkSize, overlap);
        const vectors = [];

        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          const embedding = await generateEmbedding(ai, chunk.text);

          if (embedding) {
            vectors.push({
              id: `${doc.id}_chunk_${j}`,
              values: embedding,
              metadata: {
                ...doc.metadata,
                documentId: doc.id,
                chunkIndex: j,
                chunkText: chunk.text,
                chunkStart: chunk.start,
                chunkEnd: chunk.end,
                totalChunks: chunks.length,
                indexedAt: new Date().toISOString()
              }
            });
          }
        }

        return {
          documentId: doc.id,
          chunksIndexed: vectors.length,
          vectors
        };

      } catch (error) {
        errors.push({
          documentId: doc.id,
          error: error.message
        });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Index successful batches
    for (const result of batchResults) {
      if (result && result.vectors.length > 0) {
        try {
          await env.VECTORIZE_INDEX.upsert(result.vectors, { namespace });
          results.push({
            documentId: result.documentId,
            chunksIndexed: result.chunksIndexed,
            success: true
          });
        } catch (error) {
          errors.push({
            documentId: result.documentId,
            error: `Indexing failed: ${error.message}`
          });
        }
      }
    }
  }

  return Response.json({
    success: true,
    processed: documents.length,
    indexed: results.length,
    errors: errors.length,
    results,
    errors
  });
}

/**
 * Generate embeddings for text
 */
async function generateEmbedding(ai, text) {
  try {
    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: text.trim().substring(0, 8000) // Limit text length
    });

    return response.data[0];
  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

/**
 * Split document into chunks for better semantic search
 */
function chunkDocument(content, chunkSize, overlap) {
  const chunks = [];
  const words = content.split(' ');

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkText = chunkWords.join(' ').trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        start: i,
        end: Math.min(i + chunkSize, words.length)
      });
    }
  }

  return chunks;
}

/**
 * Build Vectorize filter from filter object
 */
function buildVectorizeFilter(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return {};
  }

  const vectorizeFilters = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'string') {
      vectorizeFilters[key] = value;
    } else if (Array.isArray(value)) {
      vectorizeFilters[key] = { $in: value };
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([operator, operatorValue]) => {
        vectorizeFilters[key] = { [`$${operator}`]: operatorValue };
      });
    } else {
      vectorizeFilters[key] = value;
    }
  });

  return vectorizeFilters;
}

/**
 * Health check endpoint
 */
async function handleHealthCheck(env) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // Check AI service
    const ai = new Ai(env.AI);
    await ai.run('@cf/baai/bge-base-en-v1.5', { text: 'test' });
    health.services.ai = 'healthy';
  } catch (error) {
    health.services.ai = `unhealthy: ${error.message}`;
    health.status = 'degraded';
  }

  try {
    // Check Vectorize index
    await env.VECTORIZE_INDEX.describe();
    health.services.vectorize = 'healthy';
  } catch (error) {
    health.services.vectorize = `unhealthy: ${error.message}`;
    health.status = 'degraded';
  }

  const status = health.status === 'healthy' ? 200 : 503;
  return Response.json(health, { status });
}

/**
 * Advanced search features
 */
export class SemanticSearchEngine {
  constructor(ai, vectorizeIndex) {
    this.ai = ai;
    this.index = vectorizeIndex;
    this.cache = new Map();
  }

  /**
   * Hybrid search combining keyword and semantic search
   */
  async hybridSearch(query, options = {}) {
    const {
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      topK = 10,
      namespace = 'default'
    } = options;

    // Generate semantic embeddings
    const semanticResults = await this.semanticSearch(query, {
      topK: Math.ceil(topK * 1.5),
      namespace
    });

    // Extract keywords for text search (would need implementation)
    const keywordResults = await this.keywordSearch(query, {
      topK: Math.ceil(topK * 1.5),
      namespace
    });

    // Combine and re-score results
    const combinedResults = this.combineResults(
      semanticResults,
      keywordResults,
      semanticWeight,
      keywordWeight
    );

    return combinedResults.slice(0, topK);
  }

  /**
   * Multi-query search for complex queries
   */
  async multiQuerySearch(query, options = {}) {
    const {
      subQueries = [],
      aggregationMethod = 'reciprocal_rank',
      topK = 10,
      namespace = 'default'
    } = options;

    const queries = [query, ...subQueries];
    const allResults = [];

    // Search each query
    for (const q of queries) {
      const results = await this.semanticSearch(q, { topK, namespace });
      allResults.push({ query: q, results });
    }

    // Aggregate results
    return this.aggregateResults(allResults, aggregationMethod, topK);
  }

  /**
   * Context-aware search with user preferences
   */
  async contextualSearch(query, context, options = {}) {
    const {
      userProfile = {},
      searchHistory = [],
      preferences = {},
      topK = 10,
      namespace = 'default'
    } = options;

    // Augment query with context
    const augmentedQuery = this.augmentQuery(query, context, userProfile, searchHistory);

    // Perform search with filters based on preferences
    const filters = this.buildPreferencesFilters(preferences);
    const results = await this.semanticSearch(augmentedQuery, {
      topK: Math.ceil(topK * 1.5),
      filters,
      namespace
    });

    // Re-rank based on user context
    return this.reRankResults(results, userProfile, searchHistory, topK);
  }

  /**
   * Basic semantic search
   */
  async semanticSearch(query, options = {}) {
    const cacheKey = `search:${JSON.stringify({ query, options })}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const {
      topK = 10,
      namespace = 'default',
      filters = {},
      threshold = 0.7
    } = options;

    const embedding = await generateEmbedding(this.ai, query);
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }

    const searchResults = await this.index.query(embedding, {
      topK,
      namespace,
      includeMetadata: true,
      filter: buildVectorizeFilter(filters)
    });

    const results = searchResults.matches
      .filter(match => match.score >= threshold)
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {}
      }));

    // Cache results
    this.cache.set(cacheKey, results);
    setTimeout(() => this.cache.delete(cacheKey), 300000); // 5 minutes

    return results;
  }

  /**
   * Keyword search (placeholder implementation)
   */
  async keywordSearch(query, options = {}) {
    // This would integrate with a traditional search engine
    // For now, return empty results
    return [];
  }

  /**
   * Combine semantic and keyword results
   */
  combineResults(semanticResults, keywordResults, semanticWeight, keywordWeight) {
    const combined = new Map();

    // Add semantic results
    semanticResults.forEach(result => {
      combined.set(result.id, {
        ...result,
        semanticScore: result.score,
        keywordScore: 0,
        combinedScore: result.score * semanticWeight
      });
    });

    // Add keyword results and combine scores
    keywordResults.forEach(result => {
      if (combined.has(result.id)) {
        const existing = combined.get(result.id);
        existing.keywordScore = result.score;
        existing.combinedScore += result.score * keywordWeight;
      } else {
        combined.set(result.id, {
          ...result,
          semanticScore: 0,
          keywordScore: result.score,
          combinedScore: result.score * keywordWeight
        });
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Aggregate multiple query results
   */
  aggregateResults(allResults, method, topK) {
    const scores = new Map();

    allResults.forEach(({ results }) => {
      results.forEach((result, index) => {
        const currentScore = scores.get(result.id) || 0;

        switch (method) {
          case 'reciprocal_rank':
            currentScore += 1 / (index + 1);
            break;
          case 'average':
            currentScore += result.score;
            break;
          case 'max':
            currentScore = Math.max(currentScore, result.score);
            break;
        }

        scores.set(result.id, {
          ...result,
          aggregatedScore: method === 'average' ? currentScore / allResults.length : currentScore
        });
      });
    });

    return Array.from(scores.values())
      .sort((a, b) => b.aggregatedScore - a.aggregatedScore)
      .slice(0, topK);
  }

  /**
   * Augment query with context
   */
  augmentQuery(query, context, userProfile, searchHistory) {
    let augmented = query;

    // Add contextual terms
    if (context.domain) {
      augmented = `${context.domain} ${augmented}`;
    }

    // Add user interests
    if (userProfile.interests && userProfile.interests.length > 0) {
      const interests = userProfile.interests.slice(0, 3).join(' ');
      augmented = `${augmented} ${interests}`;
    }

    return augmented;
  }

  /**
   * Build filters from user preferences
   */
  buildPreferencesFilters(preferences) {
    const filters = {};

    if (preferences.contentType) {
      filters.contentType = preferences.contentType;
    }

    if (preferences.dateRange) {
      filters.createdAt = {
        gte: preferences.dateRange.start,
        lte: preferences.dateRange.end
      };
    }

    if (preferences.tags && preferences.tags.length > 0) {
      filters.tags = { $in: preferences.tags };
    }

    return filters;
  }

  /**
   * Re-rank results based on user context
   */
  reRankResults(results, userProfile, searchHistory, topK) {
    return results
      .map(result => ({
        ...result,
        contextualScore: this.calculateContextualScore(result, userProfile, searchHistory)
      }))
      .sort((a, b) => b.contextualScore - a.contextualScore)
      .slice(0, topK);
  }

  /**
   * Calculate contextual score for result
   */
  calculateContextualScore(result, userProfile, searchHistory) {
    let score = result.score;

    // Boost based on user interests
    if (userProfile.interests) {
      const resultTags = result.metadata.tags || [];
      const matchingInterests = userProfile.interests.filter(interest =>
        resultTags.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
      );
      score += matchingInterests.length * 0.1;
    }

    // Boost based on search history
    if (searchHistory.length > 0) {
      const recentSearches = searchHistory.slice(-5);
      const matchingSearches = recentSearches.filter(search =>
        result.metadata.text && result.metadata.text.toLowerCase().includes(search.toLowerCase())
      );
      score += matchingSearches.length * 0.05;
    }

    return score;
  }
}