/**
 * Hybrid Search Worker - D1 + Vectorize Integration
 * Combines keyword search (D1) with semantic search (Vectorize)
 * Based on successful medical research platform patterns
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/hybrid-search') {
        return this.handleHybridSearch(request, env);
      } else if (path === '/index-document') {
        return this.handleDocumentIndexing(request, env);
      } else if (path === '/sync-data') {
        return this.handleDataSynchronization(request, env);
      } else if (path === '/search-suggestions') {
        return this.handleSearchSuggestions(request, env);
      } else if (path === '/analytics') {
        return this.handleSearchAnalytics(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Hybrid search worker error:', error);
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
   * Handle hybrid search combining D1 FTS and Vectorize semantic search
   */
  async handleHybridSearch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      query,
      filters = {},
      searchWeights = { semantic: 0.6, keyword: 0.3, exact: 0.1 },
      topK = 10,
      namespace = 'documents',
      includeContext = false
    } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query is required'
      }), { status: 400 });
    }

    try {
      const startTime = Date.now();

      // Execute searches in parallel
      const [semanticResults, keywordResults, exactResults] = await Promise.all([
        this.performSemanticSearch(query, env, topK * 2, namespace, filters),
        this.performKeywordSearch(query, env, topK * 2, filters),
        this.performExactMatchSearch(query, env, topK, filters)
      ]);

      // Combine and rank results
      const hybridResults = this.combineSearchResults(
        {
          semantic: semanticResults,
          keyword: keywordResults,
          exact: exactResults
        },
        searchWeights,
        query
      );

      // Add context if requested
      if (includeContext) {
        await this.enrichResultsWithContext(hybridResults, env);
      }

      const searchTime = Date.now() - startTime;

      return new Response(JSON.stringify({
        query,
        results: hybridResults.slice(0, topK),
        total: hybridResults.length,
        searchTime,
        weights: searchWeights,
        analytics: {
          semanticCount: semanticResults.length,
          keywordCount: keywordResults.length,
          exactCount: exactResults.length
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Hybrid search error:', error);
      return new Response(JSON.stringify({
        error: 'Hybrid search failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle document indexing for both D1 and Vectorize
   */
  async handleDocumentIndexing(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { documents, namespace = 'documents', overwrite = false } = await request.json();

    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({
        error: 'Documents array is required'
      }), { status: 400 });
    }

    try {
      const results = {
        d1Indexing: [],
        vectorizeIndexing: [],
        total: documents.length
      };

      for (const document of documents) {
        const docId = document.id || this.generateDocumentId(document);

        // Index in D1 for keyword search
        const d1Result = await this.indexInD1(document, docId, env, overwrite);
        results.d1Indexing.push(d1Result);

        // Index in Vectorize for semantic search
        const vectorizeResult = await this.indexInVectorize(document, docId, env, namespace, overwrite);
        results.vectorizeIndexing.push(vectorizeResult);
      }

      return new Response(JSON.stringify({
        success: true,
        results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Document indexing error:', error);
      return new Response(JSON.stringify({
        error: 'Document indexing failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle data synchronization between D1 and Vectorize
   */
  async handleDataSynchronization(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { operation, batchSize = 100, namespace = 'documents' } = await request.json();

    try {
      switch (operation) {
        case 'full_sync':
          return await this.performFullSync(env, namespace, batchSize);

        case 'incremental_sync':
          return await this.performIncrementalSync(env, namespace);

        case 'repair_missing':
          return await this.repairMissingDocuments(env, namespace);

        default:
          return new Response(JSON.stringify({
            error: 'Invalid operation'
          }), { status: 400 });
      }

    } catch (error) {
      console.error('Data synchronization error:', error);
      return new Response(JSON.stringify({
        error: 'Data synchronization failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Perform semantic search using Vectorize
   */
  async performSemanticSearch(query, env, topK, namespace, filters) {
    try {
      // Generate query embedding
      const queryVector = await this.generateQueryEmbedding(query, env);

      // Perform vector search
      const vectorResults = await env.VECTOR_INDEX.query(queryVector, {
        topK,
        namespace,
        filter: this.buildVectorFilter(filters),
        returnVector: false
      });

      // Convert to standardized format
      return vectorResults.matches.map(match => ({
        id: match.id,
        title: match.metadata?.title || '',
        content: match.metadata?.content || '',
        score: match.score,
        source: 'vectorize',
        metadata: match.metadata,
        relevanceType: 'semantic'
      }));

    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  },

  /**
   * Perform keyword search using D1 FTS
   */
  async performKeywordSearch(query, env, topK, filters) {
    try {
      // Build FTS query
      const ftsQuery = this.buildFTSQuery(query, filters);

      // Execute D1 query with FTS
      const results = await env.D1.prepare(`
        SELECT
          id,
          title,
          content,
          abstract,
          authors,
          journal,
          publication_date,
          source,
          rank,
          snippet(content, 1, '<mark>', '</mark>', '...', 50) as snippet
        FROM documents_fts
        WHERE documents_fts MATCH ?
        AND ${this.buildSQLFilters(filters)}
        ORDER BY rank
        LIMIT ?
      `).bind(ftsQuery, topK).all();

      // Convert to standardized format
      return results.results.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        abstract: row.abstract,
        authors: JSON.parse(row.authors || '[]'),
        journal: row.journal,
        publication_date: row.publication_date,
        source: row.source,
        score: this.normalizeFTSRank(row.rank),
        snippet: row.snippet,
        relevanceType: 'keyword'
      }));

    } catch (error) {
      console.error('Keyword search error:', error);
      return [];
    }
  },

  /**
   * Perform exact match search
   */
  async performExactMatchSearch(query, env, topK, filters) {
    try {
      // Build exact match query
      const exactTerms = query.toLowerCase().split(/\s+/).map(term => `%${term}%`);

      const results = await env.D1.prepare(`
        SELECT
          id,
          title,
          content,
          abstract,
          authors,
          journal,
          publication_date,
          source,
          (
            (CASE WHEN LOWER(title) LIKE ? THEN 3 ELSE 0 END) +
            (CASE WHEN LOWER(abstract) LIKE ? THEN 2 ELSE 0 END) +
            (CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END)
          ) as exact_score
        FROM documents
        WHERE ${this.buildExactMatchConditions(exactTerms)}
        AND ${this.buildSQLFilters(filters)}
        ORDER BY exact_score DESC, publication_date DESC
        LIMIT ?
      `).bind(
        ...exactTerms.flatMap(term => [term, term, term]),
        topK
      ).all();

      // Convert to standardized format
      return results.results
        .filter(row => row.exact_score > 0)
        .map(row => ({
          id: row.id,
          title: row.title,
          content: row.content,
          abstract: row.abstract,
          authors: JSON.parse(row.authors || '[]'),
          journal: row.journal,
          publication_date: row.publication_date,
          source: row.source,
          score: row.exact_score / 6, // Normalize to 0-1
          relevanceType: 'exact'
        }));

    } catch (error) {
      console.error('Exact match search error:', error);
      return [];
    }
  },

  /**
   * Combine search results with weighted scoring
   */
  combineSearchResults(searchResults, weights, query) {
    const allResults = [];
    const seenIds = new Set();

    // Process each search type
    Object.entries(searchResults).forEach(([type, results]) => {
      const weight = weights[type] || 0;

      results.forEach(result => {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);

          const combinedResult = {
            ...result,
            originalSources: [type],
            scores: {
              [type]: result.score
            },
            combinedScore: result.score * weight
          };

          allResults.push(combinedResult);
        } else {
          // Merge with existing result
          const existing = allResults.find(r => r.id === result.id);
          if (existing) {
            existing.originalSources.push(type);
            existing.scores[type] = result.score;
            existing.combinedScore += result.score * weight;

            // Merge snippet if available
            if (result.snippet && !existing.snippet) {
              existing.snippet = result.snippet;
            }
          }
        }
      });
    });

    // Sort by combined score
    return allResults.sort((a, b) => b.combinedScore - a.combinedScore);
  },

  /**
   * Index document in D1 database
   */
  async indexInD1(document, docId, env, overwrite) {
    try {
      // Check if document exists
      const existing = await env.D1.prepare(
        'SELECT id FROM documents WHERE id = ?'
      ).bind(docId).first();

      const query = existing && !overwrite ?
        `UPDATE documents SET
          title = ?, content = ?, abstract = ?, authors = ?,
          journal = ?, publication_date = ?, source = ?,
          updated_at = datetime('now')
         WHERE id = ?` :
        `INSERT INTO documents (
          id, title, content, abstract, authors,
          journal, publication_date, source,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;

      const params = existing && !overwrite ?
        [document.title, document.content, document.abstract,
         JSON.stringify(document.authors || []), document.journal,
         document.publication_date, document.source, docId] :
        [docId, document.title, document.content, document.abstract,
         JSON.stringify(document.authors || []), document.journal,
         document.publication_date, document.source];

      const result = await env.D1.prepare(query).bind(...params).run();

      // Update FTS index
      await this.updateFTSIndex(docId, document, env);

      return {
        id: docId,
        success: result.success,
        rowsAffected: result.meta.changes,
        operation: existing ? 'updated' : 'inserted'
      };

    } catch (error) {
      console.error('D1 indexing error:', error);
      return {
        id: docId,
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Index document in Vectorize
   */
  async indexInVectorize(document, docId, env, namespace, overwrite) {
    try {
      // Generate embedding
      const content = `${document.title} ${document.abstract || document.content}`.substring(0, 8000);
      const embedding = await this.generateQueryEmbedding(content, env);

      const vectorData = {
        id: docId,
        values: embedding,
        namespace,
        metadata: {
          title: document.title,
          content: document.content?.substring(0, 1000),
          abstract: document.abstract,
          authors: document.authors,
          journal: document.journal,
          publication_date: document.publication_date,
          source: document.source,
          indexed_at: Date.now()
        }
      };

      const result = await env.VECTOR_INDEX.upsert([vectorData]);

      return {
        id: docId,
        success: true,
        vectorsUpserted: 1,
        operation: 'upserted'
      };

    } catch (error) {
      console.error('Vectorize indexing error:', error);
      return {
        id: docId,
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Update FTS index for a document
   */
  async updateFTSIndex(docId, document, env) {
    try {
      await env.D1.prepare(`
        INSERT OR REPLACE INTO documents_fts (
          rowid, id, title, content, abstract, authors, journal, publication_date, source
        ) VALUES (
          (SELECT rowid FROM documents WHERE id = ?),
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        docId, docId, document.title, document.content, document.abstract,
        JSON.stringify(document.authors || []), document.journal,
        document.publication_date, document.source
      ).run();

    } catch (error) {
      console.error('FTS index update error:', error);
    }
  },

  /**
   * Generate query embedding using Workers AI
   */
  async generateQueryEmbedding(query, env) {
    try {
      const response = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: query.trim()
      });
      return response.data[0];
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate query embedding: ${error.message}`);
    }
  },

  /**
   * Build FTS query from user query
   */
  buildFTSQuery(query, filters) {
    let ftsQuery = query;

    // Add quotes for exact phrases
    ftsQuery = ftsQuery.replace(/"([^"]+)"/g, '"$1"');

    // Add boolean operators
    ftsQuery = ftsQuery.replace(/\s+AND\s+/gi, ' AND ');
    ftsQuery = ftsQuery.replace(/\s+OR\s+/gi, ' OR ');
    ftsQuery = ftsQuery.replace(/\s+NOT\s+/gi, ' NOT ');

    return ftsQuery;
  },

  /**
   * Build SQL filters for D1 queries
   */
  buildSQLFilters(filters) {
    const conditions = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'string') {
        conditions.push(`${key} = '${value}'`);
      } else if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(v => `'${v}'`).join(',')})`);
      } else if (typeof value === 'object' && value.min !== undefined) {
        conditions.push(`${key} >= ${value.min}`);
      } else if (typeof value === 'object' && value.max !== undefined) {
        conditions.push(`${key} <= ${value.max}`);
      }
    });

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  },

  /**
   * Build exact match conditions
   */
  buildExactMatchConditions(exactTerms) {
    const conditions = [];

    ['title', 'abstract', 'content'].forEach(field => {
      const fieldConditions = exactTerms.map(term => `LOWER(${field}) LIKE ?`);
      conditions.push(`(${fieldConditions.join(' OR ')})`);
    });

    return `(${conditions.join(' OR ')})`;
  },

  /**
   * Build vector filter for Vectorize
   */
  buildVectorFilter(filters) {
    if (Object.keys(filters).length === 0) {
      return undefined;
    }

    // Convert to Vectorize filter format
    const vectorFilter = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'string') {
        vectorFilter[key] = { $eq: value };
      } else if (Array.isArray(value)) {
        vectorFilter[key] = { $in: value };
      }
    });

    return vectorFilter;
  },

  /**
   * Normalize FTS rank to 0-1 scale
   */
  normalizeFTSRank(rank) {
    // FTS rank typically ranges from 0 to large numbers
    // Using logarithmic normalization
    return Math.min(1, Math.log(rank + 1) / 5);
  },

  /**
   * Generate document ID from content
   */
  generateDocumentId(document) {
    const content = `${document.title}${document.abstract || document.content}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashArray = Array.from(crypto.subtle.digestSync('SHA-256', data));
    return Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  },

  /**
   * Enrich results with additional context
   */
  async enrichResultsWithContext(results, env) {
    for (const result of results.slice(0, 5)) { // Limit to top 5 for performance
      try {
        // Get related documents
        const related = await this.getRelatedDocuments(result.id, 3, env);
        result.relatedDocuments = related;

        // Get citation count if available
        const citationInfo = await this.getCitationInfo(result.id, env);
        result.citationInfo = citationInfo;

      } catch (error) {
        console.error('Context enrichment error:', error);
      }
    }

    return results;
  },

  /**
   * Get related documents
   */
  async getRelatedDocuments(docId, limit, env) {
    // This would be implemented based on your specific data structure
    return [];
  },

  /**
   * Get citation information
   */
  async getCitationInfo(docId, env) {
    // This would be implemented based on your specific data structure
    return { citations: 0 };
  },

  /**
   * Handle search suggestions
   */
  async handleSearchSuggestions(request, env) {
    const { query, limit = 5 } = await request.json();

    // Implementation for search suggestions
    const suggestions = await this.generateSearchSuggestions(query, limit, env);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { 'Content-Type': 'application/json' }
    });
  },

  /**
   * Generate search suggestions
   */
  async generateSearchSuggestions(query, limit, env) {
    // Simple implementation - could be enhanced with ML
    const results = await env.D1.prepare(`
      SELECT DISTINCT title
      FROM documents
      WHERE LOWER(title) LIKE ?
      LIMIT ?
    `).bind(`${query}%`, limit).all();

    return results.results.map(row => row.title);
  }
};