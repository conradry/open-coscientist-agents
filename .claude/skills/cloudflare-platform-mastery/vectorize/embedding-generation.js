/**
 * Advanced Embedding Generation Patterns
 * Optimized for medical research and general text processing
 */

export class EmbeddingGenerator {
  constructor(env) {
    this.env = env;
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Generate embeddings with caching and batch processing
   */
  async generateEmbeddings(texts, options = {}) {
    const {
      model = '@cf/baai/bge-small-en-v1.5',
      batchSize = 10,
      useCache = true,
      chunkSize = 8000,
      overlap = 200
    } = options;

    const results = [];
    const cacheHits = 0;
    const cacheMisses = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = [];

      for (const text of batch) {
        const cacheKey = `${model}:${this.hashText(text)}`;

        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.cacheTimeout) {
            batchResults.push(cached.embedding);
            continue;
          }
        }

        // Process long texts by chunking
        const chunks = this.chunkText(text, chunkSize, overlap);
        let finalEmbedding;

        if (chunks.length === 1) {
          // Single chunk - generate directly
          finalEmbedding = await this.generateSingleEmbedding(chunks[0], model);
        } else {
          // Multiple chunks - generate and combine
          const chunkEmbeddings = await Promise.all(
            chunks.map(chunk => this.generateSingleEmbedding(chunk, model))
          );
          finalEmbedding = this.combineEmbeddings(chunkEmbeddings);
        }

        // Cache the result
        if (useCache) {
          this.cache.set(cacheKey, {
            embedding: finalEmbedding,
            timestamp: Date.now()
          });
        }

        batchResults.push(finalEmbedding);
      }

      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < texts.length) {
        await this.sleep(100);
      }
    }

    return {
      embeddings: results,
      metadata: {
        totalTexts: texts.length,
        model,
        batchSize,
        cacheHits,
        cacheMisses,
        avgEmbeddingDim: results[0]?.length || 0
      }
    };
  }

  /**
   * Generate single embedding
   */
  async generateSingleEmbedding(text, model) {
    try {
      const response = await this.env.AI.run(model, {
        text: text.trim()
      });

      return response.data[0];
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Split long text into chunks for embedding
   */
  chunkText(text, chunkSize, overlap) {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start) {
          end = breakPoint + 1;
        }
      }

      chunks.push(text.substring(start, end));
      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }

  /**
   * Combine multiple embeddings (averaging)
   */
  combineEmbeddings(embeddings) {
    if (embeddings.length === 1) {
      return embeddings[0];
    }

    const dimension = embeddings[0].length;
    const combined = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        combined[i] += embedding[i];
      }
    }

    // Average the values
    for (let i = 0; i < dimension; i++) {
      combined[i] /= embeddings.length;
    }

    return combined;
  }

  /**
   * Specialized medical text preprocessing
   */
  preprocessMedicalText(text) {
    return text
      // Normalize medical terminology
      .replace(/\b(Mr|Dr|Prof)\b/g, (match) => match.toLowerCase())
      // Handle medical abbreviations
      .replace(/\bCOVID[-\s]?19\b/gi, 'COVID-19')
      .replace(/\bSARS[-\s]?CoV[-\s]?2\b/gi, 'SARS-CoV-2')
      // Normalize dosage formats
      .replace(/(\d+)\s*mg/gi, '$1 mg')
      .replace(/(\d+)\s*ml/gi, '$1 ml')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate domain-specific embeddings
   */
  async generateDomainEmbeddings(texts, domain = 'general') {
    let processedTexts = texts;
    let model = '@cf/baai/bge-small-en-v1.5';

    switch (domain) {
      case 'medical':
        processedTexts = texts.map(text => this.preprocessMedicalText(text));
        model = '@cf/baai/bge-small-en-v1.5'; // Could use medical-specific model
        break;

      case 'scientific':
        processedTexts = texts.map(text => this.preprocessScientificText(text));
        model = '@cf/baai/bge-small-en-v1.5';
        break;

      case 'legal':
        processedTexts = texts.map(text => this.preprocessLegalText(text));
        model = '@cf/baai/bge-small-en-v1.5';
        break;
    }

    return this.generateEmbeddings(processedTexts, { model });
  }

  /**
   * Preprocess scientific text
   */
  preprocessScientificText(text) {
    return text
      // Normalize citations
      .replace(/\[(\d+)\]/g, '[citation:$1]')
      // Handle chemical formulas
      .replace(/([A-Z][a-z]?)(\d*)/g, '$1$2')
      // Clean up LaTeX-like expressions
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\\[a-zA-Z]+\{([^}]+)\}/g, '$1')
      .trim();
  }

  /**
   * Preprocess legal text
   */
  preprocessLegalText(text) {
    return text
      // Normalize case citations
      .replace(/\b(\d+)\s+F\.(\d+)d\s+(\d+)\b/gi, '$1 F.$2d $3')
      // Normalize section symbols
      .replace(/§/g, 'section')
      // Clean up legal abbreviations
      .replace(/\b(?:etc\.|i\.e\.|e\.g\.)\b/gi, match => match.replace(/\./g, ''))
      .trim();
  }

  /**
   * Calculate embedding similarity
   */
  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar embeddings
   */
  findMostSimilar(queryEmbedding, candidateEmbeddings, topK = 5) {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.calculateSimilarity(queryEmbedding, embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Cluster embeddings using simple k-means
   */
  clusterEmbeddings(embeddings, k = 3, maxIterations = 100) {
    if (embeddings.length < k) {
      throw new Error('Number of embeddings must be >= k');
    }

    const dimension = embeddings[0].length;

    // Initialize centroids randomly
    let centroids = [];
    for (let i = 0; i < k; i++) {
      const randomIndex = Math.floor(Math.random() * embeddings.length);
      centroids.push([...embeddings[randomIndex]]);
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign embeddings to nearest centroid
      const clusters = Array(k).fill(null).map(() => []);

      for (const embedding of embeddings) {
        let minDistance = Infinity;
        let nearestCentroid = 0;

        for (let i = 0; i < k; i++) {
          const distance = this.euclideanDistance(embedding, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCentroid = i;
          }
        }

        clusters[nearestCentroid].push(embedding);
      }

      // Update centroids
      const newCentroids = [];
      for (let i = 0; i < k; i++) {
        if (clusters[i].length === 0) {
          newCentroids.push([...centroids[i]]);
          continue;
        }

        const newCentroid = new Array(dimension).fill(0);
        for (const embedding of clusters[i]) {
          for (let j = 0; j < dimension; j++) {
            newCentroid[j] += embedding[j];
          }
        }

        for (let j = 0; j < dimension; j++) {
          newCentroid[j] /= clusters[i].length;
        }

        newCentroids.push(newCentroid);
      }

      // Check for convergence
      let converged = true;
      for (let i = 0; i < k; i++) {
        if (this.euclideanDistance(centroids[i], newCentroids[i]) > 0.001) {
          converged = false;
          break;
        }
      }

      centroids = newCentroids;

      if (converged) {
        break;
      }
    }

    return centroids;
  }

  /**
   * Calculate Euclidean distance
   */
  euclideanDistance(embedding1, embedding2) {
    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Hash text for cache key
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout
    };
  }
}