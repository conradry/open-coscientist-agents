/**
 * Advanced Vector Search Algorithms
 * High-performance similarity search with filtering and ranking
 */

export class VectorSearchEngine {
  constructor(vectorIndex, env) {
    this.vectorIndex = vectorIndex;
    this.env = env;
    this.embeddingGenerator = new EmbeddingGenerator(env);
  }

  /**
   * Advanced vector search with multiple ranking strategies
   */
  async search(params) {
    const {
      query,
      topK = 10,
      namespace = 'default',
      filter = {},
      includeVectors = false,
      rankingStrategy = 'hybrid',
      boostFactors = {},
      searchMode = 'semantic'
    } = params;

    try {
      // Generate query embedding
      const queryVector = await this.embeddingGenerator.generateSingleEmbedding(
        query,
        '@cf/baai/bge-small-en-v1.5'
      );

      // Perform initial vector search
      const searchResults = await this.vectorIndex.query(queryVector, {
        topK: topK * 2, // Get more results for re-ranking
        namespace,
        returnVector: includeVectors,
        filter: this.buildFilter(filter)
      });

      // Apply ranking and filtering
      const rankedResults = await this.rankResults(
        searchResults.matches,
        query,
        rankingStrategy,
        boostFactors
      );

      // Apply search mode specific processing
      const processedResults = this.applySearchMode(rankedResults, searchMode, query);

      return {
        query,
        results: processedResults.slice(0, topK),
        total: processedResults.length,
        metadata: {
          searchMode,
          rankingStrategy,
          namespace,
          filter,
          searchTime: Date.now()
        }
      };

    } catch (error) {
      console.error('Vector search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Multi-modal search combining text, images, and other data types
   */
  async multiModalSearch(params) {
    const {
      textQuery,
      imageQuery,
      audioQuery,
      weights = { text: 0.7, image: 0.2, audio: 0.1 },
      topK = 10,
      namespace = 'default'
    } = params;

    const searchPromises = [];

    // Text search
    if (textQuery) {
      searchPromises.push(
        this.search({
          query: textQuery,
          topK,
          namespace,
          searchMode: 'text'
        }).then(result => ({ type: 'text', ...result }))
      );
    }

    // Image search (if image query provided)
    if (imageQuery) {
      // This would require a vision model for image embeddings
      searchPromises.push(
        this.searchImages(imageQuery, topK, namespace)
          .then(result => ({ type: 'image', ...result }))
      );
    }

    // Audio search (if audio query provided)
    if (audioQuery) {
      // This would require an audio model for audio embeddings
      searchPromises.push(
        this.searchAudio(audioQuery, topK, namespace)
          .then(result => ({ type: 'audio', ...result }))
      );
    }

    const searchResults = await Promise.all(searchPromises);

    // Combine and re-weight results
    const combinedResults = this.combineMultiModalResults(searchResults, weights);

    return combinedResults;
  }

  /**
   * Faceted search with category-based filtering
   */
  async facetedSearch(params) {
    const {
      query,
      facets = ['category', 'year', 'source'],
      topK = 10,
      namespace = 'default'
    } = params;

    // Get search results
    const searchResults = await this.search({
      query,
      topK: topK * 3, // Get more for faceting
      namespace
    });

    // Extract facet information
    const facetInfo = this.extractFacets(searchResults.results, facets);

    // Group results by facets
    const groupedResults = this.groupByFacets(searchResults.results, facets);

    return {
      query,
      results: searchResults.results.slice(0, topK),
      facets: facetInfo,
      groupedResults,
      metadata: searchResults.metadata
    };
  }

  /**
   * Time-aware search with temporal decay
   */
  async timeAwareSearch(params) {
    const {
      query,
      timeRange = { start: null, end: null },
      decayFunction = 'exponential',
      decayHalfLife = 365, // days
      topK = 10,
      namespace = 'default'
    } = params;

    // Get search results
    const searchResults = await this.search({
      query,
      topK: topK * 2,
      namespace
    });

    // Apply time decay to scores
    const timeDecayedResults = this.applyTimeDecay(
      searchResults.results,
      timeRange,
      decayFunction,
      decayHalfLife
    );

    return {
      query,
      results: timeDecayedResults.slice(0, topK),
      timeRange,
      decayFunction,
      metadata: searchResults.metadata
    };
  }

  /**
   * Contextual search with conversation history
   */
  async contextualSearch(params) {
    const {
      query,
      conversationHistory = [],
      contextWeight = 0.3,
      topK = 10,
      namespace = 'default'
    } = params;

    // Build contextual query
    const contextualQuery = this.buildContextualQuery(query, conversationHistory);

    // Search with original query
    const originalResults = await this.search({
      query,
      topK,
      namespace
    });

    // Search with contextual query
    const contextualResults = await this.search({
      query: contextualQuery,
      topK,
      namespace
    });

    // Combine results with context weighting
    const combinedResults = this.combineContextualResults(
      originalResults.results,
      contextualResults.results,
      contextWeight
    );

    return {
      query,
      contextualQuery,
      results: combinedResults.slice(0, topK),
      conversationLength: conversationHistory.length,
      contextWeight,
      metadata: originalResults.metadata
    };
  }

  /**
   * Ranking algorithms for search results
   */
  async rankResults(results, query, strategy, boostFactors) {
    switch (strategy) {
      case 'semantic':
        return this.semanticRanking(results, query, boostFactors);

      case 'keyword':
        return this.keywordRanking(results, query, boostFactors);

      case 'hybrid':
        return this.hybridRanking(results, query, boostFactors);

      case 'learning_to_rank':
        return await this.learningToRank(results, query, boostFactors);

      case 'neural':
        return await this.neuralRanking(results, query, boostFactors);

      default:
        return results;
    }
  }

  /**
   * Semantic ranking using vector similarity
   */
  semanticRanking(results, query, boostFactors) {
    return results.map(result => ({
      ...result,
      score: this.calculateSemanticScore(result, query, boostFactors)
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Keyword ranking with exact match bonuses
   */
  keywordRanking(results, query, boostFactors) {
    const queryTerms = query.toLowerCase().split(/\s+/);

    return results.map(result => {
      const metadata = result.metadata || {};
      const title = (metadata.title || '').toLowerCase();
      const content = (metadata.content || '').toLowerCase();

      let score = result.score || 0;

      // Exact title match bonus
      if (title.includes(query.toLowerCase())) {
        score += boostFactors.exactTitleMatch || 0.3;
      }

      // Partial title matches
      queryTerms.forEach(term => {
        if (title.includes(term)) {
          score += (boostFactors.titleMatch || 0.1);
        }
        if (content.includes(term)) {
          score += (boostFactors.contentMatch || 0.05);
        }
      });

      return { ...result, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Hybrid ranking combining semantic and keyword
   */
  hybridRanking(results, query, boostFactors) {
    const semanticResults = this.semanticRanking(results, query, boostFactors);
    const keywordResults = this.keywordRanking(results, query, boostFactors);

    const semanticWeight = boostFactors.semanticWeight || 0.7;
    const keywordWeight = 1 - semanticWeight;

    return results.map((result, index) => {
      const semanticScore = semanticResults[index].score;
      const keywordScore = keywordResults[index].score;

      const hybridScore = (semanticScore * semanticWeight) + (keywordScore * keywordWeight);

      return { ...result, score: hybridScore };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Learning to rank using simple ML model
   */
  async learningToRank(results, query, boostFactors) {
    // This is a simplified implementation
    // In practice, you'd use a trained model

    const features = results.map(result => this.extractFeatures(result, query));

    // Simple linear combination (would be replaced with actual model)
    const weights = {
      similarity: 0.4,
      recency: 0.2,
      authority: 0.2,
      popularity: 0.2
    };

    return results.map((result, index) => {
      const feature = features[index];
      const score =
        feature.similarity * weights.similarity +
        feature.recency * weights.recency +
        feature.authority * weights.authority +
        feature.popularity * weights.popularity;

      return { ...result, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Neural ranking using a transformer model
   */
  async neuralRanking(results, query, boostFactors) {
    // Use Workers AI for neural reranking
    try {
      const rerankPromises = results.slice(0, 20).map(async (result) => {
        const metadata = result.metadata || {};
        const title = metadata.title || '';
        const content = metadata.content || '';
        const document = `${title} ${content}`.substring(0, 1000);

        // Use a cross-encoder model for reranking
        const response = await this.env.AI.run('@cf/baai/bge-reranker-base', {
          query: query,
          passages: [document]
        });

        return {
          ...result,
          neuralScore: response.scores[0] || 0
        };
      });

      const rerankedResults = await Promise.all(rerankPromises);

      return rerankedResults
        .map(result => ({
          ...result,
          score: (result.score * 0.5) + (result.neuralScore * 0.5)
        }))
        .sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Neural ranking failed, falling back to hybrid:', error);
      return this.hybridRanking(results, query, boostFactors);
    }
  }

  /**
   * Extract features for learning to rank
   */
  extractFeatures(result, query) {
    const metadata = result.metadata || {};
    const timestamp = metadata.timestamp || 0;
    const now = Date.now();

    return {
      similarity: result.score || 0,
      recency: Math.max(0, 1 - (now - timestamp) / (365 * 24 * 60 * 60 * 1000)), // 1 year decay
      authority: metadata.authority || 0.5,
      popularity: metadata.citations || metadata.views || 0
    };
  }

  /**
   * Apply search mode specific processing
   */
  applySearchMode(results, searchMode, query) {
    switch (searchMode) {
      case 'semantic':
        return results.filter(r => r.score > 0.5);

      case 'comprehensive':
        return results; // Return all results

      case 'precise':
        return results.filter(r => r.score > 0.7).slice(0, 5);

      case 'exploratory':
        return results.sort(() => Math.random() - 0.5).slice(0, 10); // Shuffle for diversity

      default:
        return results;
    }
  }

  /**
   * Build filter object for Vectorize
   */
  buildFilter(filter) {
    const vectorizeFilter = {};

    Object.entries(filter).forEach(([key, value]) => {
      if (typeof value === 'object') {
        vectorizeFilter[key] = value;
      } else {
        vectorizeFilter[key] = { $eq: value };
      }
    });

    return Object.keys(vectorizeFilter).length > 0 ? vectorizeFilter : undefined;
  }

  /**
   * Calculate semantic score with boost factors
   */
  calculateSemanticScore(result, query, boostFactors) {
    let score = result.score || 0;
    const metadata = result.metadata || {};

    // Recency boost
    if (metadata.timestamp) {
      const daysSinceCreation = (Date.now() - metadata.timestamp) / (24 * 60 * 60 * 1000);
      if (daysSinceCreation < 30) {
        score += boostFactors.recent || 0.1;
      }
    }

    // Authority boost
    if (metadata.authority > 0.8) {
      score += boostFactors.authority || 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract facets from results
   */
  extractFacets(results, facetFields) {
    const facets = {};

    facetFields.forEach(field => {
      facets[field] = {};

      results.forEach(result => {
        const value = result.metadata?.[field];
        if (value) {
          facets[field][value] = (facets[field][value] || 0) + 1;
        }
      });

      // Convert to sorted array
      facets[field] = Object.entries(facets[field])
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });

    return facets;
  }

  /**
   * Group results by facets
   */
  groupByFacets(results, facets) {
    const grouped = {};

    facets.forEach(field => {
      grouped[field] = {};

      results.forEach(result => {
        const value = result.metadata?.[field] || 'unknown';
        if (!grouped[field][value]) {
          grouped[field][value] = [];
        }
        grouped[field][value].push(result);
      });
    });

    return grouped;
  }

  /**
   * Apply time decay to search scores
   */
  applyTimeDecay(results, timeRange, decayFunction, halfLife) {
    const now = Date.now();
    const halfLifeMs = halfLife * 24 * 60 * 60 * 1000;

    return results.map(result => {
      const timestamp = result.metadata?.timestamp || now;
      const age = now - timestamp;

      let decayFactor = 1;

      if (decayFunction === 'exponential') {
        decayFactor = Math.pow(0.5, age / halfLifeMs);
      } else if (decayFunction === 'linear') {
        decayFactor = Math.max(0, 1 - age / (2 * halfLifeMs));
      }

      return {
        ...result,
        score: (result.score || 0) * decayFactor,
        timeDecay: decayFactor
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Build contextual query from conversation history
   */
  buildContextualQuery(query, history) {
    if (history.length === 0) {
      return query;
    }

    const recentContext = history.slice(-3).map(h => h.query).join(' ');
    return `${recentContext} ${query}`;
  }

  /**
   * Combine contextual search results
   */
  combineContextualResults(original, contextual, contextWeight) {
    const combined = [];
    const seen = new Set();

    // Add contextual results first
    contextual.forEach(result => {
      if (!seen.has(result.id)) {
        combined.push({
          ...result,
          contextual: true,
          score: (result.score || 0) * (1 + contextWeight)
        });
        seen.add(result.id);
      }
    });

    // Add original results that weren't in contextual
    original.forEach(result => {
      if (!seen.has(result.id)) {
        combined.push({
          ...result,
          contextual: false,
          score: (result.score || 0) * (1 - contextWeight)
        });
        seen.add(result.id);
      }
    });

    return combined.sort((a, b) => b.score - a.score);
  }
}