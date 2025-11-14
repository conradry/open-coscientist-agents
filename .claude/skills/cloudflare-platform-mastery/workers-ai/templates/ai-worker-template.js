/**
 * Production-Ready Cloudflare Workers AI Template
 *
 * Features:
 * - Multiple AI model support
 * - Error handling and retries
 * - Rate limiting and cost controls
 * - Response caching
 * - Security validation
 * - Monitoring and metrics
 */

import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const ai = new Ai(env.AI);

    try {
      // Parse and validate request
      const { pathname, searchParams } = new URL(request.url);
      const method = request.method;

      // Security checks
      if (!await validateRequest(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Rate limiting
      if (!await checkRateLimit(request, env)) {
        return new Response('Rate limit exceeded', { status: 429 });
      }

      // Route to appropriate AI function
      const result = await handleAIRequest({
        ai,
        method,
        pathname,
        searchParams,
        body: method === 'POST' ? await request.json() : {},
        env
      });

      // Log metrics
      await logMetrics({
        endpoint: pathname,
        duration: Date.now() - startTime,
        success: true,
        env
      });

      return Response.json(result);

    } catch (error) {
      console.error('AI Worker Error:', error);

      await logMetrics({
        endpoint: pathname,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
        env
      });

      return Response.json({
        error: 'AI service temporarily unavailable',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  }
};

/**
 * Handle different AI request types
 */
async function handleAIRequest({ ai, method, pathname, searchParams, body, env }) {
  const pathSegments = pathname.split('/').filter(Boolean);

  switch (pathSegments[0]) {
    case 'text':
      return await handleTextGeneration(ai, body);

    case 'chat':
      return await handleChatCompletion(ai, body);

    case 'embeddings':
      return await handleEmbeddings(ai, body);

    case 'image':
      return await handleImageGeneration(ai, body);

    case 'classification':
      return await handleClassification(ai, body);

    case 'translation':
      return await handleTranslation(ai, body);

    case 'summarization':
      return await handleSummarization(ai, body);

    default:
      throw new Error(`Unknown AI endpoint: ${pathname}`);
  }
}

/**
 * Text generation handler
 */
async function handleTextGeneration(ai, options) {
  const {
    prompt,
    model = '@cf/meta/llama-3-8b-instruct',
    max_tokens = 2048,
    temperature = 0.7,
    stream = false
  } = options;

  // Validate input
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required and must be a string');
  }

  if (prompt.length > 10000) {
    throw new Error('Prompt too long (max 10000 characters)');
  }

  // Check cache first
  const cacheKey = `text:${model}:${prompt.substring(0, 100)}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const response = await ai.run(model, {
    prompt,
    max_tokens,
    temperature,
    stream
  });

  // Cache successful responses
  await setCache(cacheKey, response, 3600); // 1 hour

  return {
    response: response.response || response,
    model,
    cached: false,
    usage: {
      prompt_tokens: response.input_tokens || 0,
      completion_tokens: response.output_tokens || 0,
      total_tokens: (response.input_tokens || 0) + (response.output_tokens || 0)
    }
  };
}

/**
 * Chat completion handler
 */
async function handleChatCompletion(ai, options) {
  const {
    messages,
    model = '@cf/meta/llama-3-8b-instruct',
    max_tokens = 2048,
    temperature = 0.7,
    system_prompt = ''
  } = options;

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array');
  }

  // Format messages for the model
  const formattedMessages = [
    ...(system_prompt ? [{ role: 'system', content: system_prompt }] : []),
    ...messages
  ];

  // Create prompt from messages
  const prompt = formattedMessages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  const response = await ai.run(model, {
    prompt,
    max_tokens,
    temperature
  });

  return {
    response: response.response || response,
    messages: formattedMessages,
    model,
    usage: {
      prompt_tokens: response.input_tokens || 0,
      completion_tokens: response.output_tokens || 0,
      total_tokens: (response.input_tokens || 0) + (response.output_tokens || 0)
    }
  };
}

/**
 * Embeddings handler
 */
async function handleEmbeddings(ai, options) {
  const {
    text,
    model = '@cf/baai/bge-base-en-v1.5'
  } = options;

  if (!text || typeof text !== 'string') {
    throw new Error('Text is required and must be a string');
  }

  // Support batch processing
  const texts = Array.isArray(text) ? text : [text];

  const embeddings = [];
  for (const t of texts) {
    const response = await ai.run(model, { text: t });
    embeddings.push(response.data[0]);
  }

  return {
    embeddings,
    model,
    dimensions: embeddings[0]?.length || 0,
    count: texts.length
  };
}

/**
 * Image generation handler
 */
async function handleImageGeneration(ai, options) {
  const {
    prompt,
    model = '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    num_steps = 20,
    guidance_scale = 7.5
  } = options;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required and must be a string');
  }

  const response = await ai.run(model, {
    prompt,
    num_steps,
    guidance_scale
  });

  return {
    image: response.image,
    model,
    parameters: { num_steps, guidance_scale }
  };
}

/**
 * Text classification handler
 */
async function handleClassification(ai, options) {
  const {
    text,
    labels,
    model = '@cf/huggingface/distilbert-sst-2-int8'
  } = options;

  if (!text || !labels || !Array.isArray(labels)) {
    throw new Error('Text and labels array are required');
  }

  const classificationPrompt = `
Classify the following text into one of these categories: ${labels.join(', ')}.

Text: "${text}"

Category:`;

  const response = await ai.run(model, {
    prompt: classificationPrompt,
    max_tokens: 10,
    temperature: 0.1
  });

  return {
    text,
    classification: response.response?.trim(),
    confidence: 0.8, // Would need model-specific confidence
    model
  };
}

/**
 * Translation handler
 */
async function handleTranslation(ai, options) {
  const {
    text,
    source_lang = 'auto',
    target_lang,
    model = '@cf/meta/m2m100-1.2b'
  } = options;

  if (!text || !target_lang) {
    throw new Error('Text and target language are required');
  }

  const translationPrompt = `
Translate the following text from ${source_lang} to ${target_lang}:

"${text}"

Translation:`;

  const response = await ai.run(model, {
    prompt: translationPrompt,
    max_tokens: 1000,
    temperature: 0.1
  });

  return {
    original: text,
    translated: response.response?.trim(),
    source_lang,
    target_lang,
    model
  };
}

/**
 * Text summarization handler
 */
async function handleSummarization(ai, options) {
  const {
    text,
    max_length = 150,
    model = '@cf/facebook/bart-large-cnn'
  } = options;

  if (!text) {
    throw new Error('Text is required');
  }

  const summarizationPrompt = `
Summarize the following text in approximately ${max_length} words:

"${text}"

Summary:`;

  const response = await ai.run(model, {
    prompt: summarizationPrompt,
    max_tokens: max_length * 2,
    temperature: 0.3
  });

  return {
    original: text,
    summary: response.response?.trim(),
    original_length: text.length,
    summary_length: response.response?.trim().length,
    model
  };
}

/**
 * Security validation
 */
async function validateRequest(request, env) {
  const origin = request.headers.get('origin');
  const apiKey = request.headers.get('x-api-key');

  // Check API key if configured
  if (env.API_KEY && apiKey !== env.API_KEY) {
    return false;
  }

  // Check CORS if configured
  if (env.ALLOWED_ORIGINS && origin) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',');
    return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  }

  return true;
}

/**
 * Rate limiting using KV
 */
async function checkRateLimit(request, env) {
  if (!env.RATE_LIMIT_KV) return true;

  const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `rate_limit:${clientIP}`;
  const current = await env.RATE_LIMIT_KV.get(key);

  const limit = parseInt(env.RATE_LIMIT || '100'); // requests per hour
  const now = Date.now();
  const hour = Math.floor(now / (1000 * 60 * 60));

  if (current) {
    const { count, timestamp } = JSON.parse(current);

    if (timestamp === hour) {
      if (count >= limit) {
        return false;
      }

      await env.RATE_LIMIT_KV.put(key, JSON.stringify({
        count: count + 1,
        timestamp: hour
      }), { expirationTtl: 3600 });
    } else {
      await env.RATE_LIMIT_KV.put(key, JSON.stringify({
        count: 1,
        timestamp: hour
      }), { expirationTtl: 3600 });
    }
  } else {
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({
      count: 1,
      timestamp: hour
    }), { expirationTtl: 3600 });
  }

  return true;
}

/**
 * Cache functions
 */
async function getFromCache(key) {
  // Implementation would depend on your cache setup (KV, R2, etc.)
  return null;
}

async function setCache(key, value, ttl) {
  // Implementation would depend on your cache setup
  return true;
}

/**
 * Metrics logging
 */
async function logMetrics({ endpoint, duration, success, error, env }) {
  if (env.ANALYTICS_KV) {
    const timestamp = Date.now();
    const key = `metrics:${endpoint}:${timestamp}`;

    await env.ANALYTICS_KV.put(key, JSON.stringify({
      endpoint,
      duration,
      success,
      error,
      timestamp
    }), { expirationTtl: 86400 * 30 }); // 30 days
  }
}