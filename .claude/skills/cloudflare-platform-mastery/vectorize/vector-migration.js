/**
 * Vector Migration and Deployment Strategies
 * Complete migration patterns for Vectorize with zero-downtime deployments
 */

export class VectorMigrationManager {
  constructor(env) {
    this.env = env;
    this.migrationConfig = {
      batchSize: 100,
      maxConcurrency: 3,
      timeoutMs: 300000, // 5 minutes
      retryAttempts: 3,
      validationSample: 0.1 // 10% validation sample
    };
  }

  /**
   * Migrate existing data to Vectorize
   */
  async migrateToVectorize(config = {}) {
    const {
      source = 'database',
      mapping = {},
      transformations = [],
      validation = true,
      rollback = true
    } = config;

    const migrationId = this.generateMigrationId();
    const migration = {
      id: migrationId,
      source,
      status: 'starting',
      startTime: Date.now(),
      config,
      results: {
        total: 0,
        processed: 0,
        failed: 0,
        validated: 0
      }
    };

    try {
      console.log(`Starting migration ${migrationId} from ${source}`);

      // Step 1: Create migration plan
      const plan = await this.createMigrationPlan(source, mapping, transformations);
      migration.plan = plan;

      // Step 2: Prepare target Vectorize index
      await this.prepareVectorIndex(plan);

      // Step 3: Execute migration
      const migrationResults = await this.executeMigration(plan, migration);
      migration.results = migrationResults;

      // Step 4: Validate migration if requested
      if (validation) {
        const validationResults = await this.validateMigration(plan, migrationResults);
        migration.validation = validationResults;

        if (!validationResults.success && rollback) {
          console.log('Validation failed, initiating rollback');
          await this.rollbackMigration(migrationId);
          migration.status = 'rolled_back';
        } else {
          migration.status = 'completed';
        }
      } else {
        migration.status = 'completed';
      }

      migration.endTime = Date.now();
      migration.duration = migration.endTime - migration.startTime;

      // Log migration completion
      await this.logMigration(migration);

      return migration;

    } catch (error) {
      console.error(`Migration ${migrationId} failed:`, error);
      migration.status = 'failed';
      migration.error = error.message;
      migration.endTime = Date.now();
      migration.duration = migration.endTime - migration.startTime;

      if (rollback) {
        await this.rollbackMigration(migrationId);
      }

      await this.logMigration(migration);
      throw error;
    }
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(source, mapping, transformations) {
    try {
      // Analyze source data
      const sourceAnalysis = await this.analyzeSource(source);

      // Create field mappings
      const fieldMapping = this.createFieldMapping(sourceAnalysis, mapping);

      // Define transformation pipeline
      const transformationPipeline = this.createTransformationPipeline(transformations);

      // Estimate migration parameters
      const migrationParams = this.estimateMigrationParams(sourceAnalysis);

      return {
        sourceAnalysis,
        fieldMapping,
        transformationPipeline,
        migrationParams,
        estimatedDuration: sourceAnalysis.totalRecords / migrationParams.throughput * 1000
      };

    } catch (error) {
      console.error('Failed to create migration plan:', error);
      throw error;
    }
  }

  /**
   * Execute migration in batches
   */
  async executeMigration(plan, migration) {
    const results = {
      total: plan.sourceAnalysis.totalRecords,
      processed: 0,
      failed: 0,
      batches: [],
      errors: []
    };

    try {
      // Create batches
      const batches = this.createMigrationBatches(plan);
      console.log(`Created ${batches.length} batches for migration`);

      // Process batches with controlled concurrency
      const semaphore = new Semaphore(this.migrationConfig.maxConcurrency);

      const batchPromises = batches.map(async (batch, index) => {
        await semaphore.acquire();

        try {
          const batchResult = await this.processMigrationBatch(batch, plan, index);
          results.processed += batchResult.processed;
          results.failed += batchResult.failed;
          results.batches.push(batchResult);

          // Update progress
          const progress = (results.processed / results.total) * 100;
          console.log(`Migration progress: ${progress.toFixed(2)}%`);

          return batchResult;

        } finally {
          semaphore.release();
        }
      });

      await Promise.allSettled(batchPromises);

      return results;

    } catch (error) {
      console.error('Migration execution failed:', error);
      results.errors.push({
        type: 'execution_error',
        error: error.message
      });
      return results;
    }
  }

  /**
   * Process single migration batch
   */
  async processMigrationBatch(batch, plan, batchIndex) {
    const batchResult = {
      batchIndex,
      records: batch.length,
      processed: 0,
      failed: 0,
      errors: [],
      startTime: Date.now()
    };

    try {
      // Transform records
      const transformedRecords = await this.transformRecords(batch, plan);

      // Generate embeddings for transformed records
      const vectorizedRecords = await this.vectorizeRecords(transformedRecords);

      // Upsert to Vectorize
      const upsertResult = await this.upsertVectors(vectorizedRecords, plan);

      batchResult.processed = upsertResult.successful;
      batchResult.failed = upsertResult.failed;

      console.log(`Batch ${batchIndex}: ${batchResult.processed}/${batchResult.records} processed`);

    } catch (error) {
      console.error(`Batch ${batchIndex} failed:`, error);
      batchResult.failed = batch.records;
      batchResult.errors.push({
        type: 'batch_error',
        error: error.message
      });
    }

    batchResult.endTime = Date.now();
    batchResult.duration = batchResult.endTime - batchResult.startTime;

    return batchResult;
  }

  /**
   * Transform source records according to migration plan
   */
  async transformRecords(records, plan) {
    const transformedRecords = [];

    for (const record of records) {
      try {
        let transformed = { ...record };

        // Apply field mapping
        transformed = this.applyFieldMapping(transformed, plan.fieldMapping);

        // Apply transformations
        for (const transformation of plan.transformationPipeline) {
          transformed = await this.applyTransformation(transformed, transformation);
        }

        transformedRecords.push(transformed);

      } catch (error) {
        console.error(`Record transformation failed:`, error);
        // Continue with other records
      }
    }

    return transformedRecords;
  }

  /**
   * Generate embeddings for records
   */
  async vectorizeRecords(records) {
    const vectorizedRecords = [];

    // Process in sub-batches to prevent timeouts
    const subBatchSize = 10;

    for (let i = 0; i < records.length; i += subBatchSize) {
      const subBatch = records.slice(i, i + subBatchSize);

      const embeddingPromises = subBatch.map(async (record) => {
        try {
          // Prepare text for embedding
          const text = this.prepareEmbeddingText(record);

          // Generate embedding
          const embedding = await this.generateEmbedding(text);

          return {
            id: record.id,
            values: embedding,
            metadata: this.prepareMetadata(record)
          };

        } catch (error) {
          console.error(`Embedding generation failed for record ${record.id}:`, error);
          return null;
        }
      });

      const subBatchResults = await Promise.all(embeddingPromises);
      vectorizedRecords.push(...subBatchResults.filter(r => r !== null));

      // Small delay to prevent rate limiting
      if (i + subBatchSize < records.length) {
        await this.sleep(100);
      }
    }

    return vectorizedRecords;
  }

  /**
   * Validate migration results
   */
  async validateMigration(plan, migrationResults) {
    const validation = {
      success: true,
      sampleSize: Math.floor(migrationResults.total * this.migrationConfig.validationSample),
      validations: [],
      errors: []
    };

    try {
      console.log(`Validating migration with ${validation.sampleSize} sample records`);

      // Validation 1: Count validation
      const countValidation = await this.validateRecordCount(plan, migrationResults);
      validation.validations.push(countValidation);

      // Validation 2: Content validation
      const contentValidation = await this.validateContent(plan, validation.sampleSize);
      validation.validations.push(contentValidation);

      // Validation 3: Search validation
      const searchValidation = await this.validateSearch(plan, validation.sampleSize);
      validation.validations.push(searchValidation);

      // Validation 4: Performance validation
      const performanceValidation = await this.validatePerformance();
      validation.validations.push(performanceValidation);

      // Overall validation result
      validation.success = validation.validations.every(v => v.success);

      return validation;

    } catch (error) {
      console.error('Migration validation failed:', error);
      validation.success = false;
      validation.errors.push({
        type: 'validation_error',
        error: error.message
      });
      return validation;
    }
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(migrationId) {
    try {
      console.log(`Starting rollback for migration ${migrationId}`);

      // Get migration details
      const migration = await this.getMigrationDetails(migrationId);

      // Delete vectors created by this migration
      if (migration.plan) {
        const deletedCount = await this.deleteMigrationVectors(migrationId, migration.plan);
        console.log(`Deleted ${deletedCount} vectors during rollback`);
      }

      // Mark migration as rolled back
      await this.updateMigrationStatus(migrationId, 'rolled_back');

      console.log(`Rollback completed for migration ${migrationId}`);
      return { success: true, migrationId };

    } catch (error) {
      console.error(`Rollback failed for migration ${migrationId}:`, error);
      throw error;
    }
  }

  /**
   * Blue-green deployment for Vectorize updates
   */
  async blueGreenDeployment(config = {}) {
    const {
      newNamespace = 'v2',
      trafficSplit = 0.1, // Start with 10% traffic
      validationPeriod = 300000, // 5 minutes
      autoPromote = true
    } = config;

    try {
      console.log('Starting blue-green deployment');

      // Step 1: Deploy to green (new namespace)
      await this.deployToGreen(newNamespace);

      // Step 2: Validate green deployment
      const greenValidation = await this.validateGreenDeployment(newNamespace);
      if (!greenValidation.success) {
        throw new Error('Green deployment validation failed');
      }

      // Step 3: Gradual traffic shifting
      let currentSplit = trafficSplit;

      while (currentSplit < 1.0) {
        console.log(`Shifting ${currentSplit * 100}% traffic to green`);

        await this.updateTrafficSplit(currentSplit, newNamespace);

        // Monitor for validation period
        await this.sleep(validationPeriod);

        const healthCheck = await this.checkDeploymentHealth(newNamespace);
        if (!healthCheck.healthy) {
          console.log('Health check failed, rolling back');
          await this.rollbackTrafficSplit();
          throw new Error('Health check failed during traffic shift');
        }

        // Increase traffic split
        currentSplit = Math.min(1.0, currentSplit * 2);
      }

      // Step 4: Full promotion
      if (autoPromote) {
        await this.promoteGreenDeployment(newNamespace);
        console.log('Green deployment promoted to primary');
      }

      return {
        success: true,
        namespace: newNamespace,
        finalTrafficSplit: 1.0
      };

    } catch (error) {
      console.error('Blue-green deployment failed:', error);
      await this.rollbackTrafficSplit();
      throw error;
    }
  }

  /**
   * Canaly deployment with gradual rollout
   */
  async canaryDeployment(config = {}) {
    const {
      canaryNamespace = 'canary',
      initialTraffic = 0.05, // 5% initial traffic
      maxTraffic = 0.5, // Maximum canary traffic
      evaluationPeriod = 600000, // 10 minutes
      successThreshold = 0.95,
      metrics = ['error_rate', 'response_time', 'throughput']
    } = config;

    try {
      console.log('Starting canary deployment');

      // Step 1: Deploy canary
      await this.deployCanary(canaryNamespace);

      // Step 2: Monitor canary with increasing traffic
      let currentTraffic = initialTraffic;
      let promotionRound = 1;

      while (currentTraffic <= maxTraffic) {
        console.log(`Canary round ${promotionRound}: ${currentTraffic * 100}% traffic`);

        // Route traffic to canary
        await this.updateCanaryTraffic(currentTraffic, canaryNamespace);

        // Wait for evaluation period
        await this.sleep(evaluationPeriod);

        // Evaluate canary performance
        const evaluation = await this.evaluateCanary(canaryNamespace, metrics);

        console.log(`Canary evaluation:`, evaluation);

        if (evaluation.score >= successThreshold) {
          console.log('Canary performing well, increasing traffic');
          currentTraffic = Math.min(maxTraffic, currentTraffic * 2);
          promotionRound++;
        } else {
          console.log('Canary performance below threshold, aborting');
          await this.abortCanary(canaryNamespace);
          throw new Error(`Canary performance ${evaluation.score} below threshold ${successThreshold}`);
        }
      }

      // Step 3: Full rollout
      await this.promoteCanary(canaryNamespace);
      console.log('Canary deployment fully promoted');

      return {
        success: true,
        namespace: canaryNamespace,
        finalScore: evaluation.score,
        rounds: promotionRound
      };

    } catch (error) {
      console.error('Canary deployment failed:', error);
      await this.abortCanary(canaryNamespace);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  generateMigrationId() {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async analyzeSource(source) {
    // Analyze source data structure and volume
    switch (source) {
      case 'database':
        return await this.analyzeDatabaseSource();
      case 'file':
        return await this.analyzeFileSource();
      default:
        throw new Error(`Unsupported source: ${source}`);
    }
  }

  async analyzeDatabaseSource() {
    const result = await this.env.D1.prepare(`
      SELECT
        COUNT(*) as totalRecords,
        MIN(created_at) as oldestRecord,
        MAX(created_at) as newestRecord
      FROM documents
    `).first();

    return {
      type: 'database',
      totalRecords: result.totalRecords,
      dateRange: {
        oldest: result.oldestRecord,
        newest: result.newestRecord
      }
    };
  }

  createFieldMapping(sourceAnalysis, customMapping) {
    // Default field mappings for common data structures
    const defaultMapping = {
      id: 'id',
      title: 'title',
      content: 'content',
      abstract: 'abstract',
      metadata: {
        category: 'category',
        source: 'source',
        created_at: 'created_at'
      }
    };

    return { ...defaultMapping, ...customMapping };
  }

  createTransformationPipeline(transformations) {
    const defaultPipeline = [
      {
        type: 'text_cleaning',
        config: { removeHtml: true, normalizeWhitespace: true }
      },
      {
        type: 'length_validation',
        config: { minLength: 10, maxLength: 8000 }
      }
    ];

    return [...defaultPipeline, ...transformations];
  }

  estimateMigrationParams(sourceAnalysis) {
    return {
      batchSize: this.migrationConfig.batchSize,
      concurrency: this.migrationConfig.maxConcurrency,
      throughput: 10 // records per second estimate
    };
  }

  prepareEmbeddingText(record) {
    const textParts = [
      record.title || '',
      record.abstract || record.content?.substring(0, 1000) || ''
    ];

    return textParts.filter(Boolean).join(' ').trim();
  }

  prepareMetadata(record) {
    return {
      title: record.title,
      source: record.source,
      category: record.category,
      created_at: record.created_at,
      migrated_at: Date.now()
    };
  }

  async generateEmbedding(text) {
    const response = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
      text: text.trim()
    });
    return response.data[0];
  }

  async upsertVectors(vectors, plan) {
    try {
      const result = await this.env.VECTOR_INDEX.upsert(vectors);
      return {
        successful: vectors.length,
        failed: 0,
        result
      };
    } catch (error) {
      console.error('Vector upsert failed:', error);
      return {
        successful: 0,
        failed: vectors.length,
        error: error.message
      };
    }
  }

  async sleep(ms) {
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