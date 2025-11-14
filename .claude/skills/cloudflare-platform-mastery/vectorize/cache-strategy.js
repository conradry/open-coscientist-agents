/**
 * Vector Search Caching Strategy
 * Multi-layer caching for Vectorize operations to improve performance and reduce costs
 */

export class VectorCacheStrategy {
  constructor(env) {
    this.env = env;
    this.cacheConfig = {
      // Layer 1: In-memory cache (within worker instance)
      memoryCache: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        enabled: true
      },

      // Layer 2: KV cache (persistent across worker instances)
      kvCache: {
        ttl: 3600000, // 1 hour
        enabled: true,
        namespace: 'vector_cache'
      },

      // Layer 3: D1 cache (for complex queries and metadata)
      d1Cache: {
        ttl: 86400000, // 24 hours
        enabled: true,
        tableName: 'vector_query_cache'
      }
    };

    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      layers: { memory: 0, kv: 0, d1: 0 }
    };
  }

  /**
   * Get cached query results
   */
  async get(query, options = {}) {
    const cacheKey = this.generateCacheKey(query, options);

    try {
      // Layer 1: Memory cache
      if (this.cacheConfig.memoryCache.enabled) {
        const memoryResult = this.getFromMemory(cacheKey);
        if (memoryResult !== null) {
          this.cacheStats.hits++;
          this.cacheStats.layers.memory++;
          return memoryResult;
        }
      }

      // Layer 2: KV cache
      if (this.cacheConfig.kvCache.enabled) {
        const kvResult = await this.getFromKV(cacheKey);
        if (kvResult !== null) {
          // Store in memory for faster subsequent access
          if (this.cacheConfig.memoryCache.enabled) {
            this.setToMemory(cacheKey, kvResult);
          }
          this.cacheStats.hits++;
          this.cacheStats.layers.kv++;
          return kvResult;
        }
      }

      // Layer 3: D1 cache (for complex queries)
      if (options.useD1Cache || this.isComplexQuery(query)) {
        const d1Result = await this.getFromD1(cacheKey);
        if (d1Result !== null) {
          // Store in higher layers
          if (this.cacheConfig.memoryCache.enabled) {
            this.setToMemory(cacheKey, d1Result);
          }
          if (this.cacheConfig.kvCache.enabled) {
            await this.setToKV(cacheKey, d1Result);
          }
          this.cacheStats.hits++;
          this.cacheStats.layers.d1++;
          return d1Result;
        }
      }

      // Cache miss
      this.cacheStats.misses++;
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set query results in cache
   */
  async set(query, results, options = {}) {
    const cacheKey = this.generateCacheKey(query, options);

    try {
      const cacheData = {
        results,
        timestamp: Date.now(),
        query: options.includeQuery ? query : undefined,
        metadata: options.metadata || {}
      };

      // Layer 1: Memory cache
      if (this.cacheConfig.memoryCache.enabled) {
        this.setToMemory(cacheKey, cacheData);
      }

      // Layer 2: KV cache
      if (this.cacheConfig.kvCache.enabled) {
        await this.setToKV(cacheKey, cacheData);
      }

      // Layer 3: D1 cache (for complex queries)
      if (options.useD1Cache || this.isComplexQuery(query)) {
        await this.setToD1(cacheKey, cacheData);
      }

      this.cacheStats.sets++;

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern, options = {}) {
    try {
      let invalidated = 0;

      if (options.invalidateMemory) {
        invalidated += this.invalidateMemory(pattern);
      }

      if (options.invalidateKV) {
        invalidated += await this.invalidateKV(pattern);
      }

      if (options.invalidateD1) {
        invalidated += await this.invalidateD1(pattern);
      }

      return invalidated;

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get from memory cache
   */
  getFromMemory(key) {
    const cached = this.memoryCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.cacheConfig.memoryCache.ttl) {
      return cached.data;
    }

    if (cached) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Set to memory cache
   */
  setToMemory(key, data) {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.cacheConfig.memoryCache.maxSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get from KV cache
   */
  async getFromKV(key) {
    try {
      const cached = await this.env.VECTOR_CACHE.get(key);

      if (cached) {
        const parsed = JSON.parse(cached);

        if (Date.now() - parsed.timestamp < this.cacheConfig.kvCache.ttl) {
          return parsed.data;
        }
      }

      return null;

    } catch (error) {
      console.error('KV cache get error:', error);
      return null;
    }
  }

  /**
   * Set to KV cache
   */
  async setToKV(key, data) {
    try {
      const serialized = JSON.stringify(data);
      await this.env.VECTOR_CACHE.put(key, serialized, {
        expirationTtl: Math.floor(this.cacheConfig.kvCache.ttl / 1000)
      });
    } catch (error) {
      console.error('KV cache set error:', error);
    }
  }

  /**
   * Get from D1 cache
   */
  async getFromD1(key) {
    try {
      const result = await this.env.D1.prepare(`
        SELECT data, timestamp FROM ${this.cacheConfig.d1Cache.tableName}
        WHERE key = ? AND timestamp > ?
      `).bind(key, Date.now() - this.cacheConfig.d1Cache.ttl).first();

      if (result) {
        return JSON.parse(result.data);
      }

      return null;

    } catch (error) {
      console.error('D1 cache get error:', error);
      return null;
    }
  }

  /**
   * Set to D1 cache
   */
  async setToD1(key, data) {
    try {
      const serialized = JSON.stringify(data);

      await this.env.D1.prepare(`
        INSERT OR REPLACE INTO ${this.cacheConfig.d1Cache.tableName}
        (key, data, timestamp) VALUES (?, ?, ?)
      `).bind(key, serialized, Date.now()).run();

    } catch (error) {
      console.error('D1 cache set error:', error);
    }
  }

  /**
   * Generate cache key from query
   */
  generateCacheKey(query, options = {}) {
    const keyData = {
      query: query.query || query.text || query,
      topK: query.topK || 10,
      namespace: query.namespace || 'default',
      filter: query.filter || {},
      includeVectors: query.includeVectors || false
    };

    // Add options that affect results
    if (options.options) {
      keyData.options = options.options;
    }

    // Sort keys for consistent hashing
    const sortedKey = JSON.stringify(keyData, Object.keys(keyData).sort());

    // Create hash
    return this.hashString(sortedKey);
  }

  /**
   * Hash string for cache key
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `vector_${hash.toString(36)}`;
  }

  /**
   * Check if query is complex (needs D1 caching)
   */
  isComplexQuery(query) {
    // Complex queries that benefit from D1 caching:
    // - Multiple vector queries
    // - Large result sets
    // - Complex filters
    // - Aggregation operations

    return (
      (query.topK && query.topK > 50) ||
      (query.filter && Object.keys(query.filter).length > 3) ||
      (query.aggregate && true) ||
      (query.multiple && true)
    );
  }

  /**
   * Invalidate memory cache entries matching pattern
   */
  invalidateMemory(pattern) {
    let invalidated = 0;
    const regex = new RegExp(pattern);

    for (const [key, value] of this.memoryCache.entries()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate KV cache entries matching pattern
   */
  async invalidateKV(pattern) {
    try {
      // KV doesn't support pattern matching directly
      // This is a simplified implementation
      // In practice, you'd maintain a key index or use prefixes
      const list = await this.env.VECTOR_CACHE.list({ prefix: pattern });
      let invalidated = 0;

      for (const key of list.keys) {
        await this.env.VECTOR_CACHE.delete(key.name);
        invalidated++;
      }

      return invalidated;

    } catch (error) {
      console.error('KV invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate D1 cache entries matching pattern
   */
  async invalidateD1(pattern) {
    try {
      const result = await this.env.D1.prepare(`
        DELETE FROM ${this.cacheConfig.d1Cache.tableName}
        WHERE key LIKE ?
      `).bind(`%${pattern}%`).run();

      return result.meta.changes || 0;

    } catch (error) {
      console.error('D1 invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)
      : 0;

    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryCacheSize: this.memoryCache.size,
      timestamp: Date.now()
    };
  }

  /**
   * Warm up cache with common queries
   */
  async warmupCache(commonQueries, options = {}) {
    const warmupResults = {
      total: commonQueries.length,
      processed: 0,
      errors: [],
      startTime: Date.now()
    };

    console.log(`Starting cache warmup for ${commonQueries.length} queries`);

    for (const query of commonQueries) {
      try {
        // Check if already cached
        const cached = await this.get(query, options);

        if (!cached) {
          // Execute query and cache results
          const results = await this.executeQuery(query);
          await this.set(query, results, options);
        }

        warmupResults.processed++;

      } catch (error) {
        console.error(`Warmup query failed:`, error);
        warmupResults.errors.push({
          query,
          error: error.message
        });
      }
    }

    warmupResults.endTime = Date.now();
    warmupResults.duration = warmupResults.endTime - warmupResults.startTime;
    warmupResults.successRate = warmupResults.processed / warmupResults.total;

    console.log(`Cache warmup completed: ${warmupResults.processed}/${warmupResults.total} in ${warmupResults.duration}ms`);

    return warmupResults;
  }

  /**
   * Execute query (to be implemented based on your Vectorize setup)
   */
  async executeQuery(query) {
    // This is a placeholder - implement based on your specific Vectorize configuration
    const queryVector = await this.generateEmbedding(query.query || query.text || query);

    const results = await this.env.VECTOR_INDEX.query(queryVector, {
      topK: query.topK || 10,
      namespace: query.namespace || 'default',
      returnVector: query.includeVectors || false,
      filter: query.filter
    });

    return results;
  }

  /**
   * Generate embedding (placeholder)
   */
  async generateEmbedding(text) {
    const response = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
      text: text.trim()
    });
    return response.data[0];
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimizeCache() {
    const stats = this.getCacheStats();
    const optimizations = [];

    // Adjust memory cache size based on hit rate
    if (stats.hitRate < 0.3 && this.cacheConfig.memoryCache.maxSize > 500) {
      this.cacheConfig.memoryCache.maxSize = Math.max(500, this.cacheConfig.memoryCache.maxSize * 0.8);
      optimizations.push('Reduced memory cache size due to low hit rate');
    }

    // Adjust TTL based on usage patterns
    if (stats.layers.d1 > stats.layers.kv * 2) {
      // More D1 hits suggests queries are complex
      // Consider reducing KV TTL to save space
      optimizations.push('Consider reducing KV TTL for complex queries');
    }

    // Clean up expired entries
    await this.cleanupExpiredEntries();

    return {
      optimizations,
      updatedConfig: this.cacheConfig,
      stats
    };
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpiredEntries() {
    try {
      // Clean up D1 cache
      await this.env.D1.prepare(`
        DELETE FROM ${this.cacheConfig.d1Cache.tableName}
        WHERE timestamp < ?
      `).bind(Date.now() - this.cacheConfig.d1Cache.ttl).run();

      // Memory cache cleanup happens automatically on access

      console.log('Cache cleanup completed');

    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Export cache configuration
   */
  exportConfig() {
    return {
      config: this.cacheConfig,
      stats: this.getCacheStats(),
      memoryCacheKeys: Array.from(this.memoryCache.keys())
    };
  }

  /**
   * Import cache configuration
   */
  importConfig(config) {
    if (config.config) {
      this.cacheConfig = { ...this.cacheConfig, ...config.config };
    }

    // Reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      layers: { memory: 0, kv: 0, d1: 0 }
    };

    console.log('Cache configuration imported');
  }
}