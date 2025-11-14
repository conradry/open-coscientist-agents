/**
 * Data Synchronization for Vectorize + D1 Integration
 * Ensures consistency between vector and relational data stores
 */

export class DataSynchronizer {
  constructor(env) {
    this.env = env;
    this.batchSize = 100;
    this.maxRetries = 3;
  }

  /**
   * Perform full synchronization from D1 to Vectorize
   */
  async performFullSync(namespace = 'documents', options = {}) {
    const {
      batchSize = this.batchSize,
      skipExisting = false,
      updateExisting = true
    } = options;

    const syncResult = {
      startTime: Date.now(),
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      batches: [],
      errors: []
    };

    try {
      console.log('Starting full synchronization...');

      // Get total document count
      const countResult = await this.env.D1.prepare(
        'SELECT COUNT(*) as total FROM documents'
      ).first();

      syncResult.totalDocuments = countResult.total;

      // Process documents in batches
      let offset = 0;
      let batchCount = 0;

      while (offset < syncResult.totalDocuments) {
        batchCount++;
        console.log(`Processing batch ${batchCount} (offset: ${offset})`);

        try {
          // Get batch of documents
          const documents = await this.getBatchOfDocuments(offset, batchSize);

          if (documents.length === 0) {
            break;
          }

          // Process batch
          const batchResult = await this.processBatch(documents, {
            namespace,
            skipExisting,
            updateExisting
          });

          syncResult.processedDocuments += batchResult.processed;
          syncResult.failedDocuments += batchResult.failed;
          syncResult.batches.push(batchResult);

          offset += batchSize;

          // Add delay to prevent rate limiting
          await this.sleep(200);

        } catch (batchError) {
          console.error(`Batch ${batchCount} failed:`, batchError);
          syncResult.errors.push({
            batch: batchCount,
            error: batchError.message
          });
          offset += batchSize;
        }
      }

      syncResult.endTime = Date.now();
      syncResult.duration = syncResult.endTime - syncResult.startTime;

      console.log('Full synchronization completed:', syncResult);
      return syncResult;

    } catch (error) {
      console.error('Full synchronization failed:', error);
      syncResult.errors.push({
        type: 'sync_failed',
        error: error.message
      });
      return syncResult;
    }
  }

  /**
   * Perform incremental synchronization based on timestamps
   */
  async performIncrementalSync(namespace = 'documents', lastSyncTime = null) {
    const syncResult = {
      startTime: Date.now(),
      lastSyncTime,
      updatedDocuments: 0,
      deletedDocuments: 0,
      errors: []
    };

    try {
      console.log('Starting incremental synchronization...');

      // Get last sync time if not provided
      if (!lastSyncTime) {
        const lastSync = await this.getLastSyncTimestamp();
        lastSyncTime = lastSync?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24h ago
      }

      // Get updated documents
      const updatedDocs = await this.getUpdatedDocuments(lastSyncTime);
      console.log(`Found ${updatedDocs.length} updated documents`);

      // Process updates
      for (const document of updatedDocs) {
        try {
          await this.updateDocumentInVectorize(document, namespace);
          syncResult.updatedDocuments++;
        } catch (error) {
          console.error(`Failed to update document ${document.id}:`, error);
          syncResult.errors.push({
            documentId: document.id,
            error: error.message
          });
        }
      }

      // Find and clean up deleted documents
      const deletedIds = await this.findDeletedDocuments(lastSyncTime);
      console.log(`Found ${deletedIds.length} deleted documents`);

      for (const id of deletedIds) {
        try {
          await this.deleteDocumentFromVectorize(id, namespace);
          syncResult.deletedDocuments++;
        } catch (error) {
          console.error(`Failed to delete document ${id}:`, error);
          syncResult.errors.push({
            documentId: id,
            error: error.message
          });
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(Date.now());

      syncResult.endTime = Date.now();
      syncResult.duration = syncResult.endTime - syncResult.startTime;

      console.log('Incremental synchronization completed:', syncResult);
      return syncResult;

    } catch (error) {
      console.error('Incremental synchronization failed:', error);
      syncResult.errors.push({
        type: 'incremental_sync_failed',
        error: error.message
      });
      return syncResult;
    }
  }

  /**
   * Repair missing documents between D1 and Vectorize
   */
  async repairMissingDocuments(namespace = 'documents') {
    const repairResult = {
      startTime: Date.now(),
      d1Documents: 0,
      vectorizeDocuments: 0,
      missingInVectorize: [],
      missingInD1: [],
      repaired: 0,
      errors: []
    };

    try {
      console.log('Starting document repair...');

      // Get all document IDs from D1
      const d1Ids = await this.getAllDocumentIds('d1');
      repairResult.d1Documents = d1Ids.length;

      // Get all document IDs from Vectorize (sample approach for large indexes)
      const vectorizeIds = await this.getAllDocumentIds('vectorize', namespace);
      repairResult.vectorizeDocuments = vectorizeIds.length;

      // Find documents missing in Vectorize
      const missingInVectorize = d1Ids.filter(id => !vectorizeIds.includes(id));
      repairResult.missingInVectorize = missingInVectorize;

      // Find documents missing in D1 (orphaned vectors)
      const missingInD1 = vectorizeIds.filter(id => !d1Ids.includes(id));
      repairResult.missingInD1 = missingInD1;

      // Repair missing in Vectorize
      console.log(`Repairing ${missingInVectorize.length} documents missing from Vectorize`);
      for (const id of missingInVectorize.slice(0, 100)) { // Limit to prevent timeouts
        try {
          const document = await this.getDocumentFromD1(id);
          if (document) {
            await this.indexDocumentInVectorize(document, namespace);
            repairResult.repaired++;
          }
        } catch (error) {
          console.error(`Failed to repair document ${id}:`, error);
          repairResult.errors.push({
            documentId: id,
            error: error.message
          });
        }
      }

      // Clean up orphaned vectors in Vectorize
      console.log(`Cleaning up ${missingInD1.length} orphaned vectors`);
      await this.cleanupOrphanedVectors(missingInD1, namespace);

      repairResult.endTime = Date.now();
      repairResult.duration = repairResult.endTime - repairResult.startTime;

      console.log('Document repair completed:', repairResult);
      return repairResult;

    } catch (error) {
      console.error('Document repair failed:', error);
      repairResult.errors.push({
        type: 'repair_failed',
        error: error.message
      });
      return repairResult;
    }
  }

  /**
   * Get batch of documents from D1
   */
  async getBatchOfDocuments(offset, limit) {
    const result = await this.env.D1.prepare(`
      SELECT
        id, title, content, abstract, authors, journal,
        publication_date, source, created_at, updated_at
      FROM documents
      ORDER BY id
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return result.results;
  }

  /**
   * Process a batch of documents for synchronization
   */
  async processBatch(documents, options) {
    const batchResult = {
      batchId: Date.now(),
      documentCount: documents.length,
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const document of documents) {
      try {
        // Check if document exists in Vectorize
        const exists = options.skipExisting && await this.documentExistsInVectorize(document.id, options.namespace);

        if (exists && !options.updateExisting) {
          batchResult.skipped++;
          continue;
        }

        // Generate embedding and index in Vectorize
        await this.indexDocumentInVectorize(document, options.namespace);
        batchResult.processed++;

      } catch (error) {
        console.error(`Failed to process document ${document.id}:`, error);
        batchResult.failed++;
        batchResult.errors.push({
          documentId: document.id,
          error: error.message
        });
      }
    }

    return batchResult;
  }

  /**
   * Index document in Vectorize with retry logic
   */
  async indexDocumentInVectorize(document, namespace, retryCount = 0) {
    try {
      // Prepare content for embedding
      const content = `${document.title} ${document.abstract || document.content}`.substring(0, 8000);

      // Generate embedding
      const embedding = await this.generateEmbedding(content);

      // Prepare vector data
      const vectorData = {
        id: document.id,
        values: embedding,
        namespace,
        metadata: {
          title: document.title,
          content: document.content?.substring(0, 1000),
          abstract: document.abstract,
          authors: JSON.parse(document.authors || '[]'),
          journal: document.journal,
          publication_date: document.publication_date,
          source: document.source,
          created_at: document.created_at,
          updated_at: document.updated_at,
          synced_at: Date.now()
        }
      };

      // Upsert to Vectorize
      const result = await this.env.VECTOR_INDEX.upsert([vectorData]);
      return result;

    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.warn(`Retrying document ${document.id} (attempt ${retryCount + 1})`);
        await this.sleep(1000 * (retryCount + 1)); // Exponential backoff
        return this.indexDocumentInVectorize(document, namespace, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Update document in Vectorize
   */
  async updateDocumentInVectorize(document, namespace) {
    return this.indexDocumentInVectorize(document, namespace);
  }

  /**
   * Delete document from Vectorize
   */
  async deleteDocumentFromVectorize(documentId, namespace) {
    try {
      const result = await this.env.VECTOR_INDEX.deleteByIds([documentId], { namespace });
      return result;
    } catch (error) {
      console.error(`Failed to delete document ${documentId} from Vectorize:`, error);
      throw error;
    }
  }

  /**
   * Get updated documents since last sync
   */
  async getUpdatedDocuments(lastSyncTime) {
    const result = await this.env.D1.prepare(`
      SELECT
        id, title, content, abstract, authors, journal,
        publication_date, source, created_at, updated_at
      FROM documents
      WHERE updated_at > datetime(?, 'unixepoch')
      ORDER BY updated_at
    `).bind(lastSyncTime / 1000).all();

    return result.results;
  }

  /**
   * Find documents that have been deleted
   */
  async findDeletedDocuments(lastSyncTime) {
    // This is a simplified approach - in practice you might use a deletion log table
    const result = await this.env.D1.prepare(`
      SELECT id FROM deletion_log
      WHERE deleted_at > datetime(?, 'unixepoch')
      AND synced = 0
    `).bind(lastSyncTime / 1000).all();

    return result.results.map(row => row.id);
  }

  /**
   * Get all document IDs from specified source
   */
  async getAllDocumentIds(source, namespace = null) {
    let ids = [];

    try {
      if (source === 'd1') {
        const result = await this.env.D1.prepare('SELECT id FROM documents').all();
        ids = result.results.map(row => row.id);
      } else if (source === 'vectorize' && namespace) {
        // For Vectorize, we need to use a different approach
        // This is a simplified version - in practice you might maintain a separate index
        const result = await this.env.VECTOR_INDEX.describe();
        // Note: Vectorize doesn't have a direct way to list all IDs
        // You would need to maintain your own index or use pagination
      }
    } catch (error) {
      console.error(`Failed to get document IDs from ${source}:`, error);
    }

    return ids;
  }

  /**
   * Get document from D1
   */
  async getDocumentFromD1(documentId) {
    const result = await this.env.D1.prepare(`
      SELECT
        id, title, content, abstract, authors, journal,
        publication_date, source, created_at, updated_at
      FROM documents
      WHERE id = ?
    `).bind(documentId).first();

    return result;
  }

  /**
   * Check if document exists in Vectorize
   */
  async documentExistsInVectorize(documentId, namespace) {
    try {
      // Try to query the specific document
      const result = await this.env.VECTOR_INDEX.query(
        new Array(1536).fill(0), // Zero vector (will return exact matches)
        {
          topK: 1,
          namespace,
          filter: { id: { $eq: documentId } }
        }
      );

      return result.matches.length > 0;
    } catch (error) {
      console.error(`Failed to check if document exists in Vectorize:`, error);
      return false;
    }
  }

  /**
   * Generate embedding using Workers AI
   */
  async generateEmbedding(text) {
    try {
      const response = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: text.trim()
      });
      return response.data[0];
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp() {
    const result = await this.env.D1.prepare(`
      SELECT timestamp FROM sync_status
      WHERE source = 'vectorize'
      ORDER BY timestamp DESC
      LIMIT 1
    `).first();

    return result;
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSyncTimestamp(timestamp) {
    await this.env.D1.prepare(`
      INSERT OR REPLACE INTO sync_status (source, timestamp)
      VALUES ('vectorize', ?)
    `).bind(timestamp).run();
  }

  /**
   * Clean up orphaned vectors
   */
  async cleanupOrphanedVectors(documentIds, namespace) {
    try {
      // Delete in batches to avoid timeouts
      const batchSize = 50;
      for (let i = 0; i < documentIds.length; i += batchSize) {
        const batch = documentIds.slice(i, i + batchSize);
        await this.env.VECTOR_INDEX.deleteByIds(batch, { namespace });

        if (i + batchSize < documentIds.length) {
          await this.sleep(500);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned vectors:', error);
    }
  }

  /**
   * Validate synchronization integrity
   */
  async validateIntegrity(namespace = 'documents', sampleSize = 100) {
    const validationResult = {
      startTime: Date.now(),
      sampleSize,
      matched: 0,
      mismatched: 0,
      missingVector: 0,
      missingD1: 0,
      scoreMismatch: 0,
      errors: []
    };

    try {
      // Get sample documents from D1
      const sampleDocs = await this.env.D1.prepare(`
        SELECT id FROM documents
        ORDER BY RANDOM()
        LIMIT ?
      `).bind(sampleSize).all();

      for (const doc of sampleDocs.results) {
        try {
          // Check if document exists in both
          const d1Doc = await this.getDocumentFromD1(doc.id);
          const vectorExists = await this.documentExistsInVectorize(doc.id, namespace);

          if (!d1Doc) {
            validationResult.missingD1++;
            continue;
          }

          if (!vectorExists) {
            validationResult.missingVector++;
            continue;
          }

          // Compare metadata (simplified)
          // In practice, you might compare more fields
          validationResult.matched++;

        } catch (error) {
          validationResult.mismatched++;
          validationResult.errors.push({
            documentId: doc.id,
            error: error.message
          });
        }
      }

      validationResult.endTime = Date.now();
      validationResult.duration = validationResult.endTime - validationResult.startTime;
      validationResult.integrityScore = validationResult.matched / sampleSize;

      return validationResult;

    } catch (error) {
      console.error('Integrity validation failed:', error);
      validationResult.errors.push({
        type: 'validation_failed',
        error: error.message
      });
      return validationResult;
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}