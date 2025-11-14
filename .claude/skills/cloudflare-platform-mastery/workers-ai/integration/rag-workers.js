/**
 * Retrieval-Augmented Generation (RAG) Workers
 *
 * Combines vector search with AI generation for knowledge-based responses
 */

import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const ai = new Ai(env.AI);

    try {
      const url = new URL(request.url);
      const { pathname } = url;

      switch (pathname) {
        case '/rag/query':
          return await handleRAGQuery(request, ai, env);
        case '/rag/ingest':
          return await handleDocumentIngestion(request, ai, env);
        case '/rag/batch-query':
          return await handleBatchRAGQuery(request, ai, env);
        case '/rag/analyze':
          return await handleDocumentAnalysis(request, ai, env);
        case '/rag/summarize':
          return await handleDocumentSummarization(request, ai, env);
        case '/rag/chat':
          return await handleRAGChat(request, ai, env);
        default:
          return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      console.error('RAG Error:', error);
      return Response.json({
        error: 'RAG service temporarily unavailable',
        message: error.message
      }, { status: 500 });
    }
  }
};

/**
 * Handle RAG query requests
 */
async function handleRAGQuery(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    query,
    collection = 'default',
    topK = 5,
    temperature = 0.7,
    maxTokens = 2048,
    includeSources = true,
    filters = {},
    promptTemplate = null,
    responseFormat = 'json'
  } = await request.json();

  // Validate input
  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    // Generate response using RAG
    const response = await ragEngine.generateResponse(query, {
      collection,
      topK,
      temperature,
      maxTokens,
      includeSources,
      filters,
      promptTemplate
    });

    return Response.json(response, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return Response.json({
      error: 'RAG query failed',
      message: error.message,
      query
    }, { status: 500 });
  }
}

/**
 * Handle document ingestion for RAG
 */
async function handleDocumentIngestion(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    documents,
    collection = 'default',
    chunkSize = 500,
    overlap = 50,
    extractMetadata = true,
    preprocessText = true
  } = await request.json();

  if (!Array.isArray(documents) || documents.length === 0) {
    return Response.json({ error: 'Documents array is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    const results = await ragEngine.ingestDocuments(documents, {
      collection,
      chunkSize,
      overlap,
      extractMetadata,
      preprocessText
    });

    return Response.json({
      success: true,
      processed: documents.length,
      results
    });

  } catch (error) {
    return Response.json({
      error: 'Document ingestion failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle batch RAG queries
 */
async function handleBatchRAGQuery(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    queries,
    collection = 'default',
    topK = 3,
    temperature = 0.7,
    maxTokens = 1024,
    concurrency = 3
  } = await request.json();

  if (!Array.isArray(queries) || queries.length === 0) {
    return Response.json({ error: 'Queries array is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    const results = await ragEngine.batchQuery(queries, {
      collection,
      topK,
      temperature,
      maxTokens,
      concurrency
    });

    return Response.json({
      success: true,
      totalQueries: queries.length,
      results
    });

  } catch (error) {
    return Response.json({
      error: 'Batch RAG query failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle document analysis
 */
async function handleDocumentAnalysis(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    documentIds,
    collection = 'default',
    analysisType = 'summary',
    includeMetadata = true
  } = await request.json();

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return Response.json({ error: 'Document IDs array is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    const analysis = await ragEngine.analyzeDocuments(documentIds, {
      collection,
      analysisType,
      includeMetadata
    });

    return Response.json(analysis);

  } catch (error) {
    return Response.json({
      error: 'Document analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle document summarization
 */
async function handleDocumentSummarization(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    documentIds,
    collection = 'default',
    summaryType = 'comprehensive',
    maxLength = 500,
    focusAreas = []
  } = await request.json();

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return Response.json({ error: 'Document IDs array is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    const summary = await ragEngine.summarizeDocuments(documentIds, {
      collection,
      summaryType,
      maxLength,
      focusAreas
    });

    return Response.json(summary);

  } catch (error) {
    return Response.json({
      error: 'Document summarization failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle RAG chat with context
 */
async function handleRAGChat(request, ai, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    messages,
    collection = 'default',
    sessionId,
    topK = 5,
    temperature = 0.7,
    maxTokens = 2048,
    systemPrompt = null
  } = await request.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Messages array is required' }, { status: 400 });
  }

  const ragEngine = new RAGEngine(ai, env.VECTORIZE_INDEX, env);

  try {
    const response = await ragEngine.chatWithContext(messages, {
      collection,
      sessionId,
      topK,
      temperature,
      maxTokens,
      systemPrompt
    });

    return Response.json(response);

  } catch (error) {
    return Response.json({
      error: 'RAG chat failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * RAG Engine - Core implementation
 */
export class RAGEngine {
  constructor(ai, vectorizeIndex, env) {
    this.ai = ai;
    this.index = vectorizeIndex;
    this.env = env;
    this.promptTemplates = new Map();
    this.conversationHistory = new Map();
    this.initializePromptTemplates();
  }

  /**
   * Initialize prompt templates
   */
  initializePromptTemplates() {
    this.promptTemplates.set('qa', `
Answer the following question based on the provided context.

Context:
{context}

Question: {question}

Instructions:
- Use only the information provided in the context
- If the context doesn't contain the answer, say "I don't have enough information to answer that question"
- Provide a clear and concise answer
- Include relevant quotes or references from the context when possible

Answer:`);

    this.promptTemplates.set('analysis', `
Analyze the following information based on the provided context.

Context:
{context}

Analysis Request: {question}

Instructions:
- Provide a detailed analysis using the context information
- Consider different perspectives and implications
- Structure your analysis logically
- Support your conclusions with evidence from the context

Analysis:`);

    this.promptTemplates.set('creative', `
Generate a creative response based on the following context.

Context:
{context}

Creative Request: {question}

Instructions:
- Use the context as inspiration for your response
- Be creative and engaging
- Expand upon ideas presented in the context
- Maintain coherence while being imaginative

Response:`);

    this.promptTemplates.set('summarization', `
Summarize the following information based on the provided context.

Context:
{context}

Summarization Request: {question}

Instructions:
- Extract the most important information from the context
- Organize key points logically
- Keep the summary concise but comprehensive
- Focus on the main themes and conclusions

Summary:`);
  }

  /**
   * Generate RAG response
   */
  async generateResponse(query, options = {}) {
    const {
      collection = 'default',
      topK = 5,
      temperature = 0.7,
      maxTokens = 2048,
      includeSources = true,
      filters = {},
      promptTemplate = 'qa'
    } = options;

    // Retrieve relevant documents
    const retrievedDocs = await this.retrieveDocuments(query, {
      collection,
      topK,
      filters
    });

    if (retrievedDocs.length === 0) {
      return {
        query,
        response: "I don't have relevant information to answer your question.",
        sources: [],
        retrievalScore: 0
      };
    }

    // Build context from retrieved documents
    const context = this.buildContext(retrievedDocs);

    // Generate prompt
    const prompt = this.buildPrompt(query, context, promptTemplate);

    // Generate response using AI
    const aiResponse = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
      prompt,
      max_tokens: maxTokens,
      temperature
    });

    const response = aiResponse.response || '';

    // Format response
    const result = {
      query,
      response,
      sources: includeSources ? retrievedDocs : [],
      retrievalScore: this.calculateRetrievalScore(retrievedDocs),
      metadata: {
        documentsUsed: retrievedDocs.length,
        model: '@cf/meta/llama-3-8b-instruct',
        promptLength: prompt.length,
        responseLength: response.length
      }
    };

    return result;
  }

  /**
   * Retrieve relevant documents
   */
  async retrieveDocuments(query, options = {}) {
    const {
      collection = 'default',
      topK = 5,
      filters = {}
    } = options;

    try {
      // Generate query embedding
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Search in Vectorize
      const searchResults = await this.index.query(embedding, {
        topK,
        namespace: collection,
        includeMetadata: true,
        filter: filters
      });

      return searchResults.matches.map(match => ({
        id: match.id,
        content: match.metadata?.chunkText || match.metadata?.text || '',
        metadata: match.metadata || {},
        score: match.score,
        documentId: match.metadata?.documentId || match.id.split('_chunk_')[0]
      }));

    } catch (error) {
      console.error('Document retrieval error:', error);
      return [];
    }
  }

  /**
   * Build context from retrieved documents
   */
  buildContext(documents) {
    return documents.map((doc, index) => {
      const docInfo = doc.metadata.documentId ? `[Document: ${doc.metadata.documentId}]` : `[Source: ${index + 1}]`;
      return `${docInfo}\n${doc.content}`;
    }).join('\n\n');
  }

  /**
   * Build prompt for AI generation
   */
  buildPrompt(query, context, templateType) {
    const template = this.promptTemplates.get(templateType) || this.promptTemplates.get('qa');

    return template
      .replace('{context}', context)
      .replace('{question}', query);
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
        text: text.trim().substring(0, 8000)
      });

      return response.data[0];
    } catch (error) {
      console.error('Embedding generation error:', error);
      return null;
    }
  }

  /**
   * Calculate retrieval quality score
   */
  calculateRetrievalScore(documents) {
    if (documents.length === 0) return 0;

    const averageScore = documents.reduce((sum, doc) => sum + doc.score, 0) / documents.length;
    const diversityPenalty = Math.max(0, (documents.length - 5) * 0.05);

    return Math.max(0, averageScore - diversityPenalty);
  }

  /**
   * Ingest documents into RAG system
   */
  async ingestDocuments(documents, options = {}) {
    const {
      collection = 'default',
      chunkSize = 500,
      overlap = 50,
      extractMetadata = true,
      preprocessText = true
    } = options;

    const results = [];

    for (const doc of documents) {
      try {
        const processedDoc = await this.processDocument(doc, {
          chunkSize,
          overlap,
          extractMetadata,
          preprocessText
        });

        // Generate embeddings and index
        const vectors = [];
        for (const chunk of processedDoc.chunks) {
          const embedding = await this.generateEmbedding(chunk.text);
          if (embedding) {
            vectors.push({
              id: chunk.id,
              values: embedding,
              metadata: {
                ...processedDoc.metadata,
                ...chunk.metadata,
                collection,
                ingestedAt: new Date().toISOString()
              }
            });
          }
        }

        // Index in batches
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          await this.index.upsert(batch, { namespace: collection });
        }

        results.push({
          documentId: doc.id,
          chunksIndexed: vectors.length,
          success: true
        });

      } catch (error) {
        results.push({
          documentId: doc.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Process document for ingestion
   */
  async processDocument(doc, options = {}) {
    const {
      chunkSize = 500,
      overlap = 50,
      extractMetadata = true,
      preprocessText = true
    } = options;

    let content = doc.content || doc.text || '';
    let metadata = doc.metadata || {};

    // Preprocess text
    if (preprocessText) {
      content = this.preprocessText(content);
    }

    // Extract metadata
    if (extractMetadata && !metadata.extracted) {
      metadata = { ...metadata, ...await this.extractMetadata(content) };
    }

    // Split into chunks
    const chunks = this.chunkText(content, doc.id, chunkSize, overlap);

    return {
      id: doc.id,
      content,
      metadata,
      chunks
    };
  }

  /**
   * Preprocess text content
   */
  preprocessText(text) {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
  }

  /**
   * Extract metadata from text
   */
  async extractMetadata(text) {
    const metadata = {};

    // Basic text statistics
    metadata.wordCount = text.split(/\s+/).length;
    metadata.charCount = text.length;
    metadata.estimatedReadingTime = Math.ceil(metadata.wordCount / 200);

    // Language detection (simplified)
    metadata.language = this.detectLanguage(text);

    // Extract potential entities (simplified)
    metadata.potentialEntities = this.extractEntities(text);

    return metadata;
  }

  /**
   * Detect text language
   */
  detectLanguage(text) {
    // Simplified language detection based on common words
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no'];
    const frenchWords = ['le', 'de', 'et', 'est', 'dans', 'les', 'pour', 'que', 'une', 'avec'];

    const words = text.toLowerCase().split(/\s+/);
    const englishScore = words.filter(w => englishWords.includes(w)).length;
    const spanishScore = words.filter(w => spanishWords.includes(w)).length;
    const frenchScore = words.filter(w => frenchWords.includes(w)).length;

    if (englishScore > spanishScore && englishScore > frenchScore) return 'english';
    if (spanishScore > englishScore && spanishScore > frenchScore) return 'spanish';
    if (frenchScore > englishScore && frenchScore > spanishScore) return 'french';

    return 'unknown';
  }

  /**
   * Extract potential entities (simplified)
   */
  extractEntities(text) {
    const entities = {
      dates: text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [],
      emails: text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [],
      urls: text.match(/https?:\/\/[^\s]+/g) || [],
      phoneNumbers: text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || []
    };

    return entities;
  }

  /**
   * Split text into chunks
   */
  chunkText(text, documentId, chunkSize, overlap) {
    const chunks = [];
    const words = text.split(' ');

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(' ').trim();

      if (chunkText.length > 0) {
        chunks.push({
          id: `${documentId}_chunk_${chunks.length}`,
          text: chunkText,
          metadata: {
            documentId,
            chunkIndex: chunks.length,
            chunkStart: i,
            chunkEnd: Math.min(i + chunkSize, words.length),
            totalChunks: Math.ceil(words.length / (chunkSize - overlap))
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Process batch queries
   */
  async batchQuery(queries, options = {}) {
    const {
      collection = 'default',
      topK = 3,
      temperature = 0.7,
      maxTokens = 1024,
      concurrency = 3
    } = options;

    const results = [];

    // Process queries in batches
    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency);

      const batchPromises = batch.map(async (query, index) => {
        try {
          const response = await this.generateResponse(query, {
            collection,
            topK,
            temperature,
            maxTokens
          });

          return {
            queryIndex: i + index,
            query,
            success: true,
            response
          };

        } catch (error) {
          return {
            queryIndex: i + index,
            query,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Analyze documents
   */
  async analyzeDocuments(documentIds, options = {}) {
    const {
      collection = 'default',
      analysisType = 'summary',
      includeMetadata = true
    } = options;

    // Retrieve documents
    const documents = [];
    for (const docId of documentIds) {
      const docs = await this.retrieveDocuments(`document:${docId}`, {
        collection,
        topK: 10
      });
      documents.push(...docs);
    }

    if (documents.length === 0) {
      throw new Error('No documents found for analysis');
    }

    // Build context
    const context = this.buildContext(documents);

    // Generate analysis prompt
    const analysisPrompt = this.getAnalysisPrompt(analysisType, context);

    // Generate analysis
    const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
      prompt: analysisPrompt,
      max_tokens: 2048,
      temperature: 0.5
    });

    const analysis = response.response || '';

    return {
      documentIds,
      analysisType,
      analysis,
      documentsUsed: documents.length,
      metadata: includeMetadata ? documents.map(d => d.metadata) : undefined
    };
  }

  /**
   * Get analysis prompt based on type
   */
  getAnalysisPrompt(analysisType, context) {
    const prompts = {
      summary: `
Summarize the key information from the following documents:

Context:
${context}

Provide a comprehensive summary that covers the main points and findings.`,

      themes: `
Identify the main themes and topics in the following documents:

Context:
${context}

List and explain the major themes that emerge from this content.`,

      insights: `
Extract key insights and implications from the following documents:

Context:
${context}

What are the most important insights and what do they imply?`,

      comparison: `
Compare and contrast the information in the following documents:

Context:
${context}

What are the similarities, differences, and relationships between the content?`
    };

    return prompts[analysisType] || prompts.summary;
  }

  /**
   * Summarize multiple documents
   */
  async summarizeDocuments(documentIds, options = {}) {
    const {
      collection = 'default',
      summaryType = 'comprehensive',
      maxLength = 500,
      focusAreas = []
    } = options;

    // Use the analysis method with summary type
    const analysis = await this.analyzeDocuments(documentIds, {
      collection,
      analysisType: 'summary'
    });

    // If focus areas specified, create focused summary
    if (focusAreas.length > 0) {
      const focusedPrompt = `
Based on the following document analysis, provide a summary focusing specifically on: ${focusAreas.join(', ')}.

Analysis:
${analysis.analysis}

Focused Summary (max ${maxLength} words):`;

      const focusedResponse = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
        prompt: focusedPrompt,
        max_tokens: maxLength * 2,
        temperature: 0.5
      });

      analysis.focusedSummary = focusedResponse.response;
    }

    return {
      ...analysis,
      summaryType,
      maxLength,
      focusAreas
    };
  }

  /**
   * Chat with context
   */
  async chatWithContext(messages, options = {}) {
    const {
      collection = 'default',
      sessionId,
      topK = 5,
      temperature = 0.7,
      maxTokens = 2048,
      systemPrompt = 'You are a helpful AI assistant that answers questions based on provided context.'
    } = options;

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // Retrieve relevant context
    const retrievedDocs = await this.retrieveDocuments(lastMessage.content, {
      collection,
      topK
    });

    // Build conversation history
    let conversationHistory = '';
    if (sessionId && this.conversationHistory.has(sessionId)) {
      const history = this.conversationHistory.get(sessionId);
      conversationHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\n\n';
    }

    // Build context
    const context = this.buildContext(retrievedDocs);

    // Build chat prompt
    const chatPrompt = `${systemPrompt}

Conversation History:
${conversationHistory}

Relevant Context:
${context}

Current Question: ${lastMessage.content}

Provide a helpful response based on the conversation and context:`;

    // Generate response
    const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
      prompt: chatPrompt,
      max_tokens: maxTokens,
      temperature
    });

    const aiResponse = response.response || '';

    // Update conversation history
    if (sessionId) {
      const history = this.conversationHistory.get(sessionId) || [];
      history.push({
        role: 'user',
        content: lastMessage.content,
        timestamp: new Date().toISOString()
      });
      history.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        sources: retrievedDocs
      });

      // Keep only last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      this.conversationHistory.set(sessionId, history);
    }

    return {
      query: lastMessage.content,
      response: aiResponse,
      sources: retrievedDocs,
      sessionId,
      conversationLength: this.conversationHistory.get(sessionId)?.length || 0
    };
  }
}