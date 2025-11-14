/**
 * Text Analysis Specialization Workers
 *
 * Advanced text processing, sentiment analysis, and entity extraction
 */

import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const ai = new Ai(env.AI);

    try {
      const url = new URL(request.url);
      const { pathname } = url;

      switch (pathname) {
        case '/analyze/sentiment':
          return await handleSentimentAnalysis(request, ai);
        case '/analyze/entities':
          return await handleEntityExtraction(request, ai);
        case '/analyze/keywords':
          return await handleKeywordExtraction(request, ai);
        case '/analyze/language':
          return await handleLanguageDetection(request, ai);
        case '/analyze/topics':
          return await handleTopicModeling(request, ai);
        case '/analyze/readability':
          return await handleReadabilityAnalysis(request, ai);
        case '/analyze/emotions':
          return await handleEmotionAnalysis(request, ai);
        case '/analyze/intent':
          return await handleIntentClassification(request, ai);
        case '/analyze/batch':
          return await handleBatchAnalysis(request, ai);
        case '/analyze/summarize':
          return await handleTextSummarization(request, ai);
        default:
          return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      console.error('Text Analysis Error:', error);
      return Response.json({
        error: 'Text analysis service temporarily unavailable',
        message: error.message
      }, { status: 500 });
    }
  }
};

/**
 * Handle sentiment analysis
 */
async function handleSentimentAnalysis(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    granularity = 'document', // document, sentence, aspect
    language = 'auto',
    includeScores = true,
    includeBreakdown = false
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const analysis = await analyzer.analyzeSentiment(text, {
      granularity,
      language,
      includeScores,
      includeBreakdown
    });

    return Response.json(analysis);

  } catch (error) {
    return Response.json({
      error: 'Sentiment analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle entity extraction
 */
async function handleEntityExtraction(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    entityTypes = ['person', 'organization', 'location', 'date', 'misc'],
    language = 'auto',
    includeConfidence = true,
    includePositions = false
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const entities = await analyzer.extractEntities(text, {
      entityTypes,
      language,
      includeConfidence,
      includePositions
    });

    return Response.json(entities);

  } catch (error) {
    return Response.json({
      error: 'Entity extraction failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle keyword extraction
 */
async function handleKeywordExtraction(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    maxKeywords = 10,
    method = 'tfidf', // tfidf, frequency, semantic
    language = 'auto',
    includeScores = true
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const keywords = await analyzer.extractKeywords(text, {
      maxKeywords,
      method,
      language,
      includeScores
    });

    return Response.json(keywords);

  } catch (error) {
    return Response.json({
      error: 'Keyword extraction failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle language detection
 */
async function handleLanguageDetection(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    includeProbabilities = true,
    minConfidence = 0.5
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const language = await analyzer.detectLanguage(text, {
      includeProbabilities,
      minConfidence
    });

    return Response.json(language);

  } catch (error) {
    return Response.json({
      error: 'Language detection failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle topic modeling
 */
async function handleTopicModeling(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    texts,
    numTopics = 5,
    minTopicSize = 0.05,
    language = 'auto'
  } = await request.json();

  if (!Array.isArray(texts) || texts.length === 0) {
    return Response.json({ error: 'Texts array is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const topics = await analyzer.identifyTopics(texts, {
      numTopics,
      minTopicSize,
      language
    });

    return Response.json(topics);

  } catch (error) {
    return Response.json({
      error: 'Topic modeling failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle readability analysis
 */
async function handleReadabilityAnalysis(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    language = 'en',
    includeSuggestions = true
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const readability = await analyzer.analyzeReadability(text, {
      language,
      includeSuggestions
    });

    return Response.json(readability);

  } catch (error) {
    return Response.json({
      error: 'Readability analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle emotion analysis
 */
async function handleEmotionAnalysis(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    emotions = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust'],
    granularity = 'document',
    includeIntensity = true
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const emotionsAnalysis = await analyzer.analyzeEmotions(text, {
      emotions,
      granularity,
      includeIntensity
    });

    return Response.json(emotionsAnalysis);

  } catch (error) {
    return Response.json({
      error: 'Emotion analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle intent classification
 */
async function handleIntentClassification(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    intents = ['question', 'command', 'request', 'statement', 'greeting'],
    domain = 'general',
    includeConfidence = true
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const intent = await analyzer.classifyIntent(text, {
      intents,
      domain,
      includeConfidence
    });

    return Response.json(intent);

  } catch (error) {
    return Response.json({
      error: 'Intent classification failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle batch text analysis
 */
async function handleBatchAnalysis(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    texts,
    analyses = ['sentiment', 'entities', 'keywords'],
    options = {}
  } = await request.json();

  if (!Array.isArray(texts) || texts.length === 0) {
    return Response.json({ error: 'Texts array is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const results = await analyzer.batchAnalyze(texts, analyses, options);

    return Response.json({
      totalTexts: texts.length,
      analyses: analyses,
      results
    });

  } catch (error) {
    return Response.json({
      error: 'Batch analysis failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Handle text summarization
 */
async function handleTextSummarization(request, ai) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const {
    text,
    summaryType = 'extractive', // extractive, abstractive, hybrid
    maxLength = 150,
    focusAreas = [],
    language = 'auto'
  } = await request.json();

  if (!text) {
    return Response.json({ error: 'Text is required' }, { status: 400 });
  }

  const analyzer = new TextAnalyzer(ai);

  try {
    const summary = await analyzer.summarizeText(text, {
      summaryType,
      maxLength,
      focusAreas,
      language
    });

    return Response.json(summary);

  } catch (error) {
    return Response.json({
      error: 'Text summarization failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Text Analyzer Class - Core functionality
 */
export class TextAnalyzer {
  constructor(ai) {
    this.ai = ai;
    this.cache = new Map();
    this.models = {
      sentiment: '@cf/huggingface/distilbert-sst-2-int8',
      generation: '@cf/meta/llama-3-8b-instruct',
      embeddings: '@cf/baai/bge-base-en-v1.5'
    };
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text, options = {}) {
    const {
      granularity = 'document',
      language = 'auto',
      includeScores = true,
      includeBreakdown = false
    } = options;

    const cacheKey = `sentiment:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      if (granularity === 'sentence') {
        const sentences = this.splitSentences(text);
        const sentenceResults = [];

        for (const sentence of sentences) {
          const result = await this.analyzeSentenceSentiment(sentence);
          sentenceResults.push({
            sentence,
            ...result
          });
        }

        // Aggregate sentence results
        const aggregated = this.aggregateSentimentResults(sentenceResults);

        const analysis = {
          text,
          granularity: 'sentence',
          overall: aggregated,
          sentences: includeBreakdown ? sentenceResults : undefined,
          language
        };

        this.cache.set(cacheKey, analysis);
        return analysis;

      } else {
        // Document-level sentiment
        const result = await this.analyzeDocumentSentiment(text);

        const analysis = {
          text,
          granularity: 'document',
          result,
          language
        };

        this.cache.set(cacheKey, analysis);
        return analysis;
      }

    } catch (error) {
      console.error('Sentiment analysis error:', error);
      throw error;
    }
  }

  /**
   * Extract entities from text
   */
  async extractEntities(text, options = {}) {
    const {
      entityTypes = ['person', 'organization', 'location', 'date', 'misc'],
      language = 'auto',
      includeConfidence = true,
      includePositions = false
    } = options;

    const cacheKey = `entities:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = `
Extract named entities from the following text. Identify entities of these types: ${entityTypes.join(', ')}.

Text: "${text}"

Return entities in this format:
- Entity name: [type] (confidence: X.XX)

Entities:`;

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: 1000,
        temperature: 0.1
      });

      const entities = this.parseEntityResponse(response.response, entityTypes, includeConfidence, includePositions, text);

      const result = {
        text,
        entities,
        language,
        totalEntities: entities.length
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Entity extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract keywords from text
   */
  async extractKeywords(text, options = {}) {
    const {
      maxKeywords = 10,
      method = 'tfidf',
      language = 'auto',
      includeScores = true
    } = options;

    const cacheKey = `keywords:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let keywords = [];

      switch (method) {
        case 'frequency':
          keywords = this.extractKeywordsByFrequency(text, maxKeywords);
          break;
        case 'semantic':
          keywords = await this.extractKeywordsBySemantic(text, maxKeywords);
          break;
        case 'tfidf':
        default:
          keywords = this.extractKeywordsByTFIDF(text, maxKeywords);
          break;
      }

      const result = {
        text,
        keywords: includeScores ? keywords : keywords.map(k => k.keyword),
        method,
        language,
        totalKeywords: keywords.length
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Keyword extraction error:', error);
      throw error;
    }
  }

  /**
   * Detect language
   */
  async detectLanguage(text, options = {}) {
    const {
      includeProbabilities = true,
      minConfidence = 0.5
    } = options;

    const cacheKey = `language:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Sample text for faster processing
      const sample = text.substring(0, 500);

      const prompt = `
Detect the language of the following text. Provide the language code and confidence score.

Text: "${sample}"

Respond in this format:
Language: [language code]
Confidence: [0.00-1.00]`;

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: 50,
        temperature: 0.1
      });

      const languageInfo = this.parseLanguageResponse(response.response, minConfidence);

      const result = {
        text: sample,
        language: languageInfo.language,
        confidence: languageInfo.confidence,
        probabilities: includeProbabilities ? languageInfo.probabilities : undefined,
        detectedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Language detection error:', error);
      throw error;
    }
  }

  /**
   * Analyze emotions
   */
  async analyzeEmotions(text, options = {}) {
    const {
      emotions = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust'],
      granularity = 'document',
      includeIntensity = true
    } = options;

    const cacheKey = `emotions:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = `
Analyze the emotional content of the following text. Score each emotion from 0.0 to 1.0.

Emotions to analyze: ${emotions.join(', ')}

Text: "${text}"

Provide scores for each emotion:`;

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: 500,
        temperature: 0.1
      });

      const emotionScores = this.parseEmotionResponse(response.response, emotions);

      const result = {
        text,
        emotions: emotionScores,
        dominantEmotion: this.findDominantEmotion(emotionScores),
        granularity,
        analyzedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Emotion analysis error:', error);
      throw error;
    }
  }

  /**
   * Classify intent
   */
  async classifyIntent(text, options = {}) {
    const {
      intents = ['question', 'command', 'request', 'statement', 'greeting'],
      domain = 'general',
      includeConfidence = true
    } = options;

    const cacheKey = `intent:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = `
Classify the intent of the following text in the context of ${domain} communication.

Possible intents: ${intents.join(', ')}

Text: "${text}"

Respond with the most likely intent and confidence score (0.0-1.0).`;

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: 100,
        temperature: 0.1
      });

      const intentInfo = this.parseIntentResponse(response.response, intents);

      const result = {
        text,
        intent: intentInfo.intent,
        confidence: includeConfidence ? intentInfo.confidence : undefined,
        domain,
        alternativeIntents: intentInfo.alternatives,
        classifiedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Intent classification error:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple texts
   */
  async batchAnalyze(texts, analyses, options = {}) {
    const results = [];
    const batchSize = 5; // Process in batches to avoid rate limits

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const batchPromises = batch.map(async (text, index) => {
        const textIndex = i + index;
        const textResults = { text, index: textIndex };

        for (const analysis of analyses) {
          try {
            switch (analysis) {
              case 'sentiment':
                textResults.sentiment = await this.analyzeSentiment(text, options.sentiment || {});
                break;
              case 'entities':
                textResults.entities = await this.extractEntities(text, options.entities || {});
                break;
              case 'keywords':
                textResults.keywords = await this.extractKeywords(text, options.keywords || {});
                break;
              case 'emotions':
                textResults.emotions = await this.analyzeEmotions(text, options.emotions || {});
                break;
              case 'intent':
                textResults.intent = await this.classifyIntent(text, options.intent || {});
                break;
              case 'language':
                textResults.language = await this.detectLanguage(text, options.language || {});
                break;
            }
          } catch (error) {
            textResults[`${analysis}_error`] = error.message;
          }
        }

        return textResults;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Summarize text
   */
  async summarizeText(text, options = {}) {
    const {
      summaryType = 'extractive',
      maxLength = 150,
      focusAreas = [],
      language = 'auto'
    } = options;

    const cacheKey = `summary:${JSON.stringify({ text, options })}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let prompt;

      switch (summaryType) {
        case 'extractive':
          prompt = `Extract the most important sentences from the following text to create a summary of approximately ${maxLength} words.

${focusAreas.length > 0 ? `Focus on: ${focusAreas.join(', ')}.` : ''}

Text: "${text}"

Summary:`;
          break;

        case 'abstractive':
          prompt = `Create a concise summary of the following text in approximately ${maxLength} words.

${focusAreas.length > 0 ? `Focus on: ${focusAreas.join(', ')}.` : ''}

Text: "${text}"

Summary:`;
          break;

        case 'hybrid':
          prompt = `Create a summary by extracting key information and rephrasing it into a concise summary of approximately ${maxLength} words.

${focusAreas.length > 0 ? `Focus on: ${focusAreas.join(', ')}.` : ''}

Text: "${text}"

Summary:`;
          break;
      }

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: maxLength * 3,
        temperature: 0.3
      });

      const summary = response.response || '';

      const result = {
        originalText: text,
        summary: summary.trim(),
        summaryType,
        maxLength,
        focusAreas,
        compressionRatio: summary.length / text.length,
        generatedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Text summarization error:', error);
      throw error;
    }
  }

  // Helper methods
  splitSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  async analyzeSentenceSentiment(sentence) {
    const prompt = `Analyze the sentiment of this sentence: "${sentence}"

Respond with: positive, negative, or neutral, and a confidence score from 0.0 to 1.0.`;

    const response = await this.ai.run(this.models.sentiment, {
      text: sentence
    });

    return {
      sentiment: response.label || 'neutral',
      confidence: response.score || 0.5
    };
  }

  async analyzeDocumentSentiment(text) {
    const response = await this.ai.run(this.models.sentiment, {
      text: text.substring(0, 512) // Limit text length
    });

    return {
      sentiment: response.label || 'neutral',
      confidence: response.score || 0.5
    };
  }

  aggregateSentimentResults(sentenceResults) {
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    let totalConfidence = 0;

    sentenceResults.forEach(result => {
      sentimentCounts[result.sentiment]++;
      totalConfidence += result.confidence;
    });

    const dominantSentiment = Object.keys(sentimentCounts).reduce((a, b) =>
      sentimentCounts[a] > sentimentCounts[b] ? a : b
    );

    return {
      sentiment: dominantSentiment,
      confidence: totalConfidence / sentenceResults.length,
      breakdown: sentimentCounts
    };
  }

  parseEntityResponse(response, entityTypes, includeConfidence, includePositions, text) {
    const entities = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/-?\s*([^:]+):\s*\[([^\]]+)\](?:\s*\([^)]+\))?/);
      if (match) {
        const entity = {
          name: match[1].trim(),
          type: match[2].toLowerCase()
        };

        if (includePositions) {
          const positions = this.findEntityPositions(entity.name, text);
          if (positions.length > 0) {
            entity.positions = positions;
          }
        }

        entities.push(entity);
      }
    }

    return entities.filter(e => entityTypes.includes(e.type));
  }

  findEntityPositions(entityName, text) {
    const positions = [];
    const regex = new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });
    }

    return positions;
  }

  extractKeywordsByFrequency(text, maxKeywords) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCounts = {};

    words.forEach(word => {
      if (word.length > 3) { // Filter out short words
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([keyword, count]) => ({
        keyword,
        score: count / words.length,
        frequency: count
      }));
  }

  extractKeywordsByTFIDF(text, maxKeywords) {
    // Simplified TF-IDF implementation
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCounts = {};
    const totalWords = words.length;

    words.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([keyword, count]) => ({
        keyword,
        score: (count / totalWords) * Math.log(totalWords / count),
        frequency: count
      }));
  }

  async extractKeywordsBySemantic(text, maxKeywords) {
    try {
      const embedding = await this.ai.run(this.models.embeddings, {
        text: text.substring(0, 8000)
      });

      // This is a simplified semantic keyword extraction
      // In a real implementation, you would compare with a semantic database
      return this.extractKeywordsByTFIDF(text, maxKeywords);

    } catch (error) {
      console.error('Semantic keyword extraction error:', error);
      return this.extractKeywordsByTFIDF(text, maxKeywords);
    }
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
      'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
      'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
      'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
      'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
      'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
      'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
      'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
      'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has',
      'had', 'were', 'said', 'did', 'getting', 'made', 'find', 'where',
      'much', 'too', 'very', 'still', 'being', 'going', 'why', 'before',
      'never', 'here', 'more', 'things', 'help', 'away', 'always', 'old',
      'years', 'both', 'better', 'thought', 'little', 'too', 'again',
      'every', 'once', 'thing', 'another', 'began', 'could', 'always',
      'never', 'same', 'another', 'began', 'life', 'school', 'being',
      'day', 'part', 'did', 'got', 'come', 'made', 'may', 'find',
      'where', 'much', 'too', 'very', 'still', 'being', 'going', 'why'
    ]);

    return stopWords.has(word);
  }

  parseLanguageResponse(response, minConfidence) {
    const lines = response.split('\n');
    const result = { language: 'unknown', confidence: 0, probabilities: [] };

    for (const line of lines) {
      if (line.toLowerCase().includes('language:')) {
        result.language = line.split(':')[1]?.trim().toLowerCase() || 'unknown';
      }
      if (line.toLowerCase().includes('confidence:')) {
        const confidence = parseFloat(line.split(':')[1]?.trim());
        result.confidence = isNaN(confidence) ? 0 : confidence;
      }
    }

    if (result.confidence < minConfidence) {
      result.language = 'unknown';
    }

    return result;
  }

  parseEmotionResponse(response, emotions) {
    const emotionScores = {};
    const lines = response.split('\n');

    emotions.forEach(emotion => {
      emotionScores[emotion] = 0;
    });

    for (const line of lines) {
      for (const emotion of emotions) {
        if (line.toLowerCase().includes(emotion)) {
          const match = line.match(/([0-9]*\.?[0-9]+)/);
          if (match) {
            emotionScores[emotion] = Math.min(1, Math.max(0, parseFloat(match[1])));
          }
        }
      }
    }

    return emotionScores;
  }

  parseIntentResponse(response, intents) {
    const lines = response.split('\n');
    const result = { intent: 'unknown', confidence: 0, alternatives: [] };

    for (const line of lines) {
      if (line.toLowerCase().includes('intent:')) {
        const intentText = line.split(':')[1]?.trim().toLowerCase() || 'unknown';
        result.intent = intents.find(i => intentText.includes(i)) || intentText;
      }
      if (line.toLowerCase().includes('confidence:')) {
        const confidence = parseFloat(line.split(':')[1]?.trim());
        result.confidence = isNaN(confidence) ? 0 : confidence;
      }
    }

    return result;
  }

  findDominantEmotion(emotionScores) {
    let maxScore = 0;
    let dominantEmotion = 'neutral';

    Object.entries(emotionScores).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    });

    return dominantEmotion;
  }

  async identifyTopics(texts, options = {}) {
    const {
      numTopics = 5,
      minTopicSize = 0.05,
      language = 'auto'
    } = options;

    try {
      // Combine all texts for topic modeling
      const combinedText = texts.join(' ').substring(0, 8000);

      const prompt = `
Identify the main topics from the following collection of texts. Provide ${numTopics} topics with their key themes.

Texts:
${combinedText}

Topics and themes:`;

      const response = await this.ai.run(this.models.generation, {
        prompt,
        max_tokens: 1000,
        temperature: 0.3
      });

      const topics = this.parseTopicsResponse(response.response, numTopics);

      return {
        totalTexts: texts.length,
        topics,
        language,
        analyzedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Topic identification error:', error);
      throw error;
    }
  }

  parseTopicsResponse(response, numTopics) {
    const topics = [];
    const lines = response.split('\n');

    let currentTopic = null;

    for (const line of lines) {
      const topicMatch = line.match(/^\d+\.\s*(.+?):/);
      if (topicMatch) {
        if (currentTopic) {
          topics.push(currentTopic);
        }
        currentTopic = {
          name: topicMatch[1].trim(),
          themes: []
        };
      } else if (currentTopic && line.trim().startsWith('-')) {
        currentTopic.themes.push(line.trim().substring(1).trim());
      }
    }

    if (currentTopic) {
      topics.push(currentTopic);
    }

    return topics.slice(0, numTopics);
  }

  async analyzeReadability(text, options = {}) {
    const {
      language = 'en',
      includeSuggestions = true
    } = options;

    try {
      const words = text.split(/\s+/);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const syllables = this.countSyllables(text);

      // Basic readability metrics
      const avgWordsPerSentence = words.length / sentences.length;
      const avgSyllablesPerWord = syllables / words.length;

      // Flesch Reading Ease
      const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

      // Reading level
      let readingLevel = 'Very Difficult';
      if (fleschScore >= 90) readingLevel = 'Very Easy';
      else if (fleschScore >= 80) readingLevel = 'Easy';
      else if (fleschScore >= 70) readingLevel = 'Fairly Easy';
      else if (fleschScore >= 60) readingLevel = 'Standard';
      else if (fleschScore >= 50) readingLevel = 'Fairly Difficult';
      else if (fleschScore >= 30) readingLevel = 'Difficult';

      const analysis = {
        text,
        language,
        metrics: {
          wordCount: words.length,
          sentenceCount: sentences.length,
          syllableCount: syllables,
          avgWordsPerSentence,
          avgSyllablesPerWord,
          fleschReadingEase: Math.max(0, Math.min(100, fleschScore)),
          readingLevel
        }
      };

      if (includeSuggestions) {
        analysis.suggestions = this.generateReadabilitySuggestions(analysis.metrics);
      }

      return analysis;

    } catch (error) {
      console.error('Readability analysis error:', error);
      throw error;
    }
  }

  countSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let syllableCount = 0;

    for (const word of words) {
      syllableCount += this.countWordSyllables(word);
    }

    return syllableCount;
  }

  countWordSyllables(word) {
    // Simplified syllable counting
    const vowels = 'aeiouy';
    let count = 0;
    let prevWasVowel = false;

    for (const char of word) {
      const isVowel = vowels.includes(char);
      if (isVowel && !prevWasVowel) {
        count++;
      }
      prevWasVowel = isVowel;
    }

    if (word.endsWith('e')) count--;
    if (count === 0) count = 1;

    return count;
  }

  generateReadabilitySuggestions(metrics) {
    const suggestions = [];

    if (metrics.avgWordsPerSentence > 20) {
      suggestions.push('Consider shorter sentences for better readability');
    }

    if (metrics.avgSyllablesPerWord > 2) {
      suggestions.push('Use simpler words to improve comprehension');
    }

    if (metrics.fleschReadingEase < 50) {
      suggestions.push('Text is quite difficult to read - consider simplifying');
    }

    if (metrics.wordCount > 500) {
      suggestions.push('Consider breaking this into smaller sections');
    }

    return suggestions;
  }
}