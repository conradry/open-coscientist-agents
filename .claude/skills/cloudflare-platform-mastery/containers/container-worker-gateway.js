/**
 * Cloudflare Workers as API Gateway for Containers
 *
 * This implementation provides intelligent routing, load balancing,
 * and security for Cloudflare Container services through Workers.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

class ContainerGatewayWorker {
  constructor(env = {}) {
    this.env = env;
    this.app = new Hono();
    this.containers = new Map();
    this.loadBalancers = new Map();
    this.healthChecks = new Map();

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS for cross-origin requests
    this.app.use('*', cors({
      origin: ['https://*.workers.dev', 'https://*.pages.dev'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));

    // Request logging
    this.app.use('*', logger());

    // Rate limiting
    this.app.use('*', async (c, next) => {
      const clientIP = c.req.header('CF-Connecting-IP') || c.req.ip;
      const rateLimitKey = `rate_limit_${clientIP}`;

      const { success } = await this.env.RATE_LIMITER?.limit({
        key: rateLimitKey,
        limit: 1000, // 1000 requests per hour
        window: 3600
      }) || { success: true };

      if (!success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      await next();
    });

    // Request tracing
    this.app.use('*', async (c, next) => {
      const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
      c.set('requestId', requestId);

      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      console.log(`Request ${requestId}: ${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (c) => {
      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.getServiceStatus()
      });
    });

    // Service discovery
    this.app.get('/services', (c) => {
      return c.json({
        services: Array.from(this.containers.entries()).map(([name, config]) => ({
          name,
          url: config.url,
          status: config.status,
          version: config.version,
          endpoints: config.endpoints
        }))
      });
    });

    // Dynamic routing based on service configuration
    this.app.all('/api/:service/*', async (c) => {
      const serviceName = c.req.param('service');
      const service = this.containers.get(serviceName);

      if (!service) {
        return c.json({ error: `Service '${serviceName}' not found` }, 404);
      }

      if (service.status !== 'healthy') {
        return c.json({ error: `Service '${serviceName}' is unavailable` }, 503);
      }

      // Apply service-specific middleware
      for (const middleware of service.middleware || []) {
        const result = await middleware(c);
        if (result) return result;
      }

      // Forward request to container
      return this.forwardRequest(c, service);
    });

    // Load balanced routing
    this.app.all('/api/load-balanced/:service/*', async (c) => {
      const serviceName = c.req.param('service');
      const instances = this.loadBalancers.get(serviceName);

      if (!instances || instances.length === 0) {
        return c.json({ error: `No instances found for service '${serviceName}'` }, 404);
      }

      const selectedInstance = this.selectInstance(instances);
      if (!selectedInstance) {
        return c.json({ error: `No healthy instances for service '${serviceName}'` }, 503);
      }

      return this.forwardRequest(c, selectedInstance);
    });

    // WebSocket proxy support
    this.app.get('/ws/:service', async (c) => {
      const serviceName = c.req.param('service');
      const service = this.containers.get(serviceName);

      if (!service || !service.websocket) {
        return c.json({ error: 'WebSocket service not found' }, 404);
      }

      return this.handleWebSocketUpgrade(c, service);
    });

    // Container management endpoints
    this.app.post('/admin/containers', async (c) => {
      const config = await c.req.json();
      return this.registerContainer(config);
    });

    this.app.delete('/admin/containers/:service', async (c) => {
      const serviceName = c.req.param('service');
      return this.unregisterContainer(serviceName);
    });
  }

  async registerContainer(config) {
    const {
      name,
      url,
      version = '1.0.0',
      loadBalanced = false,
      healthCheckPath = '/health',
      healthCheckInterval = 30000,
      timeout = 30000,
      retries = 3,
      middleware = [],
      websocket = false,
      endpoints = []
    } = config;

    const container = {
      name,
      url,
      version,
      status: 'unknown',
      lastHealthCheck: null,
      healthCheckPath,
      healthCheckInterval,
      timeout,
      retries,
      middleware,
      websocket,
      endpoints
    };

    this.containers.set(name, container);

    // Start health checking
    this.startHealthCheck(name, container);

    // Setup load balancing if enabled
    if (loadBalanced) {
      const instances = this.loadBalancers.get(name) || [];
      instances.push(container);
      this.loadBalancers.set(name, instances);
    }

    return { success: true, container };
  }

  async unregisterContainer(serviceName) {
    const container = this.containers.get(serviceName);
    if (!container) {
      return { success: false, error: 'Container not found' };
    }

    // Stop health checking
    this.stopHealthCheck(serviceName);

    // Remove from containers and load balancers
    this.containers.delete(serviceName);

    const instances = this.loadBalancers.get(serviceName) || [];
    const index = instances.findIndex(inst => inst.name === serviceName);
    if (index !== -1) {
      instances.splice(index, 1);
      if (instances.length === 0) {
        this.loadBalancers.delete(serviceName);
      }
    }

    return { success: true };
  }

  async forwardRequest(c, target) {
    const url = new URL(c.req.url);
    const targetUrl = new URL(target.url + url.pathname + url.search);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: c.req.method,
        headers: this.filterHeaders(c.req.header(), target),
        body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
          ? await c.req.text()
          : undefined,
        cf: {
          timeout: target.timeout || 30000
        }
      });

      // Copy response headers
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        if (!this.isInternalHeader(key)) {
          responseHeaders.set(key, value);
        }
      });

      // Add gateway headers
      responseHeaders.set('X-Gateway-Service', target.name);
      responseHeaders.set('X-Gateway-Version', target.version);
      responseHeaders.set('X-Request-ID', c.get('requestId'));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      console.error(`Forward request failed: ${error.message}`);
      return c.json({
        error: 'Service unavailable',
        service: target.name,
        requestId: c.get('requestId')
      }, 503);
    }
  }

  async handleWebSocketUpgrade(c, service) {
    // WebSocket upgrade logic for real-time communication
    const url = new URL(c.req.url);
    const wsUrl = new URL(service.url + url.pathname + url.search);
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

    try {
      const { readable, writable } = new WebSocketPair();
      const client = readable.getReader();
      const server = writable.getWriter();

      // Upgrade connection to WebSocket
      const upgradeResponse = await fetch(wsUrl.toString(), {
        method: 'GET',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': c.req.header('Sec-WebSocket-Key'),
          'Sec-WebSocket-Version': '13'
        }
      });

      if (!upgradeResponse.ok) {
        return c.json({ error: 'WebSocket upgrade failed' }, 500);
      }

      // Bidirectional proxy between client and container
      this.proxyWebSocket(client, server);

      return new Response(null, {
        status: 101,
        webSocket: readable
      });

    } catch (error) {
      console.error(`WebSocket upgrade failed: ${error.message}`);
      return c.json({ error: 'WebSocket connection failed' }, 500);
    }
  }

  async proxyWebSocket(client, server) {
    // Proxy data between client WebSocket and container WebSocket
    const pump = async (reader, writer) => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (error) {
        console.error('WebSocket proxy error:', error);
      }
    };

    pump(client, server);
    pump(server, client);
  }

  startHealthCheck(serviceName, container) {
    const checkHealth = async () => {
      try {
        const healthUrl = new URL(container.healthCheckPath, container.url).toString();
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        container.status = response.ok ? 'healthy' : 'unhealthy';
        container.lastHealthCheck = new Date().toISOString();

      } catch (error) {
        container.status = 'unhealthy';
        container.lastHealthCheck = new Date().toISOString();
        console.error(`Health check failed for ${serviceName}: ${error.message}`);
      }
    };

    // Initial health check
    checkHealth();

    // Schedule periodic health checks
    const intervalId = setInterval(checkHealth, container.healthCheckInterval);
    this.healthChecks.set(serviceName, intervalId);
  }

  stopHealthCheck(serviceName) {
    const intervalId = this.healthChecks.get(serviceName);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthChecks.delete(serviceName);
    }
  }

  selectInstance(instances) {
    // Round-robin load balancing with health filtering
    const healthyInstances = instances.filter(inst => inst.status === 'healthy');
    if (healthyInstances.length === 0) return null;

    const currentIndex = this.getCurrentIndex(instances);
    const selectedInstance = healthyInstances[currentIndex % healthyInstances.length];
    this.setCurrentIndex(instances, currentIndex + 1);

    return selectedInstance;
  }

  getCurrentIndex(instances) {
    return instances._roundRobinIndex || 0;
  }

  setCurrentIndex(instances, index) {
    instances._roundRobinIndex = index;
  }

  filterHeaders(headers, target) {
    const filtered = new Headers();

    // Copy allowed headers
    const allowedHeaders = [
      'content-type', 'authorization', 'accept', 'user-agent',
      'x-request-id', 'x-forwarded-for', 'x-forwarded-proto'
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase()) || key.startsWith('x-')) {
        filtered.set(key, value);
      }
    }

    return filtered;
  }

  isInternalHeader(headerName) {
    const internalHeaders = ['cf-ray', 'cf-visitor', 'cf-connecting-ip', 'expect-ct'];
    return internalHeaders.includes(headerName.toLowerCase());
  }

  getServiceStatus() {
    const services = {};
    for (const [name, container] of this.containers.entries()) {
      services[name] = {
        status: container.status,
        version: container.version,
        lastHealthCheck: container.lastHealthCheck
      };
    }
    return services;
  }

  // Configuration helpers
  addService(name, config) {
    return this.registerContainer({ name, ...config });
  }

  removeService(name) {
    return this.unregisterContainer(name);
  }

  addLoadBalancedInstance(serviceName, instanceConfig) {
    const instances = this.loadBalancers.get(serviceName) || [];
    instances.push({
      name: `${serviceName}-${instances.length}`,
      ...instanceConfig
    });
    this.loadBalancers.set(serviceName, instances);
  }

  // Event handlers
  onServiceHealthChange(callback) {
    this.healthChangeCallback = callback;
  }
}

// Example usage and deployment configuration
const gatewayConfig = {
  // Service definitions
  services: [
    {
      name: 'user-api',
      url: 'https://user-api.workers.dev',
      healthCheckPath: '/health',
      loadBalanced: true,
      middleware: ['auth', 'rateLimit'],
      endpoints: ['/users', '/auth', '/profile']
    },
    {
      name: 'payment-service',
      url: 'https://payment-container.workers.dev',
      healthCheckPath: '/health',
      timeout: 60000, // Longer timeout for payment processing
      retries: 5,
      middleware: ['auth', 'validation', 'encryption']
    },
    {
      name: 'real-time-chat',
      url: 'wss://chat-container.workers.dev',
      websocket: true,
      healthCheckPath: '/health'
    }
  ],

  // Load balancer configurations
  loadBalancers: [
    {
      service: 'user-api',
      strategy: 'round-robin',
      healthCheck: {
        interval: 30000,
        timeout: 5000,
        retries: 3
      }
    }
  ],

  // Middleware configurations
  middleware: {
    auth: async (c) => {
      const token = c.req.header('Authorization');
      if (!token || !await validateToken(token)) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    },
    rateLimit: async (c) => {
      // Rate limiting logic
    },
    validation: async (c) => {
      // Request validation logic
    }
  }
};

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const gateway = new ContainerGatewayWorker(env);

    // Initialize services from configuration
    for (const service of gatewayConfig.services) {
      await gateway.registerContainer(service);
    }

    return gateway.app.fetch(request, env, ctx);
  }
};

module.exports = { ContainerGatewayWorker, gatewayConfig };