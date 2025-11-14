/**
 * Container Health Monitoring and Checks
 *
 * Comprehensive health check system for Cloudflare Container services
 * with Workers integration for distributed monitoring.
 */

class ContainerHealthMonitor {
  constructor(env = {}) {
    this.env = env;
    this.healthChecks = new Map();
    this.metrics = new Map();
    this.alerts = new Map();
    this.circuitBreakers = new Map();
  }

  // Health check configuration
  createHealthCheck(serviceName, config) {
    const healthCheck = {
      serviceName,
      path: config.path || '/health',
      method: config.method || 'GET',
      headers: config.headers || {},
      expectedStatus: config.expectedStatus || [200, 201],
      timeout: config.timeout || 5000,
      interval: config.interval || 30000,
      retries: config.retries || 3,
      gracePeriod: config.gracePeriod || 0,
      checkType: config.checkType || 'http', // http, tcp, grpc, exec
      successThreshold: config.successThreshold || 1,
      failureThreshold: config.failureThreshold || 3,
      metrics: {
        collectLatency: config.collectLatency !== false,
        collectThroughput: config.collectThroughput !== false,
        collectErrorRate: config.collectErrorRate !== false
      },
      alerting: {
        enabled: config.alerting !== false,
        channels: config.alertChannels || ['email'],
        thresholds: config.alertThresholds || {
          errorRate: 0.05,
          responseTime: 2000,
          consecutiveFailures: 3
        }
      }
    };

    this.healthChecks.set(serviceName, healthCheck);
    this.initializeMetrics(serviceName);

    return healthCheck;
  }

  async performHealthCheck(serviceName, endpoint) {
    const healthCheck = this.healthChecks.get(serviceName);
    if (!healthCheck) {
      throw new Error(`Health check not configured for service: ${serviceName}`);
    }

    const startTime = Date.now();
    let success = false;
    let responseTime = 0;
    let statusCode = null;
    let error = null;

    try {
      const result = await this.executeHealthCheck(healthCheck, endpoint);
      success = result.success;
      responseTime = result.responseTime;
      statusCode = result.statusCode;

      // Update circuit breaker
      this.updateCircuitBreaker(serviceName, success);

    } catch (err) {
      error = err.message;
      success = false;
      this.updateCircuitBreaker(serviceName, false);
    }

    // Record metrics
    this.recordHealthMetrics(serviceName, {
      success,
      responseTime,
      statusCode,
      error,
      timestamp: new Date().toISOString()
    });

    // Check for alerts
    await this.checkAlerts(serviceName);

    return {
      serviceName,
      endpoint: endpoint.url,
      healthy: success,
      responseTime,
      statusCode,
      error,
      timestamp: new Date().toISOString()
    };
  }

  async executeHealthCheck(healthCheck, endpoint) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthCheck.timeout);

    try {
      let result;

      switch (healthCheck.checkType) {
        case 'http':
          result = await this.performHTTPHealthCheck(healthCheck, endpoint, controller);
          break;
        case 'tcp':
          result = await this.performTCPHealthCheck(healthCheck, endpoint, controller);
          break;
        case 'grpc':
          result = await this.performGRPCHealthCheck(healthCheck, endpoint, controller);
          break;
        default:
          throw new Error(`Unsupported health check type: ${healthCheck.checkType}`);
      }

      clearTimeout(timeoutId);
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async performHTTPHealthCheck(healthCheck, endpoint, controller) {
    const startTime = Date.now();

    const response = await fetch(endpoint.url, {
      method: healthCheck.method,
      headers: {
        'User-Agent': 'Cloudflare-Health-Check/1.0',
        ...healthCheck.headers
      },
      signal: controller.signal
    });

    const responseTime = Date.now() - startTime;
    const success = healthCheck.expectedStatus.includes(response.status);

    return {
      success,
      responseTime,
      statusCode: response.status
    };
  }

  async performTCPHealthCheck(healthCheck, endpoint, controller) {
    const startTime = Date.now();

    // TCP connection check (simplified for Workers environment)
    const socket = new WebSocket(
      endpoint.url.replace('http://', 'ws://').replace('https://', 'wss://')
    );

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TCP connection timeout')), healthCheck.timeout);
    });

    try {
      await Promise.race([
        new Promise((resolve) => {
          socket.onopen = resolve;
        }),
        timeoutPromise
      ]);

      const responseTime = Date.now() - startTime;
      socket.close();

      return {
        success: true,
        responseTime,
        statusCode: 200
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        statusCode: null,
        error: error.message
      };
    }
  }

  async performGRPCHealthCheck(healthCheck, endpoint, controller) {
    // gRPC health check implementation
    // This would use a gRPC client to call the standard health check service
    const startTime = Date.now();

    try {
      // Mock gRPC health check for Workers environment
      const response = await fetch(`${endpoint.url}/grpc.health.v1.Health/Check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          ...healthCheck.headers
        },
        body: JSON.stringify({ service: healthCheck.service || '' }),
        signal: controller.signal
      });

      const responseTime = Date.now() - startTime;
      const success = response.ok;

      return {
        success,
        responseTime,
        statusCode: response.status
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        statusCode: null,
        error: error.message
      };
    }
  }

  initializeMetrics(serviceName) {
    this.metrics.set(serviceName, {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      consecutiveFailures: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      responseTimeHistory: [],
      errorRateHistory: [],
      throughputHistory: []
    });
  }

  recordHealthMetrics(serviceName, result) {
    const metrics = this.metrics.get(serviceName);
    if (!metrics) return;

    metrics.totalChecks++;

    if (result.success) {
      metrics.successfulChecks++;
      metrics.consecutiveFailures = 0;
      metrics.lastSuccessTime = result.timestamp;
    } else {
      metrics.failedChecks++;
      metrics.consecutiveFailures++;
      metrics.lastFailureTime = result.timestamp;
    }

    // Update response time history (keep last 100 entries)
    if (result.responseTime) {
      metrics.responseTimeHistory.push({
        value: result.responseTime,
        timestamp: result.timestamp
      });
      if (metrics.responseTimeHistory.length > 100) {
        metrics.responseTimeHistory.shift();
      }
    }

    // Update error rate history (keep last 100 entries)
    const errorRate = metrics.failedChecks / metrics.totalChecks;
    metrics.errorRateHistory.push({
      value: errorRate,
      timestamp: result.timestamp
    });
    if (metrics.errorRateHistory.length > 100) {
      metrics.errorRateHistory.shift();
    }
  }

  updateCircuitBreaker(serviceName, success) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) return;

    if (success) {
      circuitBreaker.consecutiveFailures = 0;
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
      }
    } else {
      circuitBreaker.consecutiveFailures++;
      if (circuitBreaker.consecutiveFailures >= circuitBreaker.failureThreshold) {
        circuitBreaker.state = 'open';
        circuitBreaker.openTime = Date.now();
      }
    }

    // Check if circuit should move to half-open
    if (circuitBreaker.state === 'open' &&
        Date.now() - circuitBreaker.openTime > circuitBreaker.recoveryTimeout) {
      circuitBreaker.state = 'half-open';
      circuitBreaker.consecutiveFailures = 0;
    }
  }

  createCircuitBreaker(serviceName, config = {}) {
    const circuitBreaker = {
      serviceName,
      state: 'closed', // closed, open, half-open
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      consecutiveFailures: 0,
      openTime: null,
      halfOpenMaxCalls: config.halfOpenMaxCalls || 3,
      halfOpenCalls: 0
    };

    this.circuitBreakers.set(serviceName, circuitBreaker);
    return circuitBreaker;
  }

  isCircuitBreakerOpen(serviceName) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    return circuitBreaker && circuitBreaker.state === 'open';
  }

  async checkAlerts(serviceName) {
    const healthCheck = this.healthChecks.get(serviceName);
    const metrics = this.metrics.get(serviceName);

    if (!healthCheck?.alerting?.enabled || !metrics) return;

    const thresholds = healthCheck.alerting.thresholds;
    const alerts = [];

    // Error rate alert
    if (metrics.totalChecks > 10) {
      const errorRate = metrics.failedChecks / metrics.totalChecks;
      if (errorRate > thresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          severity: 'warning',
          message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold of ${(thresholds.errorRate * 100).toFixed(2)}%`,
          value: errorRate,
          threshold: thresholds.errorRate
        });
      }
    }

    // Response time alert
    if (metrics.responseTimeHistory.length > 0) {
      const avgResponseTime = metrics.responseTimeHistory
        .slice(-10) // Last 10 checks
        .reduce((sum, entry) => sum + entry.value, 0) / Math.min(10, metrics.responseTimeHistory.length);

      if (avgResponseTime > thresholds.responseTime) {
        alerts.push({
          type: 'response_time',
          severity: 'warning',
          message: `Average response time ${avgResponseTime.toFixed(0)}ms exceeds threshold of ${thresholds.responseTime}ms`,
          value: avgResponseTime,
          threshold: thresholds.responseTime
        });
      }
    }

    // Consecutive failures alert
    if (metrics.consecutiveFailures >= thresholds.consecutiveFailures) {
      alerts.push({
        type: 'consecutive_failures',
        severity: 'critical',
        message: `${metrics.consecutiveFailures} consecutive health check failures`,
        value: metrics.consecutiveFailures,
        threshold: thresholds.consecutiveFailures
      });
    }

    // Send alerts
    if (alerts.length > 0) {
      await this.sendAlerts(serviceName, alerts);
    }
  }

  async sendAlerts(serviceName, alerts) {
    const healthCheck = this.healthChecks.get(serviceName);
    const channels = healthCheck?.alerting?.channels || ['email'];

    const alertPayload = {
      serviceName,
      alerts,
      timestamp: new Date().toISOString(),
      severity: alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning'
    };

    for (const channel of channels) {
      try {
        await this.sendAlertToChannel(channel, alertPayload);
      } catch (error) {
        console.error(`Failed to send alert to ${channel}:`, error);
      }
    }
  }

  async sendAlertToChannel(channel, payload) {
    switch (channel) {
      case 'email':
        await this.sendEmailAlert(payload);
        break;
      case 'webhook':
        await this.sendWebhookAlert(payload);
        break;
      case 'slack':
        await this.sendSlackAlert(payload);
        break;
      default:
        console.warn(`Unknown alert channel: ${channel}`);
    }
  }

  async sendEmailAlert(payload) {
    // Send email using Cloudflare Workers email API or external service
    const emailContent = {
      to: this.env.ALERT_EMAIL,
      subject: `Health Alert: ${payload.serviceName}`,
      body: this.formatEmailAlert(payload)
    };

    // Implementation would depend on email service configuration
    console.log('Email alert:', emailContent);
  }

  async sendWebhookAlert(payload) {
    const webhookUrl = this.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async sendSlackAlert(payload) {
    const slackWebhookUrl = this.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) return;

    const slackMessage = {
      text: `Health Alert for ${payload.serviceName}`,
      attachments: payload.alerts.map(alert => ({
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        text: alert.message,
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Value', value: alert.value?.toString() || 'N/A', short: true },
          { title: 'Threshold', value: alert.threshold?.toString() || 'N/A', short: true }
        ]
      }))
    };

    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });
  }

  formatEmailAlert(payload) {
    let content = `Health alerts for ${payload.serviceName}:\n\n`;

    payload.alerts.forEach(alert => {
      content += `• ${alert.message}\n`;
      content += `  Type: ${alert.type}\n`;
      content += `  Severity: ${alert.severity}\n`;
      if (alert.value !== undefined) {
        content += `  Value: ${alert.value}\n`;
      }
      if (alert.threshold !== undefined) {
        content += `  Threshold: ${alert.threshold}\n`;
      }
      content += '\n';
    });

    content += `Timestamp: ${payload.timestamp}`;
    return content;
  }

  // Metrics aggregation and reporting
  getServiceMetrics(serviceName) {
    const metrics = this.metrics.get(serviceName);
    const healthCheck = this.healthChecks.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    if (!metrics) return null;

    const now = Date.now();
    const recentChecks = metrics.responseTimeHistory.filter(
      entry => now - new Date(entry.timestamp).getTime() < 300000 // Last 5 minutes
    );

    return {
      serviceName,
      totalChecks: metrics.totalChecks,
      successRate: metrics.totalChecks > 0 ? (metrics.successfulChecks / metrics.totalChecks) : 0,
      errorRate: metrics.totalChecks > 0 ? (metrics.failedChecks / metrics.totalChecks) : 0,
      consecutiveFailures: metrics.consecutiveFailures,
      lastSuccessTime: metrics.lastSuccessTime,
      lastFailureTime: metrics.lastFailureTime,
      averageResponseTime: recentChecks.length > 0
        ? recentChecks.reduce((sum, entry) => sum + entry.value, 0) / recentChecks.length
        : null,
      circuitBreaker: circuitBreaker ? {
        state: circuitBreaker.state,
        consecutiveFailures: circuitBreaker.consecutiveFailures
      } : null,
      healthCheckStatus: this.getOverallHealthStatus(metrics, healthCheck),
      timestamp: new Date().toISOString()
    };
  }

  getOverallHealthStatus(metrics, healthCheck) {
    if (metrics.consecutiveFailures >= healthCheck.failureThreshold) {
      return 'unhealthy';
    }

    if (metrics.totalChecks === 0) {
      return 'unknown';
    }

    const errorRate = metrics.failedChecks / metrics.totalChecks;
    if (errorRate > 0.1) { // 10% error rate threshold
      return 'degraded';
    }

    return 'healthy';
  }

  getAllServicesMetrics() {
    const allMetrics = {};

    for (const serviceName of this.healthChecks.keys()) {
      allMetrics[serviceName] = this.getServiceMetrics(serviceName);
    }

    return allMetrics;
  }

  // Health monitoring endpoint for Workers
  async handleHealthCheckRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.getAllServicesMetrics()
      });
    }

    if (path.startsWith('/health/')) {
      const serviceName = path.split('/')[2];
      const metrics = this.getServiceMetrics(serviceName);

      if (!metrics) {
        return Response.json({ error: 'Service not found' }, { status: 404 });
      }

      return Response.json(metrics);
    }

    return Response.json({ error: 'Endpoint not found' }, { status: 404 });
  }
}

// Example configuration and usage
const healthMonitor = new ContainerHealthMonitor({
  ALERT_EMAIL: 'alerts@example.com',
  ALERT_WEBHOOK_URL: 'https://hooks.slack.com/...',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/...'
});

// Configure health checks for services
healthMonitor.createHealthCheck('user-api', {
  path: '/health',
  interval: 30000,
  timeout: 5000,
  failureThreshold: 3,
  alerting: {
    enabled: true,
    channels: ['email', 'slack'],
    thresholds: {
      errorRate: 0.05,
      responseTime: 2000,
      consecutiveFailures: 3
    }
  }
});

healthMonitor.createCircuitBreaker('user-api', {
  failureThreshold: 5,
  recoveryTimeout: 60000
});

module.exports = {
  ContainerHealthMonitor,
  healthMonitor
};