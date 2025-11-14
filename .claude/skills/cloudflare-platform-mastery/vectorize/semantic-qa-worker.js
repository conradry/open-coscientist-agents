/**
 * Semantic Question Answering Worker
 * Advanced QA with context understanding and answer quality assessment
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/ask') {
        return this.handleQuestionAnswering(request, env);
      } else if (path === '/batch-ask') {
        return this.handleBatchQuestioning(request, env);
      } else if (path === '/answer-validation') {
        return this.handleAnswerValidation(request, env);
      } else if (path === '/question-clustering') {
        return this.handleQuestionClustering(request, env);
      } else if (path === '/answer-quality') {
        return this.handleAnswerQualityAssessment(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Semantic QA worker error:', error);
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
   * Handle single question answering with semantic context
   */
  async handleQuestionAnswering(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      question,
      context = {},
      config = {
        retrievalStrategy: 'hybrid',
        answerStyle: 'comprehensive',
        includeConfidence: true,
        includeSources: true,
        maxAnswerLength: 500
      },
      domain = 'general'
    } = await request.json();

    if (!question) {
      return new Response(JSON.stringify({
        error: 'Question is required'
      }), { status: 400 });
    }

    try {
      const startTime = Date.now();

      // Step 1: Question Analysis
      const questionAnalysis = await this.analyzeQuestion(question, domain, env);

      // Step 2: Context Retrieval
      const retrievedContext = await this.retrieveRelevantContext(
        question,
        questionAnalysis,
        context,
        config.retrievalStrategy,
        env
      );

      // Step 3: Answer Generation
      const answerGeneration = await this.generateAnswer(
        question,
        questionAnalysis,
        retrievedContext,
        config,
        env
      );

      // Step 4: Answer Quality Assessment
      const qualityAssessment = await this.assessAnswerQuality(
        answerGeneration.answer,
        question,
        retrievedContext,
        env
      );

      // Step 5: Source Attribution
      const sourceAttribution = await this.attributeSources(
        answerGeneration.answer,
        retrievedContext.documents,
        env
      );

      const totalTime = Date.now() - startTime;

      const response = {
        question,
        answer: answerGeneration.answer,
        questionAnalysis: {
          type: questionAnalysis.type,
          intent: questionAnalysis.intent,
          entities: questionAnalysis.entities,
          complexity: questionAnalysis.complexity
        },
        context: {
          documents: retrievedContext.documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            relevanceScore: doc.score
          })),
          retrievalStrategy: config.retrievalStrategy
        },
        quality: {
          confidence: qualityAssessment.confidence,
          accuracy: qualityAssessment.accuracy,
          completeness: qualityAssessment.completeness,
          clarity: qualityAssessment.clarity
        },
        sources: sourceAttribution,
        metadata: {
          processingTime: totalTime,
          domain,
          answerStyle: config.answerStyle,
          model: answerGeneration.model
        }
      };

      // Add optional fields based on config
      if (config.includeConfidence) {
        response.confidence = qualityAssessment.confidence;
      }

      if (config.includeSources) {
        response.detailedSources = retrievedContext.documents;
      }

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Question answering error:', error);
      return new Response(JSON.stringify({
        error: 'Question answering failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Handle batch question processing
   */
  async handleBatchQuestioning(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const {
      questions,
      config = {},
      domain = 'general',
      parallelProcessing = true
    } = await request.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({
        error: 'Questions array is required'
      }), { status: 400 });
    }

    try {
      const batchResults = {
        totalQuestions: questions.length,
        processed: 0,
        failed: 0,
        results: [],
        errors: [],
        totalTime: 0
      };

      const startTime = Date.now();

      if (parallelProcessing && questions.length <= 10) {
        // Process in parallel
        const promises = questions.map((q, index) =>
          this.processSingleQuestion(q, index, config, domain, env)
            .catch(error => ({
              questionIndex: index,
              question: q,
              error: error.message
            }))
        );

        const results = await Promise.all(promises);

        results.forEach(result => {
          if (result.error) {
            batchResults.failed++;
            batchResults.errors.push(result);
          } else {
            batchResults.processed++;
            batchResults.results.push(result);
          }
        });

      } else {
        // Process sequentially
        for (let i = 0; i < questions.length; i++) {
          try {
            const result = await this.processSingleQuestion(
              questions[i],
              i,
              config,
              domain,
              env
            );
            batchResults.processed++;
            batchResults.results.push(result);
          } catch (error) {
            batchResults.failed++;
            batchResults.errors.push({
              questionIndex: i,
              question: questions[i],
              error: error.message
            });
          }

          // Add delay to prevent rate limiting
          if (i < questions.length - 1) {
            await this.sleep(100);
          }
        }
      }

      batchResults.totalTime = Date.now() - startTime;
      batchResults.averageTime = batchResults.totalTime / questions.length;

      return new Response(JSON.stringify(batchResults), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Batch questioning error:', error);
      return new Response(JSON.stringify({
        error: 'Batch questioning failed',
        message: error.message
      }), { status: 500 });
    }
  },

  /**
   * Analyze question type, intent, and entities
   */
  async analyzeQuestion(question, domain, env) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: `Analyze the question and return a JSON object with:
            - type: (factual, conceptual, procedural, comparative, evaluative)
            - intent: (define, explain, compare, evaluate, recommend, analyze)
            - entities: array of key entities mentioned
            - complexity: (simple, moderate, complex)
            - domain: specific domain if identifiable`
          },
          {
            role: 'user',
            content: `Question: ${question}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.response || '{}');

      return {
        type: analysis.type || 'factual',
        intent: analysis.intent || 'explain',
        entities: analysis.entities || [],
        complexity: analysis.complexity || 'moderate',
        domain: analysis.domain || domain
      };

    } catch (error) {
      console.error('Question analysis failed:', error);
      return {
        type: 'factual',
        intent: 'explain',
        entities: [],
        complexity: 'moderate',
        domain: domain
      };
    }
  },

  /**
   * Retrieve relevant context for question
   */
  async retrieveRelevantContext(question, questionAnalysis, context, strategy, env) {
    try {
      const queries = this.buildRetrievalQueries(question, questionAnalysis);
      const allResults = [];

      for (const query of queries) {
        const results = await this.performContextRetrieval(query, context, env);
        allResults.push(...results);
      }

      // Remove duplicates and rank
      const uniqueResults = this.deduplicateResults(allResults);
      const rankedResults = this.rankContextResults(uniqueResults, question, questionAnalysis);

      return {
        documents: rankedResults.slice(0, 10),
        queries: queries,
        strategy: strategy
      };

    } catch (error) {
      console.error('Context retrieval failed:', error);
      return {
        documents: [],
        queries: [],
        strategy: strategy
      };
    }
  },

  /**
   * Generate answer based on question and context
   */
  async generateAnswer(question, questionAnalysis, retrievedContext, config, env) {
    try {
      const contextText = this.buildContextText(retrievedContext.documents);
      const systemPrompt = this.buildAnswerSystemPrompt(questionAnalysis, config.answerStyle, config.domain);

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Question: ${question}\n\nContext: ${contextText}`
          }
        ],
        temperature: 0.3,
        max_tokens: config.maxAnswerLength || 500
      });

      return {
        answer: response.response || '',
        model: '@cf/meta/llama-3.1-8b-instruct',
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('Answer generation failed:', error);
      return {
        answer: 'I apologize, but I was unable to generate an answer based on the available context.',
        model: 'failed',
        tokensUsed: 0
      };
    }
  },

  /**
   * Assess answer quality
   */
  async assessAnswerQuality(answer, question, retrievedContext, env) {
    try {
      const contextText = retrievedContext.documents.map(doc => doc.content).join('\n\n');

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Assess the quality of the answer based on the question and context. Return a JSON object with confidence (0-1), accuracy (0-1), completeness (0-1), and clarity (0-1), plus a brief explanation.'
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nContext: ${contextText.substring(0, 2000)}...\n\nAnswer: ${answer}`
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const assessment = JSON.parse(response.response || '{}');

      return {
        confidence: assessment.confidence || 0.5,
        accuracy: assessment.accuracy || 0.5,
        completeness: assessment.completeness || 0.5,
        clarity: assessment.clarity || 0.5,
        explanation: assessment.explanation || ''
      };

    } catch (error) {
      console.error('Quality assessment failed:', error);
      return {
        confidence: 0.5,
        accuracy: 0.5,
        completeness: 0.5,
        clarity: 0.5,
        explanation: 'Quality assessment failed'
      };
    }
  },

  /**
   * Attribute sources used in answer
   */
  async attributeSources(answer, documents, env) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Analyze which documents from the provided context were used to generate the answer. Return a JSON array with document indices and relevance scores (0-1).'
          },
          {
            role: 'user',
            content: `Answer: ${answer}\n\nDocuments:\n${documents.map((doc, i) => `[${i}] ${doc.title}: ${doc.content.substring(0, 500)}...`).join('\n\n')}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      });

      const attribution = JSON.parse(response.response || '[]');

      return attribution.map(attr => ({
        documentIndex: attr.documentIndex || 0,
        relevanceScore: attr.relevanceScore || 0.5,
        document: documents[attr.documentIndex || 0]
      }));

    } catch (error) {
      console.error('Source attribution failed:', error);
      return documents.map((doc, index) => ({
        documentIndex: index,
        relevanceScore: 0.5,
        document: doc
      }));
    }
  },

  /**
   * Process single question in batch
   */
  async processSingleQuestion(question, index, config, domain, env) {
    const mockRequest = {
      json: async () => ({
        question,
        config,
        domain
      })
    };

    const response = await this.handleQuestionAnswering(mockRequest, env);
    const result = await response.json();

    return {
      questionIndex: index,
      question: question,
      ...result
    };
  },

  /**
   * Build retrieval queries based on question analysis
   */
  buildRetrievalQueries(question, questionAnalysis) {
    const queries = [question];

    // Add entity-based queries
    if (questionAnalysis.entities && questionAnalysis.entities.length > 0) {
      questionAnalysis.entities.forEach(entity => {
        queries.push(`${entity} ${questionAnalysis.intent}`);
      });
    }

    // Add domain-specific query variations
    if (questionAnalysis.domain && questionAnalysis.domain !== 'general') {
      queries.push(`${questionAnalysis.domain} ${question}`);
    }

    return queries.slice(0, 3); // Limit to prevent too many queries
  },

  /**
   * Perform context retrieval
   */
  async performContextRetrieval(query, context, env) {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query, env);

      // Search Vectorize
      const searchResults = await env.VECTOR_INDEX.query(queryEmbedding, {
        topK: 5,
        namespace: context.namespace || 'documents',
        returnVector: false
      });

      // Convert to document format
      return searchResults.matches.map(match => ({
        id: match.id,
        title: match.metadata?.title || '',
        content: match.metadata?.content || '',
        score: match.score,
        metadata: match.metadata
      }));

    } catch (error) {
      console.error('Context retrieval error:', error);
      return [];
    }
  },

  /**
   * Deduplicate search results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.id)) {
        return false;
      }
      seen.add(result.id);
      return true;
    });
  },

  /**
   * Rank context results
   */
  rankContextResults(results, question, questionAnalysis) {
    return results.sort((a, b) => {
      // Primary sort by relevance score
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score;
      }

      // Secondary sort by recency if available
      const aDate = new Date(a.metadata?.publication_date || 0);
      const bDate = new Date(b.metadata?.publication_date || 0);
      return bDate - aDate;
    });
  },

  /**
   * Build context text for answer generation
   */
  buildContextText(documents) {
    return documents.map((doc, index) =>
      `[Document ${index + 1}] ${doc.title}\n${doc.content.substring(0, 1000)}...`
    ).join('\n\n');
  },

  /**
   * Build answer system prompt
   */
  buildAnswerSystemPrompt(questionAnalysis, answerStyle, domain) {
    let prompt = `You are a knowledgeable assistant specializing in ${domain}. `;

    switch (questionAnalysis.type) {
      case 'factual':
        prompt += 'Provide accurate, factual information with specific details. ';
        break;
      case 'conceptual':
        prompt += 'Explain concepts clearly with definitions and examples. ';
        break;
      case 'procedural':
        prompt += 'Provide step-by-step instructions and explanations. ';
        break;
      case 'comparative':
        prompt += 'Compare and contrast different aspects systematically. ';
        break;
      case 'evaluative':
        prompt += 'Provide balanced analysis with pros and cons. ';
        break;
    }

    switch (answerStyle) {
      case 'comprehensive':
        prompt += 'Be thorough and detailed in your response. ';
        break;
      case 'concise':
        prompt += 'Be brief and to the point. ';
        break;
      case 'educational':
        prompt += 'Use clear explanations and helpful examples. ';
        break;
      case 'technical':
        prompt += 'Use precise technical language and terminology. ';
        break;
    }

    prompt += 'Base your answer on the provided context and cite sources using [Document X] notation.';

    return prompt;
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
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};