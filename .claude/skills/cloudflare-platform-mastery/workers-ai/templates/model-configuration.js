/**
 * AI Model Configuration and Optimization
 *
 * Centralized model selection, optimization, and performance tuning
 */

// Available AI models with their characteristics
export const AI_MODELS = {
  // Text Generation Models
  TEXT_GENERATION: {
    '@cf/meta/llama-3-8b-instruct': {
      name: 'Llama 3 8B Instruct',
      type: 'text-generation',
      maxTokens: 8192,
      costPerToken: 0.0000001,
      performance: {
        speed: 'fast',
        quality: 'high',
        contextLength: 8192
      },
      bestFor: ['chat', 'instruction-following', 'reasoning'],
      limitations: ['english-primary'],
      temperature: { min: 0, max: 2, default: 0.7 },
      topP: { min: 0, max: 1, default: 0.95 }
    },
    '@cf/meta/llama-3-70b-instruct': {
      name: 'Llama 3 70B Instruct',
      type: 'text-generation',
      maxTokens: 8192,
      costPerToken: 0.000001,
      performance: {
        speed: 'medium',
        quality: 'very-high',
        contextLength: 8192
      },
      bestFor: ['complex-reasoning', 'creative-writing', 'analysis'],
      limitations: ['slower', 'higher-cost'],
      temperature: { min: 0, max: 2, default: 0.7 },
      topP: { min: 0, max: 1, default: 0.95 }
    },
    '@hf/thebloke/llamaguard-7b': {
      name: 'LlamaGuard 7B',
      type: 'moderation',
      maxTokens: 2048,
      costPerToken: 0.0000001,
      performance: {
        speed: 'fast',
        quality: 'high',
        contextLength: 2048
      },
      bestFor: ['content-moderation', 'safety-checks'],
      limitations: ['moderation-only'],
      temperature: { min: 0, max: 0.1, default: 0 }
    }
  },

  // Embedding Models
  EMBEDDINGS: {
    '@cf/baai/bge-base-en-v1.5': {
      name: 'BGE Base EN v1.5',
      type: 'embedding',
      dimensions: 768,
      maxTokens: 512,
      costPerToken: 0.00000005,
      performance: {
        speed: 'fast',
        quality: 'high',
        contextLength: 512
      },
      bestFor: ['semantic-search', 'clustering', 'classification'],
      language: 'english'
    },
    '@cf/baai/bge-large-en-v1.5': {
      name: 'BGE Large EN v1.5',
      type: 'embedding',
      dimensions: 1024,
      maxTokens: 512,
      costPerToken: 0.0000001,
      performance: {
        speed: 'medium',
        quality: 'very-high',
        contextLength: 512
      },
      bestFor: ['high-precision-search', 'semantic-similarity'],
      language: 'english'
    },
    '@cf/baai/bge-small-en-v1.5': {
      name: 'BGE Small EN v1.5',
      type: 'embedding',
      dimensions: 384,
      maxTokens: 512,
      costPerToken: 0.00000002,
      performance: {
        speed: 'very-fast',
        quality: 'medium',
        contextLength: 512
      },
      bestFor: ['cost-sensitive-apps', 'fast-search'],
      language: 'english'
    }
  },

  // Image Generation Models
  IMAGE_GENERATION: {
    '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
      name: 'Stable Diffusion XL',
      type: 'image-generation',
      costPerGeneration: 0.001,
      performance: {
        speed: 'medium',
        quality: 'very-high',
        resolution: '1024x1024'
      },
      bestFor: ['high-quality-images', 'artistic-creation'],
      parameters: {
        numSteps: { min: 1, max: 50, default: 20 },
        guidanceScale: { min: 1, max: 20, default: 7.5 }
      }
    },
    '@cf/lykon/dreamshaper-v8-7': {
      name: 'DreamShaper v8',
      type: 'image-generation',
      costPerGeneration: 0.0008,
      performance: {
        speed: 'fast',
        quality: 'high',
        resolution: '512x512'
      },
      bestFor: ['portraits', 'character-design', 'art-styles'],
      parameters: {
        numSteps: { min: 1, max: 30, default: 15 },
        guidanceScale: { min: 1, max: 15, default: 7 }
      }
    }
  },

  // Translation Models
  TRANSLATION: {
    '@cf/meta/m2m100-1.2b': {
      name: 'M2M-100 1.2B',
      type: 'translation',
      supportedLanguages: 100,
      costPerToken: 0.0000001,
      performance: {
        speed: 'fast',
        quality: 'high'
      },
      bestFor: ['general-translation', 'multi-language'],
      limitations: ['not-specialized-domain']
    }
  },

  // Classification Models
  CLASSIFICATION: {
    '@cf/huggingface/distilbert-sst-2-int8': {
      name: 'DistilBERT SST-2',
      type: 'sentiment-analysis',
      costPerToken: 0.00000002,
      performance: {
        speed: 'very-fast',
        quality: 'high'
      },
      bestFor: ['sentiment-analysis', 'text-classification'],
      language: 'english',
      categories: ['positive', 'negative', 'neutral']
    }
  }
};

/**
 * Model Selection Strategy
 */
export class ModelSelector {
  constructor() {
    this.usageStats = new Map();
    this.costOptimization = new CostOptimizer();
  }

  /**
   * Select the best model based on requirements
   */
  selectModel(taskType, requirements = {}) {
    const {
      priority = 'quality', // quality, speed, cost
      language = 'english',
      budget,
      maxTokens,
      customCriteria
    } = requirements;

    const availableModels = AI_MODELS[taskType] || {};
    let models = Object.entries(availableModels);

    // Filter by requirements
    if (language && language !== 'english') {
      models = models.filter(([_, config]) =>
        !config.language || config.language === 'any' || config.language === language
      );
    }

    if (maxTokens) {
      models = models.filter(([_, config]) =>
        (config.maxTokens || Infinity) >= maxTokens
      );
    }

    if (budget) {
      models = models.filter(([_, config]) =>
        this.costOptimization.estimateCost(config, maxTokens) <= budget
      );
    }

    // Score and rank models
    const scoredModels = models.map(([modelId, config]) => ({
      modelId,
      config,
      score: this.scoreModel(config, requirements, priority)
    }));

    scoredModels.sort((a, b) => b.score - a.score);

    return scoredModels[0]?.modelId || null;
  }

  /**
   * Score model based on requirements
   */
  scoreModel(config, requirements, priority) {
    const weights = {
      quality: priority === 'quality' ? 0.6 : 0.3,
      speed: priority === 'speed' ? 0.6 : 0.2,
      cost: priority === 'cost' ? 0.6 : 0.1
    };

    let score = 0;

    // Quality score
    const qualityMap = { 'very-high': 10, 'high': 8, 'medium': 6, 'low': 4 };
    score += qualityMap[config.performance?.quality] || 5 * weights.quality;

    // Speed score
    const speedMap = { 'very-fast': 10, 'fast': 8, 'medium': 6, 'slow': 4 };
    score += speedMap[config.performance?.speed] || 5 * weights.speed;

    // Cost score (lower is better)
    const costScore = config.costPerToken ? Math.max(0, 10 - config.costPerToken * 1000000) : 5;
    score += costScore * weights.cost;

    // Usage penalty (encourage variety)
    const usage = this.usageStats.get(config.name) || 0;
    score -= Math.min(2, usage * 0.1);

    return score;
  }

  /**
   * Record model usage for optimization
   */
  recordUsage(modelId, success = true, latency = null) {
    const usage = this.usageStats.get(modelId) || { count: 0, successes: 0, latency: [] };
    usage.count++;
    if (success) usage.successes++;
    if (latency) usage.latency.push(latency);

    this.usageStats.set(modelId, usage);
  }
}

/**
 * Cost Optimization
 */
export class CostOptimizer {
  constructor() {
    this.budgetTracker = new Map();
  }

  /**
   * Estimate cost for model usage
   */
  estimateCost(modelConfig, tokens = 1000) {
    if (modelConfig.costPerGeneration) {
      return modelConfig.costPerGeneration;
    }

    if (modelConfig.costPerToken) {
      return modelConfig.costPerToken * tokens;
    }

    return 0;
  }

  /**
   * Optimize batch processing
   */
  optimizeBatch(items, modelConfig) {
    const maxBatchSize = modelConfig.maxTokens || 512;
    const avgTokensPerItem = 100; // Estimate

    const optimalBatchSize = Math.min(
      Math.floor(maxBatchSize / avgTokensPerItem),
      10 // Maximum practical batch size
    );

    return {
      batchSize: optimalBatchSize,
      batches: Math.ceil(items.length / optimalBatchSize),
      estimatedCost: this.estimateCost(modelConfig, items.length * avgTokensPerItem)
    };
  }

  /**
   * Track budget usage
   */
  trackBudget(projectId, cost) {
    const current = this.budgetTracker.get(projectId) || { spent: 0, limit: null };
    current.spent += cost;
    this.budgetTracker.set(projectId, current);

    return {
      spent: current.spent,
      remaining: current.limit ? Math.max(0, current.limit - current.spent) : null,
      withinBudget: current.limit ? current.spent <= current.limit : true
    };
  }
}

/**
 * Performance Optimization
 */
export class PerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Optimize model parameters
   */
  optimizeParameters(modelConfig, taskType, inputLength) {
    const baseConfig = {};

    switch (taskType) {
      case 'text-generation':
        baseConfig.temperature = this.optimizeTemperature(modelConfig, inputLength);
        baseConfig.topP = this.optimizeTopP(modelConfig);
        baseConfig.maxTokens = this.optimizeMaxTokens(modelConfig, inputLength);
        break;

      case 'image-generation':
        baseConfig.numSteps = this.optimizeNumSteps(modelConfig);
        baseConfig.guidanceScale = this.optimizeGuidanceScale(modelConfig);
        break;

      case 'embeddings':
        // Embeddings typically don't have tunable parameters
        break;
    }

    return baseConfig;
  }

  /**
   * Optimize temperature based on model and task
   */
  optimizeTemperature(modelConfig, inputLength) {
    const { temperature } = modelConfig;

    // Lower temperature for longer inputs to maintain coherence
    if (inputLength > 2000) {
      return Math.max(temperature.min, temperature.default * 0.7);
    }

    // Higher temperature for creative tasks
    if (modelConfig.bestFor.includes('creative-writing')) {
      return Math.min(temperature.max, temperature.default * 1.2);
    }

    return temperature.default;
  }

  /**
   * Optimize top-p sampling
   */
  optimizeTopP(modelConfig) {
    const { topP } = modelConfig;
    return topP.default;
  }

  /**
   * Optimize max tokens based on input and context
   */
  optimizeMaxTokens(modelConfig, inputLength) {
    const contextWindow = modelConfig.maxTokens || 4096;
    const reservedForResponse = Math.min(2048, contextWindow / 4);
    const maxForResponse = Math.min(reservedForResponse, contextWindow - inputLength - 100);

    return Math.max(50, maxForResponse);
  }

  /**
   * Optimize image generation steps
   */
  optimizeNumSteps(modelConfig) {
    const { numSteps } = modelConfig.parameters;

    // Fewer steps for faster results, more for quality
    return modelConfig.performance.speed === 'fast'
      ? Math.floor(numSteps.default * 0.7)
      : numSteps.default;
  }

  /**
   * Optimize guidance scale
   */
  optimizeGuidanceScale(modelConfig) {
    const { guidanceScale } = modelConfig.parameters;
    return guidanceScale.default;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(modelId) {
    return this.performanceMetrics.get(modelId) || {
      avgLatency: 0,
      successRate: 0,
      totalRequests: 0
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(modelId, latency, success) {
    const current = this.getPerformanceMetrics(modelId);
    current.totalRequests++;

    if (success) {
      current.successRate = ((current.successRate * (current.totalRequests - 1)) + 1) / current.totalRequests;
    } else {
      current.successRate = ((current.successRate * (current.totalRequests - 1)) + 0) / current.totalRequests;
    }

    current.avgLatency = ((current.avgLatency * (current.totalRequests - 1)) + latency) / current.totalRequests;

    this.performanceMetrics.set(modelId, current);
  }
}

/**
 * Default configurations for common use cases
 */
export const DEFAULT_CONFIGS = {
  // Chat applications
  chat: {
    model: '@cf/meta/llama-3-8b-instruct',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant.',
    enableStreaming: true
  },

  // Code generation
  code: {
    model: '@cf/meta/llama-3-8b-instruct',
    temperature: 0.1,
    maxTokens: 1024,
    systemPrompt: 'You are a programming assistant. Provide clean, efficient code.',
    enableStreaming: false
  },

  // Creative writing
  creative: {
    model: '@cf/meta/llama-3-70b-instruct',
    temperature: 0.9,
    maxTokens: 3072,
    systemPrompt: 'You are a creative writer. Be imaginative and engaging.',
    enableStreaming: true
  },

  // Semantic search
  search: {
    model: '@cf/baai/bge-base-en-v1.5',
    dimensions: 768,
    normalize: true
  },

  // Content moderation
  moderation: {
    model: '@hf/thebloke/llamaguard-7b',
    temperature: 0,
    maxTokens: 100,
    strictMode: true
  },

  // Translation
  translation: {
    model: '@cf/meta/m2m100-1.2b',
    temperature: 0.1,
    maxTokens: 2048
  }
};

// Export singleton instances
export const modelSelector = new ModelSelector();
export const costOptimizer = new CostOptimizer();
export const performanceOptimizer = new PerformanceOptimizer();