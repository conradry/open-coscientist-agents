/**
 * Vector Batch Processing Utilities
 * Efficient bulk operations for Vectorize with error handling and progress tracking
 */

export class VectorBatchProcessor {
  constructor(env) {
    this.env = env;
    this.defaultBatchSize = 100;
    this.maxConcurrency = 5;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
  }

  /**
   * Process bulk vector upsert operations
   */
  async bulkUpsert(vectors, options = {}) {
    const {
      batchSize = this.defaultBatchSize,
      namespace = 'default',
      concurrency = this.maxConcurrency,
      progressCallback = null,
      errorHandling = 'continue' // 'continue', 'stop', 'retry'
    } = options;

    const results = {
      total: vectors.length,
      processed: 0,
      failed: 0,
      batches: [],
      errors: [],
      startTime: Date.now()
    };

    try {
      console.log(`Starting bulk upsert of ${vectors.length} vectors`);

      // Split into batches
      const batches = this.createBatches(vectors, batchSize);
      console.log(`Created ${batches.length} batches of size ${batchSize}`);

      // Process batches with controlled concurrency
      const semaphore = new Semaphore(concurrency);
      const batchPromises = batches.map(async (batch, index) => {
        await semaphore.acquire();

        try {
          const batchResult = await this.processBatch(
            batch,
            index,
            namespace,
            errorHandling
          );

          results.processed += batchResult.processed;
          results.failed += batchResult.failed;
          results.batches.push(batchResult);

          if (progressCallback) {
            progressCallback({
              batch: index + 1,
              totalBatches: batches.length,
              processed: results.processed,
              failed: results.failed,
              batchResult
            });
          }

          return batchResult;

        } finally {
          semaphore.release();
        }
      });

      // Wait for all batches to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Handle any rejected promises
      batchResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          results.errors.push({
            batch: index,
            error: result.reason.message
          });
          results.failed += batches[index].length;
        }
      });

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = results.processed / results.total;

      console.log(`Bulk upsert completed: ${results.processed}/${results.total} processed in ${results.duration}ms`);

      return results;

    } catch (error) {
      console.error('Bulk upsert failed:', error);
      results.errors.push({ type: 'bulk_upsert_failed', error: error.message });
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      return results;
    }
  }

  /**
   * Process bulk delete operations
   */
  async bulkDelete(vectorIds, options = {}) {
    const {
      batchSize = 1000, // Larger for deletes as they're simpler
      namespace = 'default',
      concurrency = 3,
      progressCallback = null
    } = options;

    const results = {
      total: vectorIds.length,
      deleted: 0,
      failed: 0,
      batches: [],
      errors: [],
      startTime: Date.now()
    };

    try {
      console.log(`Starting bulk delete of ${vectorIds.length} vectors`);

      // Split into batches
      const batches = this.createBatches(vectorIds, batchSize);

      // Process batches
      const semaphore = new Semaphore(concurrency);
      const batchPromises = batches.map(async (batch, index) => {
        await semaphore.acquire();

        try {
          const batchResult = await this.deleteBatch(batch, index, namespace);

          results.deleted += batchResult.deleted;
          results.failed += batchResult.failed;
          results.batches.push(batchResult);

          if (progressCallback) {
            progressCallback({
              batch: index + 1,
              totalBatches: batches.length,
              deleted: results.deleted,
              failed: results.failed,
              batchResult
            });
          }

          return batchResult;

        } finally {
          semaphore.release();
        }
      });

      await Promise.allSettled(batchPromises);

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = results.deleted / results.total;

      console.log(`Bulk delete completed: ${results.deleted}/${results.total} deleted in ${results.duration}ms`);

      return results;

    } catch (error) {
      console.error('Bulk delete failed:', error);
      results.errors.push({ type: 'bulk_delete_failed', error: error.message });
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      return results;
    }
  }

  /**
   * Process bulk query operations
   */
  async bulkQuery(queries, options = {}) {
    const {
      concurrency = 10, // Higher for queries as they're read-only
      progressCallback = null
    } = options;

    const results = {
      total: queries.length,
      processed: 0,
      failed: 0,
      queryResults: [],
      errors: [],
      startTime: Date.now()
    };

    try {
      console.log(`Starting bulk query of ${queries.length} requests`);

      // Process queries with concurrency control
      const semaphore = new Semaphore(concurrency);
      const queryPromises = queries.map(async (query, index) => {
        await semaphore.acquire();

        try {
          const queryResult = await this.processQuery(query, index);

          results.processed++;
          results.queryResults.push(queryResult);

          if (progressCallback) {
            progressCallback({
              query: index + 1,
              totalQueries: queries.length,
              processed: results.processed,
              failed: results.failed
            });
          }

          return queryResult;

        } catch (error) {
          results.failed++;
          results.errors.push({
            query: index,
            error: error.message
          });
          return null;

        } finally {
          semaphore.release();
        }
      });

      const queryResults = await Promise.allSettled(queryPromises);

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = results.processed / results.total;

      console.log(`Bulk query completed: ${results.processed}/${results.total} processed in ${results.duration}ms`);

      return results;

    } catch (error) {
      console.error('Bulk query failed:', error);
      results.errors.push({ type: 'bulk_query_failed', error: error.message });
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      return results;
    }
  }

  /**
   * Process single batch of vectors
   */
  async processBatch(vectors, batchIndex, namespace, errorHandling) {
    const batchResult = {
      batchIndex,
      vectorCount: vectors.length,
      processed: 0,
      failed: 0,
      errors: [],
      startTime: Date.now()
    };

    try {
      // Prepare vectors for upsert
      const preparedVectors = vectors.map(vector => this.prepareVector(vector, namespace));

      // Attempt upsert with retry logic
      const upsertResult = await this.retryOperation(
        () => this.env.VECTOR_INDEX.upsert(preparedVectors),
        `batch_${batchIndex}_upsert`,
        errorHandling
      );

      if (upsertResult.success) {
        batchResult.processed = vectors.length;
        console.log(`Batch ${batchIndex}: Successfully upserted ${vectors.length} vectors`);
      } else {
        batchResult.failed = vectors.length;
        batchResult.errors.push(upsertResult.error);
      }

    } catch (error) {
      batchResult.failed = vectors.length;
      batchResult.errors.push({
        type: 'batch_processing_error',
        error: error.message
      });
      console.error(`Batch ${batchIndex} failed:`, error);
    }

    batchResult.endTime = Date.now();
    batchResult.duration = batchResult.endTime - batchResult.startTime;

    return batchResult;
  }

  /**
   * Process single batch delete
   */
  async deleteBatch(vectorIds, batchIndex, namespace) {
    const batchResult = {
      batchIndex,
      vectorCount: vectorIds.length,
      deleted: 0,
      failed: 0,
      errors: [],
      startTime: Date.now()
    };

    try {
      const deleteResult = await this.retryOperation(
        () => this.env.VECTOR_INDEX.deleteByIds(vectorIds, { namespace }),
        `batch_${batchIndex}_delete`,
        'continue'
      );

      if (deleteResult.success) {
        batchResult.deleted = vectorIds.length;
        console.log(`Batch ${batchIndex}: Successfully deleted ${vectorIds.length} vectors`);
      } else {
        batchResult.failed = vectorIds.length;
        batchResult.errors.push(deleteResult.error);
      }

    } catch (error) {
      batchResult.failed = vectorIds.length;
      batchResult.errors.push({
        type: 'batch_delete_error',
        error: error.message
      });
    }

    batchResult.endTime = Date.now();
    batchResult.duration = batchResult.endTime - batchResult.startTime;

    return batchResult;
  }

  /**
   * Process single query
   */
  async processQuery(query, queryIndex) {
    const queryResult = {
      queryIndex,
      query: query.query,
      topK: query.topK || 10,
      namespace: query.namespace || 'default',
      startTime: Date.now(),
      matches: [],
      error: null
    };

    try {
      // Generate embedding if query text provided
      let queryVector = query.vector;
      if (!queryVector && query.query) {
        queryVector = await this.generateEmbedding(query.query);
      }

      // Perform vector search
      const searchResult = await this.env.VECTOR_INDEX.query(queryVector, {
        topK: queryResult.topK,
        namespace: queryResult.namespace,
        returnVector: query.returnVector || false,
        filter: query.filter
      });

      queryResult.matches = searchResult.matches || [];
      console.log(`Query ${queryIndex}: Found ${queryResult.matches.length} matches`);

    } catch (error) {
      queryResult.error = error.message;
      throw error;
    }

    queryResult.endTime = Date.now();
    queryResult.duration = queryResult.endTime - queryResult.startTime;

    return queryResult;
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, operationId, errorHandling) {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt + 1 };

      } catch (error) {
        lastError = error;

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );

          console.warn(`${operationId} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
          await this.sleep(delay);

        } else {
          console.error(`${operationId} failed after ${attempt + 1} attempts:`, error);
        }
      }
    }

    if (errorHandling === 'stop') {
      throw lastError;
    } else {
      return { success: false, error: lastError.message, attempts: this.retryConfig.maxRetries + 1 };
    }
  }

  /**
   * Create batches from array
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Prepare vector for upsert
   */
  prepareVector(vector, namespace) {
    const prepared = {
      id: vector.id,
      values: vector.values,
      namespace
    };

    // Add metadata if provided
    if (vector.metadata) {
      prepared.metadata = {
        ...vector.metadata,
        indexed_at: Date.now()
      };
    } else {
      prepared.metadata = { indexed_at: Date.now() };
    }

    return prepared;
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: text.trim()
      });
      return response.data[0];
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Validate vector data
   */
  validateVectors(vectors) {
    const errors = [];

    vectors.forEach((vector, index) => {
      if (!vector.id) {
        errors.push(`Vector ${index}: Missing ID`);
      }

      if (!vector.values || !Array.isArray(vector.values)) {
        errors.push(`Vector ${index}: Missing or invalid values array`);
      } else {
        // Check vector dimension (assuming 1536 for standard embeddings)
        if (vector.values.length !== 1536) {
          errors.push(`Vector ${index}: Invalid dimension ${vector.values.length}, expected 1536`);
        }

        // Check for invalid values
        const invalidValues = vector.values.filter(v =>
          typeof v !== 'number' || isNaN(v) || !isFinite(v)
        );

        if (invalidValues.length > 0) {
          errors.push(`Vector ${index}: Contains ${invalidValues.length} invalid values`);
        }
      }

      if (vector.metadata && typeof vector.metadata !== 'object') {
        errors.push(`Vector ${index}: Metadata must be an object`);
      }
    });

    return errors;
  }

  /**
   * Get batch processing statistics
   */
  getBatchStatistics(results) {
    if (!results.batches || results.batches.length === 0) {
      return null;
    }

    const durations = results.batches.map(b => b.duration);
    const sizes = results.batches.map(b => b.vectorCount);

    return {
      batchCount: results.batches.length,
      avgBatchSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
      minBatchSize: Math.min(...sizes),
      maxBatchSize: Math.max(...sizes),
      avgBatchDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minBatchDuration: Math.min(...durations),
      maxBatchDuration: Math.max(...durations),
      totalThroughput: results.processed / (results.duration / 1000), // vectors per second
      avgThroughput: durations.reduce((sum, duration, index) =>
        sum + (sizes[index] / (duration / 1000)), 0) / durations.length
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.waitQueue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release() {
    this.currentConcurrency--;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      this.currentConcurrency++;
      next();
    }
  }
}