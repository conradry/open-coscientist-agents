/**
 * RAG Pipeline Worker - Vectorize + Workers AI Integration
 * Complete Retrieval-Augmented Generation implementation
 * Based on successful medical research platform patterns
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/rag-query') {
        return this.handleRAGQuery(request, env);
      } else if (path === '/rag-chat') {
        return this.handleRAGChat(request, env);
      } else if (path === '/index-document') {
        return this.handleDocumentIndexing(request, env);
      } else if (path === '/context-retrieval') {
        return this.handleContextRetrieval(request, env);
      } else if (path === '/answer-generation') {
        return this.handleAnswerGeneration(request, env);
      } else if (path === '/citation-analysis') {
        return this.handleCitationAnalysis(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('RAG pipeline worker error:', error);
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
   * Handle RAG query with context retrieval and answer generation
   */
  async handleRAGQuery(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      query,
      context = {},
      retrievalConfig = {
        topK: 5,
        similarityThreshold: 0.7,
        maxContextLength: 4000,
        includeCitations: true
      },
      generationConfig = {
        model: '@cf/meta/llama-3.1-8b-instruct',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: null
      },
      conversationHistory = []
    } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query is required'
      }), { status: 400 });
    }

    try {
      const startTime = Date.now();

      // Step 1: Context Retrieval
      const contextResults = await this.retrieveContext(
        query,
        retrievalConfig,
        context,
        env
      );

      // Step 2: Context Processing and Citation Analysis
      const processedContext = await this.processContextWithCitations(
        contextResults,
        retrievalConfig,
        env
      );

      // Step 3: Answer Generation
      const answerResults = await this.generateAnswer(
        query,
        processedContext,
        generationConfig,
        conversationHistory,
        env
      );

      // Step 4: Post-processing and Quality Assessment
      const finalResponse = await this.postProcessResponse(
        answerResults,
        processedContext,
        query,
        env
      );

      const totalTime = Date.now() - startTime;

      return new Response(JSON.stringify({
        query,
        answer: finalResponse.answer,
        context: processedContext,
        citations: finalResponse.citations,
        confidence: finalResponse.confidence,
        metadata: {
          retrievalTime: contextResults.retrievalTime,
          generationTime: answerResults.generationTime,
          totalTime,
          contextDocuments: processedContext.documents.length,
          model: generationConfig.model,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('RAG query error:', error);
      return new Response(JSON.stringify({
        error: 'RAG query failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle conversational RAG with memory
   */
  async handleRAGChat(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      message,
      sessionId,
      context = {},
      retrievalConfig = {},
      generationConfig = {}
    } = await request.json();

    try {
      // Retrieve conversation history
      const conversationHistory = await this.getConversationHistory(sessionId, env);

      // Perform RAG query with conversation context
      const ragResponse = await this.handleRAGQuery({
        body: JSON.stringify({
          query: message,
          context,
          retrievalConfig,
          generationConfig,
          conversationHistory
        })
      }, env);

      const ragResult = await ragResponse.json();

      // Update conversation history
      await this.updateConversationHistory(sessionId, {
        user: message,
        assistant: ragResult.answer,
        context: ragResult.context,
        timestamp: Date.now()
      }, env);

      // Add conversation metadata
      ragResult.conversation = {
        sessionId,
        turnNumber: conversationHistory.length + 1,
        contextRelevant: ragResult.context.documents.length > 0
      };

      return new Response(JSON.stringify(ragResult), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('RAG chat error:', error);
      return new Response(JSON.stringify({
        error: 'RAG chat failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle document indexing with chunking and metadata
   */
  async handleDocumentIndexing(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      documents,
      chunkingConfig = {
        strategy: 'semantic',
        chunkSize: 1000,
        overlap: 200,
        minChunkSize: 200
      },
      namespace = 'documents',
      extractEntities = true,
      generateSummary = true
    } = await request.json();

    try {
      const indexingResults = {
        totalDocuments: documents.length,
        processedDocuments: 0,
        totalChunks: 0,
        entities: [],
        summaries: [],
        errors: []
      };

      for (const document of documents) {
        try {
          // Process document
          const processedDoc = await this.processDocumentForIndexing(
            document,
            chunkingConfig,
            extractEntities,
            generateSummary,
            env
          );

          // Index chunks in Vectorize
          await this.indexDocumentChunks(processedDoc, namespace, env);

          // Store metadata in D1
          await this.storeDocumentMetadata(processedDoc, env);

          indexingResults.processedDocuments++;
          indexingResults.totalChunks += processedDoc.chunks.length;

          if (extractEntities && processedDoc.entities) {
            indexingResults.entities.push(...processedDoc.entities);
          }

          if (generateSummary && processedDoc.summary) {
            indexingResults.summaries.push({
              documentId: processedDoc.id,
              summary: processedDoc.summary
            });
          }

        } catch (docError) {
          console.error(`Failed to index document ${document.id}:`, docError);
          indexingResults.errors.push({
            documentId: document.id,
            error: docError.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        results: indexingResults
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
   * Retrieve relevant context for query
   */
  async retrieveContext(query, config, additionalContext, env) {
    const startTime = Date.now();

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query, env);

      // Perform vector search
      const searchResults = await env.VECTOR_INDEX.query(queryEmbedding, {
        topK: config.topK * 2, // Get more for filtering
        namespace: additionalContext.namespace || 'documents',
        returnVector: false,
        filter: this.buildContextFilter(additionalContext)
      });

      // Filter and rank results
      const filteredResults = searchResults.matches
        .filter(match => match.score >= config.similarityThreshold)
        .slice(0, config.topK);

      // Get full document content
      const documents = await this.enrichSearchResults(filteredResults, env);

      // Apply context length limits
      const limitedDocuments = this.limitContextLength(
        documents,
        config.maxContextLength
      );

      return {
        documents: limitedDocuments,
        queryEmbedding,
        retrievalTime: Date.now() - startTime,
        totalFound: filteredResults.length,
        returned: limitedDocuments.length
      };

    } catch (error) {
      console.error('Context retrieval error:', error);
      throw new Error(`Context retrieval failed: ${error.message}`);
    }
  },

  /**
   * Process context with citation analysis
   */
  async processContextWithCitations(contextResults, config, env) {
    try {
      const processedDocuments = [];

      for (const doc of contextResults.documents) {
        const processedDoc = {
          ...doc,
          relevanceScore: doc.score,
          citations: [],
          keyPoints: [],
          confidence: 0
        };

        // Extract key points using AI
        if (doc.content && doc.content.length > 100) {
          processedDoc.keyPoints = await this.extractKeyPoints(
            doc.content,
            contextResults.queryEmbedding,
            env
          );
        }

        // Analyze citation quality
        if (config.includeCitations) {
          processedDoc.citations = await this.analyzeCitations(doc, env);
        }

        // Calculate confidence score
        processedDoc.confidence = this.calculateDocumentConfidence(processedDoc);

        processedDocuments.push(processedDoc);
      }

      // Sort by confidence and relevance
      processedDocuments.sort((a, b) =>
        (b.confidence * 0.6 + b.relevanceScore * 0.4) -
        (a.confidence * 0.6 + a.relevanceScore * 0.4)
      );

      return {
        documents: processedDocuments,
        aggregatedContext: this.buildAggregatedContext(processedDocuments),
        qualityScore: this.calculateOverallQuality(processedDocuments)
      };

    } catch (error) {
      console.error('Context processing error:', error);
      throw new Error(`Context processing failed: ${error.message}`);
    }
  },

  /**
   * Generate answer using retrieved context
   */
  async generateAnswer(query, processedContext, config, conversationHistory, env) {
    const startTime = Date.now();

    try {
      // Build prompt with context
      const prompt = this.buildRAGPrompt(
        query,
        processedContext.aggregatedContext,
        processedContext.documents,
        conversationHistory,
        config.systemPrompt
      );

      // Generate answer using Workers AI
      const response = await env.AI.run(config.model, {
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      });

      // Extract answer and reasoning
      const answer = response.response || '';
      const reasoning = this.extractReasoning(answer);

      return {
        answer: this.cleanAnswer(answer),
        reasoning,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        generationTime: Date.now() - startTime,
        model: config.model
      };

    } catch (error) {
      console.error('Answer generation error:', error);
      throw new Error(`Answer generation failed: ${error.message}`);
    }
  },

  /**
   * Process document for indexing with chunking
   */
  async processDocumentForIndexing(document, chunkingConfig, extractEntities, generateSummary, env) {
    try {
      const processedDoc = {
        id: document.id || this.generateId(),
        title: document.title,
        content: document.content,
        abstract: document.abstract,
        metadata: {
          ...document.metadata,
          source: document.source || 'unknown',
          authors: document.authors || [],
          publication_date: document.publication_date,
          journal: document.journal,
          indexed_at: Date.now()
        },
        chunks: [],
        entities: [],
        summary: null
      };

      // Generate chunks based on strategy
      processedDoc.chunks = await this.generateChunks(
        document.content,
        chunkingConfig,
        env
      );

      // Extract entities if requested
      if (extractEntities) {
        processedDoc.entities = await this.extractEntities(document, env);
      }

      // Generate summary if requested
      if (generateSummary) {
        processedDoc.summary = await this.generateDocumentSummary(document, env);
      }

      return processedDoc;

    } catch (error) {
      console.error('Document processing error:', error);
      throw error;
    }
  },

  /**
   * Generate chunks from document content
   */
  async generateChunks(content, config, env) {
    const chunks = [];

    switch (config.strategy) {
      case 'semantic':
        return await this.generateSemanticChunks(content, config, env);

      case 'fixed_size':
        return this.generateFixedSizeChunks(content, config);

      case 'paragraph':
        return this.generateParagraphChunks(content, config);

      case 'sentence':
        return this.generateSentenceChunks(content, config);

      default:
        return this.generateFixedSizeChunks(content, config);
    }
  },

  /**
   * Generate semantic chunks using AI
   */
  async generateSemanticChunks(content, config, env) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Split the following text into meaningful semantic chunks. Each chunk should be coherent and self-contained. Return as JSON array of strings.'
          },
          {
            role: 'user',
            content: `Text to chunk: ${content.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const chunkTexts = JSON.parse(response.response || '[]');
      const chunks = [];

      chunkTexts.forEach((chunkText, index) => {
        if (chunkText.length >= config.minChunkSize) {
          chunks.push({
            id: `chunk_${index}`,
            content: chunkText,
            index: index,
            wordCount: chunkText.split(/\s+/).length
          });
        }
      });

      return chunks;

    } catch (error) {
      console.error('Semantic chunking failed, falling back to fixed-size:', error);
      return this.generateFixedSizeChunks(content, config);
    }
  },

  /**
   * Generate fixed-size chunks
   */
  generateFixedSizeChunks(content, config) {
    const chunks = [];
    const words = content.split(/\s+/);

    for (let i = 0; i < words.length; i += config.chunkSize - config.overlap) {
      const chunkWords = words.slice(i, i + config.chunkSize);
      const chunkText = chunkWords.join(' ');

      if (chunkText.length >= config.minChunkSize) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          content: chunkText,
          index: chunks.length,
          wordCount: chunkWords.length
        });
      }
    }

    return chunks;
  },

  /**
   * Generate paragraph-based chunks
   */
  generateParagraphChunks(content, config) {
    const paragraphs = content.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > config.chunkSize && currentChunk) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          index: chunkIndex,
          wordCount: currentChunk.split(/\s+/).length
        });
        currentChunk = paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        index: chunkIndex,
        wordCount: currentChunk.split(/\s+/).length
      });
    }

    return chunks.filter(chunk => chunk.content.length >= config.minChunkSize);
  },

  /**
   * Generate sentence-based chunks
   */
  generateSentenceChunks(content, config) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence.trim() + '.';

      if (testChunk.length > config.chunkSize && currentChunk) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          index: chunkIndex,
          wordCount: currentChunk.split(/\s+/).length
        });
        currentChunk = sentence.trim() + '.';
        chunkIndex++;
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        index: chunkIndex,
        wordCount: currentChunk.split(/\s+/).length
      });
    }

    return chunks.filter(chunk => chunk.content.length >= config.minChunkSize);
  },

  /**
   * Extract entities from document
   */
  async extractEntities(document, env) {
    try {
      const text = `${document.title} ${document.abstract || document.content}`.substring(0, 2000);

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Extract key entities from the text. Return as JSON array with objects containing: text, type, confidence. Types include: person, organization, location, date, concept, medical_term.'
          },
          {
            role: 'user',
            content: `Text: ${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      return JSON.parse(response.response || '[]');

    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  },

  /**
   * Generate document summary
   */
  async generateDocumentSummary(document, env) {
    try {
      const text = `${document.title} ${document.abstract || document.content}`.substring(0, 4000);

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Generate a concise summary of the text in 2-3 sentences, focusing on the main points and findings.'
          },
          {
            role: 'user',
            content: `Text to summarize: ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return response.response || '';

    } catch (error) {
      console.error('Summary generation failed:', error);
      return '';
    }
  },

  /**
   * Build RAG prompt
   */
  buildRAGPrompt(query, context, documents, conversationHistory, systemPrompt) {
    const contextText = documents.map((doc, index) =>
      `[Document ${index + 1}] ${doc.title}\n${doc.content.substring(0, 1000)}...`
    ).join('\n\n');

    const conversationContext = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return {
      system: systemPrompt || `You are a helpful AI assistant. Use the provided context to answer the user's question accurately.
        If the context doesn't contain enough information to answer the question, say so.
        Cite the relevant sources in your answer using [Document X] notation.`,
      user: `Context:\n${contextText}\n\nPrevious conversation:\n${conversationContext}\n\nQuestion: ${query}`
    };
  },

  /**
   * Generate query embedding
   */
  async generateQueryEmbedding(query, env) {
    const response = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
      text: query.trim()
    });
    return response.data[0];
  },

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomUUID();
  },

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};