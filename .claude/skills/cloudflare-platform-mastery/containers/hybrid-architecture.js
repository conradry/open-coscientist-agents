/**
 * Workers + Containers Hybrid Architecture
 *
 * Advanced deployment patterns combining Cloudflare Workers and Containers
 * for optimal performance, scalability, and cost-effectiveness.
 */

import { ContainerGatewayWorker } from './container-worker-gateway.js';
import { ContainerHealthMonitor } from './health-checks.js';

class HybridArchitectureManager {
  constructor(env = {}) {
    this.env = env;
    this.workerServices = new Map();
    this.containerServices = new Map();
    this.hybridServices = new Map();
    this.gateway = new ContainerGatewayWorker(env);
    this.healthMonitor = new ContainerHealthMonitor(env);
    this.trafficSplitter = new TrafficSplitter();
    this.serviceMesh = new ServiceMesh();
  }

  // Service type definitions for hybrid architecture
  getServiceTypes() {
    return {
      // Workers-only services (ideal for edge computing)
      WORKER_ONLY: {
        characteristics: ['low-latency', 'global', 'stateless', 'cpu-light'],
        useCases: ['api-gateway', 'auth', 'validation', 'rate-limiting', 'static-content'],
        pros: ['sub-ms latency', 'global distribution', 'pay-per-request', 'auto-scaling'],
        cons: ['limited compute', 'no persistent storage', 'memory constraints']
      },

      // Container-only services (ideal for heavy processing)
      CONTAINER_ONLY: {
        characteristics: ['compute-heavy', 'stateful', 'custom-runtime', 'persistent-storage'],
        useCases: ['machine-learning', 'data-processing', 'database-access', 'file-processing'],
        pros: ['full compute access', 'custom runtimes', 'persistent storage', 'larger memory'],
        cons: ['regional deployment', 'cold starts', 'fixed-cost scaling']
      },

      // Hybrid services (Workers + Containers)
      HYBRID: {
        characteristics: ['smart-routing', 'edge-compute', 'backend-processing', 'cost-optimized'],
        useCases: ['api-endpoints', 'web-applications', 'content-delivery', 'real-time-services'],
        pros: ['best-of-both-worlds', 'cost optimization', 'flexible scaling', 'smart routing'],
        cons: ['increased complexity', 'coordination overhead', 'debugging challenges']
      }
    };
  }

  // Create hybrid service configuration
  createHybridService(name, config) {
    const hybridConfig = {
      name,
      description: config.description,
      type: 'HYBRID',

      // Worker layer configuration
      worker: {
        enabled: config.worker?.enabled !== false,
        runtime: config.worker?.runtime || 'service-worker',
        functions: config.worker?.functions || [],
        middleware: config.worker?.middleware || [],
        edgeLogic: config.worker?.edgeLogic || 'routing',
        cacheStrategy: config.worker?.cacheStrategy || 'smart',
        routing: {
          primary: config.worker?.routing?.primary || 'container', // worker, container, intelligent
          fallback: config.worker?.routing?.fallback || 'container',
          conditions: config.worker?.routing?.conditions || []
        },
        edgeProcessing: {
          authentication: config.worker?.edgeProcessing?.authentication !== false,
          validation: config.worker?.edgeProcessing?.validation !== false,
          rateLimiting: config.worker?.edgeProcessing?.rateLimiting || false,
          compression: config.worker?.edgeProcessing?.compression || false,
          caching: config.worker?.edgeProcessing?.caching || 'auto'
        }
      },

      // Container layer configuration
      container: {
        enabled: config.container?.enabled !== false,
        image: config.container?.image,
        replicas: {
          min: config.container?.replicas?.min || 1,
          max: config.container?.replicas?.max || 10,
          desired: config.container?.replicas?.desired || 2
        },
        resources: {
          memory: config.container?.resources?.memory || '512Mi',
          cpu: config.container?.resources?.cpu || '1'
        },
        scaling: {
          strategy: config.container?.scaling?.strategy || 'concurrency',
          target: config.container?.scaling?.target || 10,
          cooldown: config.container?.scaling?.cooldown || 300
        },
        networking: {
          port: config.container?.networking?.port || 8080,
          healthCheck: config.container?.networking?.healthCheck || '/health',
          timeout: config.container?.networking?.timeout || 30000
        }
      },

      // Traffic routing configuration
      routing: {
        strategy: config.routing?.strategy || 'intelligent', // worker-first, container-first, intelligent, split
        splitPercentage: config.routing?.splitPercentage || { worker: 30, container: 70 },
        conditions: config.routing?.conditions || [
          {
            type: 'path',
            pattern: '/api/*',
            destination: 'container'
          },
          {
            type: 'method',
            methods: ['GET'],
            destination: 'worker'
          },
          {
            type: 'header',
            header: 'X-Priority',
            value: 'high',
            destination: 'worker'
          }
        ],
        loadBalancing: {
          algorithm: config.routing?.loadBalancing?.algorithm || 'round-robin',
          stickySessions: config.routing?.loadBalancing?.stickySessions || false,
          healthChecks: config.routing?.loadBalancing?.healthChecks !== false
        }
      },

      // Monitoring and observability
      monitoring: {
        enabled: config.monitoring?.enabled !== false,
        metrics: config.monitoring?.metrics || ['latency', 'throughput', 'error-rate'],
        logging: {
          level: config.monitoring?.logging?.level || 'info',
          destination: config.monitoring?.logging?.destination || 'cloudflare-logs',
          correlationId: config.monitoring?.logging?.correlationId !== false
        },
        tracing: {
          enabled: config.monitoring?.tracing?.enabled || false,
          sampling: config.monitoring?.tracing?.sampling || 0.1
        }
      },

      // Cost optimization
      optimization: {
        enabled: config.optimization?.enabled !== false,
        workerTimeout: config.optimization?.workerTimeout || 5000,
        containerScalingDelay: config.optimization?.containerScalingDelay || 10000,
        cacheTTL: config.optimization?.cacheTTL || 300,
        compressionLevel: config.optimization?.compressionLevel || 6
      }
    };

    this.hybridServices.set(name, hybridConfig);
    return hybridConfig;
  }

  // Intelligent routing logic
  async routeRequest(request, serviceName) {
    const service = this.hybridServices.get(serviceName);
    if (!service) {
      throw new Error(`Hybrid service not found: ${serviceName}`);
    }

    const routing = service.routing;
    const decision = await this.makeRoutingDecision(request, routing);

    // Add routing metadata for monitoring
    request.headers.set('X-Hybrid-Route', decision.destination);
    request.headers.set('X-Routing-Reason', decision.reason);

    switch (decision.destination) {
      case 'worker':
        return this.handleWorkerRequest(request, service);
      case 'container':
        return this.handleContainerRequest(request, service);
      case 'both':
        return this.handleHybridRequest(request, service);
      default:
        throw new Error(`Unknown routing destination: ${decision.destination}`);
    }
  }

  async makeRoutingDecision(request, routing) {
    const url = new URL(request.url);
    const method = request.method;
    const headers = Object.fromEntries(request.headers.entries());

    // Check routing conditions
    for (const condition of routing.conditions) {
      if (this.matchesCondition(request, condition)) {
        return {
          destination: condition.destination,
          reason: `condition-match:${condition.type}`,
          condition
        };
      }
    }

    // Apply routing strategy
    switch (routing.strategy) {
      case 'worker-first':
        return { destination: 'worker', reason: 'worker-first-strategy' };

      case 'container-first':
        return { destination: 'container', reason: 'container-first-strategy' };

      case 'split':
        const split = this.trafficSplitter.shouldRouteToWorker(
          routing.splitPercentage.worker
        );
        return {
          destination: split ? 'worker' : 'container',
          reason: 'traffic-split',
          percentage: split ? routing.splitPercentage.worker : routing.splitPercentage.container
        };

      case 'intelligent':
        return await this.makeIntelligentRoutingDecision(request, routing);

      default:
        return { destination: 'container', reason: 'default' };
    }
  }

  async makeIntelligentRoutingDecision(request, routing) {
    const characteristics = await this.analyzeRequestCharacteristics(request);

    // Complex routing logic based on request characteristics
    if (characteristics.isComplex && characteristics.payloadSize > 1024 * 1024) {
      return { destination: 'container', reason: 'large-payload' };
    }

    if (characteristics.isAuthentication && characteristics.isEdgeFriendly) {
      return { destination: 'worker', reason: 'auth-edge' };
    }

    if (characteristics.isReadOnly && characteristics.cacheable) {
      return { destination: 'worker', reason: 'cacheable-read' };
    }

    if (characteristics.requiresHeavyProcessing) {
      return { destination: 'container', reason: 'heavy-processing' };
    }

    // Check service health and load
    const containerHealth = await this.healthMonitor.getServiceMetrics('container');
    const workerLoad = await this.getWorkerLoadMetrics();

    if (containerHealth?.healthCheckStatus !== 'healthy' || workerLoad.isOverloaded) {
      return {
        destination: containerHealth?.healthCheckStatus === 'healthy' ? 'container' : 'worker',
        reason: 'health-based-routing'
      };
    }

    // Default to container for write operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      return { destination: 'container', reason: 'write-operation' };
    }

    // Default to worker for GET operations
    return { destination: 'worker', reason: 'read-operation' };
  }

  matchesCondition(request, condition) {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());

    switch (condition.type) {
      case 'path':
        return this.matchesPattern(url.pathname, condition.pattern);

      case 'method':
        return condition.methods.includes(request.method);

      case 'header':
        return headers[condition.header] === condition.value;

      case 'query':
        return url.searchParams.has(condition.param) &&
               (!condition.value || url.searchParams.get(condition.param) === condition.value);

      case 'user-agent':
        return this.matchesPattern(headers['user-agent'] || '', condition.pattern);

      default:
        return false;
    }
  }

  matchesPattern(value, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(value);
    }
    return value === pattern;
  }

  async analyzeRequestCharacteristics(request) {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    const method = request.method;

    // Determine if request can be processed at edge
    const isEdgeFriendly = await this.isEdgeFriendlyRequest(request);

    // Analyze payload size
    const contentLength = parseInt(headers['content-length'] || '0');
    const isLargePayload = contentLength > 1024 * 1024; // 1MB threshold

    // Determine complexity based on path and method
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const isComplex = pathSegments.length > 3 ||
                     url.searchParams.size > 5 ||
                     ['POST', 'PUT', 'PATCH'].includes(method);

    // Check if it's a read-only operation
    const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);

    // Check cacheability
    const cacheableMethods = ['GET', 'HEAD'];
    const isCacheable = cacheableMethods.includes(method) &&
                       !headers['authorization'] &&
                       !headers['cookie'];

    // Check for authentication
    const isAuthentication = url.pathname.includes('/auth') ||
                            url.pathname.includes('/login') ||
                            url.pathname.includes('/token');

    // Estimate processing complexity
    const requiresHeavyProcessing =
      isLargePayload ||
      isComplex ||
      url.pathname.includes('/compute') ||
      url.pathname.includes('/process') ||
      url.pathname.includes('/analyze') ||
      url.pathname.includes('/ml');

    return {
      isEdgeFriendly,
      payloadSize: contentLength,
      isLargePayload,
      isComplex,
      isReadOnly,
      isCacheable,
      isAuthentication,
      requiresHeavyProcessing,
      method,
      path: url.pathname,
      hasAuth: !!(headers.authorization || headers.cookie)
    };
  }

  async handleWorkerRequest(request, service) {
    const workerFunctions = service.worker.functions;

    // Route to appropriate worker function
    const url = new URL(request.url);
    const functionName = this.selectWorkerFunction(url.pathname, workerFunctions);

    if (!functionName) {
      // Default worker handler
      return this.defaultWorkerHandler(request, service);
    }

    // Call specific worker function
    return await this.callWorkerFunction(functionName, request, service);
  }

  async handleContainerRequest(request, service) {
    // Forward to container through gateway
    const containerConfig = service.container;
    const containerUrl = `${this.env.CONTAINER_BASE_URL || 'https://container.example.com'}/${service.name}`;

    return await this.gateway.forwardRequest(request, {
      name: service.name,
      url: containerUrl,
      timeout: containerConfig.networking.timeout,
      healthCheckPath: containerConfig.networking.healthCheck
    });
  }

  async handleHybridRequest(request, service) {
    // Parallel processing: worker for validation, container for processing
    const workerResult = await this.handleWorkerRequest(request, service);
    const containerResult = await this.handleContainerRequest(request, service);

    // Merge results based on response types
    return this.mergeWorkerAndContainerResults(workerResult, containerResult);
  }

  selectWorkerFunction(path, functions) {
    for (const func of functions) {
      if (this.matchesPattern(path, func.path)) {
        return func.name;
      }
    }
    return null;
  }

  async callWorkerFunction(functionName, request, service) {
    // Dynamic function call based on worker configuration
    // This would integrate with the Workers runtime to call specific functions
    const func = service.worker.functions.find(f => f.name === functionName);

    if (!func) {
      throw new Error(`Worker function not found: ${functionName}`);
    }

    // Execute worker function with request context
    return await this.executeWorkerFunction(func, request, service);
  }

  async executeWorkerFunction(func, request, service) {
    // Execute the actual worker function
    // This would be the actual Workers runtime execution

    // Add worker-specific processing
    const enhancedRequest = await this.applyWorkerMiddleware(request, service.worker.middleware);

    // Call the function
    const result = await this.invokeWorkerFunction(func.handler, enhancedRequest);

    // Apply response middleware
    return await this.applyWorkerResponseMiddleware(result, service);
  }

  async applyWorkerMiddleware(request, middleware) {
    let enhancedRequest = request;

    for (const middlewareName of middleware) {
      enhancedRequest = await this.applyMiddleware(enhancedRequest, middlewareName);
    }

    return enhancedRequest;
  }

  async applyMiddleware(request, middlewareName) {
    switch (middlewareName) {
      case 'authentication':
        return await this.authenticateRequest(request);
      case 'validation':
        return await this.validateRequest(request);
      case 'rateLimiting':
        return await this.applyRateLimit(request);
      case 'compression':
        return await this.compressResponse(request);
      default:
        return request;
    }
  }

  mergeWorkerAndContainerResults(workerResult, containerResult) {
    // Intelligent merging of worker and container results
    if (workerResult.status === 200 && containerResult.status === 200) {
      // Both successful - merge data
      const workerData = workerResult.json ? workerResult.json() : {};
      const containerData = containerResult.json ? containerResult.json() : {};

      return new Response(JSON.stringify({
        worker: workerData,
        container: containerData,
        merged: true
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Hybrid-Merged': 'true'
        }
      });
    }

    // Return the successful result or prefer container on conflicts
    return containerResult.status === 200 ? containerResult : workerResult;
  }

  // Deployment orchestration
  async deployHybridService(serviceName, config) {
    const service = this.createHybridService(serviceName, config);

    // Deploy worker layer
    if (service.worker.enabled) {
      await this.deployWorkerLayer(serviceName, service.worker);
    }

    // Deploy container layer
    if (service.container.enabled) {
      await this.deployContainerLayer(serviceName, service.container);
    }

    // Configure routing
    await this.configureRouting(serviceName, service.routing);

    // Setup monitoring
    if (service.monitoring.enabled) {
      await this.setupMonitoring(serviceName, service.monitoring);
    }

    // Setup health checks
    await this.setupHealthChecks(serviceName, service);

    return { success: true, service };
  }

  async deployWorkerLayer(serviceName, workerConfig) {
    // Deploy Workers runtime and functions
    const deploymentConfig = {
      name: `${serviceName}-worker`,
      type: 'worker',
      runtime: workerConfig.runtime,
      functions: workerConfig.functions,
      middleware: workerConfig.middleware,
      edgeLogic: workerConfig.edgeLogic
    };

    // Worker deployment logic here
    console.log(`Deploying worker layer for ${serviceName}:`, deploymentConfig);
  }

  async deployContainerLayer(serviceName, containerConfig) {
    // Deploy containers through Cloudflare Container Registry
    const deploymentConfig = {
      name: `${serviceName}-container`,
      image: containerConfig.image,
      replicas: containerConfig.replicas,
      resources: containerConfig.resources,
      scaling: containerConfig.scaling,
      networking: containerConfig.networking
    };

    // Container deployment logic here
    console.log(`Deploying container layer for ${serviceName}:`, deploymentConfig);
  }

  async configureRouting(serviceName, routingConfig) {
    // Configure intelligent routing between workers and containers
    this.trafficSplitter.configureService(serviceName, routingConfig);
  }

  async setupMonitoring(serviceName, monitoringConfig) {
    // Setup metrics collection and alerting
    this.healthMonitor.createHealthCheck(`${serviceName}-container`, {
      path: monitoringConfig.healthCheckPath || '/health',
      interval: monitoringConfig.interval || 30000,
      alerting: monitoringConfig.alerting
    });
  }

  async setupHealthChecks(serviceName, service) {
    if (service.container.enabled) {
      this.healthMonitor.createHealthCheck(`${serviceName}-container`, service.container.networking);
    }

    if (service.worker.enabled) {
      this.healthMonitor.createHealthCheck(`${serviceName}-worker`, {
        checkType: 'http',
        path: '/worker-health',
        interval: 30000,
        timeout: 1000
      });
    }
  }
}

// Traffic splitter for intelligent load balancing
class TrafficSplitter {
  constructor() {
    this.configurations = new Map();
    this.counters = new Map();
  }

  configureService(serviceName, routingConfig) {
    this.configurations.set(serviceName, routingConfig);
    this.counters.set(serviceName, 0);
  }

  shouldRouteToWorker(workerPercentage) {
    const random = Math.random() * 100;
    return random <= workerPercentage;
  }

  roundRobin(serviceName) {
    const counter = this.counters.get(serviceName) || 0;
    this.counters.set(serviceName, counter + 1);
    return counter % 2 === 0;
  }
}

// Service mesh for inter-service communication
class ServiceMesh {
  constructor() {
    this.services = new Map();
    this.connections = new Map();
  }

  registerService(name, config) {
    this.services.set(name, {
      name,
      endpoints: config.endpoints,
      protocol: config.protocol || 'http',
      loadBalancing: config.loadBalancing || 'round-robin',
      circuitBreaker: config.circuitBreaker || { enabled: false },
      retries: config.retries || 3,
      timeout: config.timeout || 30000
    });
  }

  async callService(serviceName, request) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // Apply circuit breaker logic
    if (service.circuitBreaker.enabled && this.isCircuitOpen(serviceName)) {
      throw new Error(`Circuit breaker open for service: ${serviceName}`);
    }

    // Select endpoint based on load balancing strategy
    const endpoint = this.selectEndpoint(service);

    try {
      const response = await this.makeRequest(endpoint, request, service);
      this.recordSuccess(serviceName);
      return response;
    } catch (error) {
      this.recordFailure(serviceName);
      throw error;
    }
  }

  selectEndpoint(service) {
    switch (service.loadBalancing) {
      case 'round-robin':
        return service.endpoints[Math.floor(Math.random() * service.endpoints.length)];
      case 'random':
        return service.endpoints[Math.floor(Math.random() * service.endpoints.length)];
      default:
        return service.endpoints[0];
    }
  }

  async makeRequest(endpoint, request, service) {
    // Make HTTP request with timeout and retries
    const controller = new AbortController();
    setTimeout(() => controller.abort(), service.timeout);

    return fetch(endpoint, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal
    });
  }

  isCircuitOpen(serviceName) {
    // Circuit breaker logic
    return false; // Simplified
  }

  recordSuccess(serviceName) {
    // Record success for circuit breaker
  }

  recordFailure(serviceName) {
    // Record failure for circuit breaker
  }
}

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const manager = new HybridArchitectureManager(env);

    // Parse service name from request
    const url = new URL(request.url);
    const serviceName = url.pathname.split('/')[1] || 'default';

    try {
      return await manager.routeRequest(request, serviceName);
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

module.exports = {
  HybridArchitectureManager,
  TrafficSplitter,
  ServiceMesh
};