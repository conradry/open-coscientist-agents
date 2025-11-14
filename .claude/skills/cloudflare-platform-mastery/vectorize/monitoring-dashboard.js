/**
 * Vectorize Monitoring Dashboard
 * Real-time performance monitoring and analytics for Vectorize operations
 */

export class VectorizeMonitoring {
  constructor(env) {
    this.env = env;
    this.metricsBuffer = [];
    this.alertThresholds = {
      responseTime: 1000, // ms
      errorRate: 0.05, // 5%
      cacheHitRate: 0.3, // 30%
      memoryUsage: 0.8, // 80%
      concurrentQueries: 100
    };
  }

  /**
   * Record a metric event
   */
  async recordMetric(event) {
    const metric = {
      ...event,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };

    // Add to buffer
    this.metricsBuffer.push(metric);

    // Process metric
    await this.processMetric(metric);

    // Check alerts
    await this.checkAlerts(metric);

    // Cleanup old metrics
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-500);
    }
  }

  /**
   * Process and aggregate metrics
   */
  async processMetric(metric) {
    switch (metric.type) {
      case 'vector_query':
        await this.processVectorQueryMetric(metric);
        break;

      case 'vector_index':
        await this.processVectorIndexMetric(metric);
        break;

      case 'batch_operation':
        await this.processBatchOperationMetric(metric);
        break;

      case 'cache_operation':
        await this.processCacheOperationMetric(metric);
        break;

      case 'system_health':
        await this.processSystemHealthMetric(metric);
        break;
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(timeRange = '1h') {
    try {
      const endTime = Date.now();
      const startTime = this.getStartTime(timeRange, endTime);

      const dashboardData = {
        timeRange,
        period: { start: startTime, end: endTime },
        overview: await this.getOverviewMetrics(startTime, endTime),
        performance: await this.getPerformanceMetrics(startTime, endTime),
        usage: await this.getUsageMetrics(startTime, endTime),
        errors: await this.getErrorMetrics(startTime, endTime),
        cache: await this.getCacheMetrics(startTime, endTime),
        alerts: await this.getRecentAlerts(startTime, endTime),
        trends: await this.getTrendMetrics(startTime, endTime)
      };

      return dashboardData;

    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      throw new Error(`Dashboard data retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get overview metrics
   */
  async getOverviewMetrics(startTime, endTime) {
    try {
      const [totalQueries, totalIndexes, totalErrors, avgResponseTime] = await Promise.all([
        this.getTotalQueries(startTime, endTime),
        this.getTotalIndexes(startTime, endTime),
        this.getTotalErrors(startTime, endTime),
        this.getAverageResponseTime(startTime, endTime)
      ]);

      const totalOperations = totalQueries + totalIndexes;
      const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;
      const healthScore = this.calculateHealthScore(errorRate, avgResponseTime);

      return {
        totalQueries,
        totalIndexes,
        totalErrors,
        errorRate: Math.round(errorRate * 10000) / 100, // percentage to 2 decimal places
        avgResponseTime: Math.round(avgResponseTime),
        healthScore,
        status: this.getSystemStatus(healthScore)
      };

    } catch (error) {
      console.error('Overview metrics failed:', error);
      return this.getDefaultOverviewMetrics();
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(startTime, endTime) {
    try {
      const [responseTimes, throughput, latencyPercentiles] = await Promise.all([
        this.getResponseTimeSeries(startTime, endTime),
        this.getThroughputMetrics(startTime, endTime),
        this.getLatencyPercentiles(startTime, endTime)
      ]);

      return {
        responseTime: responseTimes,
        throughput,
        latencyPercentiles,
        performanceScore: this.calculatePerformanceScore(latencyPercentiles)
      };

    } catch (error) {
      console.error('Performance metrics failed:', error);
      return this.getDefaultPerformanceMetrics();
    }
  }

  /**
   * Get usage metrics
   */
  async getUsageMetrics(startTime, endTime) {
    try {
      const [queryVolume, namespaceUsage, operationDistribution] = await Promise.all([
        this.getQueryVolume(startTime, endTime),
        this.getNamespaceUsage(startTime, endTime),
        this.getOperationDistribution(startTime, endTime)
      ]);

      return {
        queryVolume,
        namespaceUsage,
        operationDistribution
      };

    } catch (error) {
      console.error('Usage metrics failed:', error);
      return this.getDefaultUsageMetrics();
    }
  }

  /**
   * Get error metrics
   */
  async getErrorMetrics(startTime, endTime) {
    try {
      const [errorRate, errorTypes, recentErrors] = await Promise.all([
        this.getErrorRate(startTime, endTime),
        this.getErrorTypeDistribution(startTime, endTime),
        this.getRecentErrors(startTime, endTime)
      ]);

      return {
        errorRate,
        errorTypes,
        recentErrors
      };

    } catch (error) {
      console.error('Error metrics failed:', error);
      return this.getDefaultErrorMetrics();
    }
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics(startTime, endTime) {
    try {
      const [hitRate, cacheSize, cachePerformance] = await Promise.all([
        this.getCacheHitRate(startTime, endTime),
        this.getCacheSize(startTime, endTime),
        this.getCachePerformance(startTime, endTime)
      ]);

      return {
        hitRate,
        cacheSize,
        cachePerformance
      };

    } catch (error) {
      console.error('Cache metrics failed:', error);
      return this.getDefaultCacheMetrics();
    }
  }

  /**
   * Get trend metrics
   */
  async getTrendMetrics(startTime, endTime) {
    try {
      const [queryTrend, performanceTrend, errorTrend] = await Promise.all([
        this.getQueryTrend(startTime, endTime),
        this.getPerformanceTrend(startTime, endTime),
        this.getErrorTrend(startTime, endTime)
      ]);

      return {
        queries: queryTrend,
        performance: performanceTrend,
        errors: errorTrend
      };

    } catch (error) {
      console.error('Trend metrics failed:', error);
      return this.getDefaultTrendMetrics();
    }
  }

  /**
   * Get system health check
   */
  async getSystemHealth() {
    try {
      const healthChecks = await Promise.allSettled([
        this.checkVectorizeHealth(),
        this.checkAIHealth(),
        this.checkCacheHealth(),
        this.checkDatabaseHealth()
      ]);

      const healthResults = healthChecks.map((check, index) => {
        const checkNames = ['vectorize', 'ai', 'cache', 'database'];
        return {
          name: checkNames[index],
          status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          responseTime: check.status === 'fulfilled' ? check.value.responseTime : null,
          error: check.status === 'rejected' ? check.reason.message : null
        };
      });

      const overallHealth = healthResults.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';

      return {
        overall: overallHealth,
        checks: healthResults,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('System health check failed:', error);
      return {
        overall: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Create alert
   */
  async createAlert(type, severity, message, metadata = {}) {
    const alert = {
      id: crypto.randomUUID(),
      type,
      severity, // 'critical', 'warning', 'info'
      message,
      metadata,
      timestamp: Date.now(),
      status: 'active',
      acknowledged: false
    };

    try {
      // Store alert in D1
      await this.env.D1.prepare(`
        INSERT INTO vectorize_alerts (id, type, severity, message, metadata, timestamp, status, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        alert.id,
        alert.type,
        alert.severity,
        alert.message,
        JSON.stringify(metadata),
        alert.timestamp,
        alert.status,
        alert.acknowledged
      ).run();

      // Send notification if critical
      if (severity === 'critical') {
        await this.sendAlertNotification(alert);
      }

      console.log('Alert created:', alert);
      return alert;

    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      await this.env.D1.prepare(`
        UPDATE vectorize_alerts
        SET acknowledged = true, acknowledged_by = ?, acknowledged_at = ?
        WHERE id = ?
      `).bind(userId, Date.now(), alertId).run();

      return { success: true, alertId, acknowledgedBy: userId };

    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Process vector query metric
   */
  async processVectorQueryMetric(metric) {
    // Store in time-series table for analysis
    await this.env.D1.prepare(`
      INSERT INTO vector_query_metrics (
        timestamp, query_type, namespace, top_k, response_time,
        result_count, cache_hit, error, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metric.timestamp,
      metric.queryType || 'unknown',
      metric.namespace || 'default',
      metric.topK || 10,
      metric.responseTime || 0,
      metric.resultCount || 0,
      metric.cacheHit || false,
      metric.error || null,
      metric.userId || null
    ).run();
  }

  /**
   * Process vector index metric
   */
  async processVectorIndexMetric(metric) {
    await this.env.D1.prepare(`
      INSERT INTO vector_index_metrics (
        timestamp, operation, namespace, vector_count,
        batch_size, duration, error, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metric.timestamp,
      metric.operation,
      metric.namespace || 'default',
      metric.vectorCount || 0,
      metric.batchSize || 1,
      metric.duration || 0,
      metric.error || null,
      metric.userId || null
    ).run();
  }

  /**
   * Check for alerts based on metric thresholds
   */
  async checkAlerts(metric) {
    // Response time alert
    if (metric.responseTime > this.alertThresholds.responseTime) {
      await this.createAlert(
        'performance',
        'warning',
        `High response time detected: ${metric.responseTime}ms`,
        { threshold: this.alertThresholds.responseTime, actual: metric.responseTime }
      );
    }

    // Error rate alert
    if (metric.error) {
      await this.createAlert(
        'error',
        'critical',
        `Vector operation failed: ${metric.error}`,
        { operation: metric.operation, error: metric.error }
      );
    }

    // Concurrency alert (simplified)
    const currentConcurrency = this.getCurrentConcurrency();
    if (currentConcurrency > this.alertThresholds.concurrentQueries) {
      await this.createAlert(
        'capacity',
        'warning',
        `High query concurrency: ${currentConcurrency}`,
        { current: currentConcurrency, threshold: this.alertThresholds.concurrentQueries }
      );
    }
  }

  /**
   * Check Vectorize health
   */
  async checkVectorizeHealth() {
    const startTime = Date.now();
    try {
      // Simple health check - try to describe index
      await this.env.VECTOR_INDEX.describe();
      return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
      throw new Error(`Vectorize health check failed: ${error.message}`);
    }
  }

  /**
   * Check AI health
   */
  async checkAIHealth() {
    const startTime = Date.now();
    try {
      // Test AI endpoint with simple embedding
      await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: 'health check'
      });
      return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
      throw new Error(`AI health check failed: ${error.message}`);
    }
  }

  /**
   * Check cache health
   */
  async checkCacheHealth() {
    const startTime = Date.now();
    try {
      // Test cache operations
      await this.env.VECTOR_CACHE.get('health_check');
      return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
      throw new Error(`Cache health check failed: ${error.message}`);
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    const startTime = Date.now();
    try {
      // Test D1 connection
      await this.env.D1.prepare('SELECT 1').first();
      return { healthy: true, responseTime: Date.now() - startTime };
    } catch (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
  }

  /**
   * Helper methods for metric calculations
   */
  getStartTime(timeRange, endTime) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return endTime - (ranges[timeRange] || ranges['1h']);
  }

  calculateHealthScore(errorRate, avgResponseTime) {
    const errorScore = Math.max(0, 1 - (errorRate * 10)); // Scale error impact
    const performanceScore = Math.max(0, 1 - (avgResponseTime / 2000)); // 2s as max acceptable
    return Math.round(((errorScore + performanceScore) / 2) * 100);
  }

  getSystemStatus(healthScore) {
    if (healthScore >= 90) return 'excellent';
    if (healthScore >= 70) return 'good';
    if (healthScore >= 50) return 'degraded';
    return 'poor';
  }

  getCurrentConcurrency() {
    // This would be implemented based on your concurrency tracking
    // For now, return a placeholder
    return this.metricsBuffer.filter(m =>
      m.type === 'vector_query' &&
      Date.now() - m.timestamp < 60000 // Last minute
    ).length;
  }

  async sendAlertNotification(alert) {
    // Implement notification sending (email, webhook, etc.)
    console.log('CRITICAL ALERT:', alert);
    // This could integrate with external notification services
  }

  // Default metric implementations
  getDefaultOverviewMetrics() {
    return {
      totalQueries: 0,
      totalIndexes: 0,
      totalErrors: 0,
      errorRate: 0,
      avgResponseTime: 0,
      healthScore: 0,
      status: 'unknown'
    };
  }

  getDefaultPerformanceMetrics() {
    return {
      responseTime: [],
      throughput: { current: 0, peak: 0, average: 0 },
      latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
      performanceScore: 0
    };
  }

  // Placeholder implementations for database queries
  async getTotalQueries(startTime, endTime) {
    const result = await this.env.D1.prepare(`
      SELECT COUNT(*) as count FROM vector_query_metrics
      WHERE timestamp BETWEEN ? AND ?
    `).bind(startTime, endTime).first();
    return result?.count || 0;
  }

  async getTotalIndexes(startTime, endTime) {
    const result = await this.env.D1.prepare(`
      SELECT COUNT(*) as count FROM vector_index_metrics
      WHERE timestamp BETWEEN ? AND ?
    `).bind(startTime, endTime).first();
    return result?.count || 0;
  }

  async getTotalErrors(startTime, endTime) {
    const result = await this.env.D1.prepare(`
      SELECT COUNT(*) as count FROM vector_query_metrics
      WHERE timestamp BETWEEN ? AND ? AND error IS NOT NULL
    `).bind(startTime, endTime).first();
    return result?.count || 0;
  }

  async getAverageResponseTime(startTime, endTime) {
    const result = await this.env.D1.prepare(`
      SELECT AVG(response_time) as avg_time FROM vector_query_metrics
      WHERE timestamp BETWEEN ? AND ? AND error IS NULL
    `).bind(startTime, endTime).first();
    return result?.avg_time || 0;
  }
}