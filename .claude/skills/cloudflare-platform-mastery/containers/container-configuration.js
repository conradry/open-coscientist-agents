/**
 * Cloudflare Container Deployment Configuration
 *
 * Comprehensive configuration system for deploying and managing
 * containers on Cloudflare Container Registry.
 */

class ContainerDeploymentConfig {
  constructor(options = {}) {
    this.options = {
      registryUrl: 'https://registry.cloudflare.com',
      accountId: options.accountId,
      namespace: options.namespace || 'default',
      environment: options.environment || 'production',
      region: options.region || 'global',
      ...options
    };

    this.containers = new Map();
    this.deploymentConfigs = new Map();
    this.environmentVariables = new Map();
  }

  // Container configuration templates
  getContainerTemplates() {
    return {
      'node-api': {
        runtime: 'node',
        version: '18-alpine',
        port: 8080,
        memory: '512Mi',
        cpu: '1',
        minScale: 1,
        maxScale: 10,
        timeout: 30000,
        environment: {
          NODE_ENV: 'production',
          PORT: '8080'
        },
        build: {
          context: '.',
          dockerfile: 'Dockerfile',
          target: 'production'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000,
          retries: 3,
          startPeriod: 10000
        }
      },
      'python-api': {
        runtime: 'python',
        version: '3.11-slim',
        port: 8080,
        memory: '1Gi',
        cpu: '1',
        minScale: 1,
        maxScale: 5,
        timeout: 30000,
        environment: {
          PYTHONPATH: '/app',
          GUNICORN_WORKERS: '1'
        },
        build: {
          context: '.',
          dockerfile: 'Dockerfile'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000,
          retries: 3
        }
      },
      'static-site': {
        runtime: 'static',
        port: 8080,
        memory: '128Mi',
        cpu: '0.25',
        minScale: 2,
        maxScale: 10,
        timeout: 10000,
        environment: {},
        build: {
          context: '.',
          dockerfile: 'Dockerfile'
        },
        healthCheck: {
          path: '/',
          interval: 60000,
          timeout: 3000,
          retries: 2
        }
      },
      'worker-service': {
        runtime: 'worker',
        port: 8080,
        memory: '256Mi',
        cpu: '0.5',
        minScale: 0, // Scale to zero when not used
        maxScale: 100,
        timeout: 5000,
        environment: {
          WORKER_TIMEOUT: '5000'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 3000,
          retries: 1
        }
      }
    };
  }

  // Create container configuration
  createContainerConfig(name, template, overrides = {}) {
    const templates = this.getContainerTemplates();
    const baseConfig = templates[template];

    if (!baseConfig) {
      throw new Error(`Unknown template: ${template}`);
    }

    const config = this.mergeConfig(baseConfig, overrides);
    config.name = name;
    config.image = `${this.options.accountId}.registry.cloudflare.com/${this.options.namespace}/${name}:${config.version || 'latest'}`;

    this.containers.set(name, config);
    return config;
  }

  // Create deployment configuration
  createDeploymentConfig(name, containerConfig, deploymentOverrides = {}) {
    const deploymentConfig = {
      name,
      image: containerConfig.image,
      replicas: {
        min: containerConfig.minScale || 1,
        max: containerConfig.maxScale || 3,
        desired: containerConfig.desiredReplicas || 1
      },
      resources: {
        memory: containerConfig.memory || '512Mi',
        cpu: containerConfig.cpu || '1'
      },
      port: containerConfig.port || 8080,
      timeout: containerConfig.timeout || 30000,
      environment: containerConfig.environment || {},
      healthCheck: containerConfig.healthCheck,
      networking: {
        public: deploymentOverrides.public !== false,
        customDomain: deploymentOverrides.customDomain,
        tls: deploymentOverrides.tls !== false
      },
      scaling: {
        enabled: true,
        strategy: deploymentOverrides.scalingStrategy || 'concurrency',
        target: deploymentOverrides.scalingTarget || 10,
        minReplicas: containerConfig.minScale || 1,
        maxReplicas: containerConfig.maxScale || 10
      },
      logging: {
        enabled: true,
        level: deploymentOverrides.logLevel || 'info',
        destination: deploymentOverrides.logDestination || 'cloudflare-logs'
      },
      ...deploymentOverrides
    };

    this.deploymentConfigs.set(name, deploymentConfig);
    return deploymentConfig;
  }

  // Environment-specific configurations
  getEnvironmentConfig(environment) {
    const configs = {
      development: {
        minScale: 1,
        maxScale: 2,
        memory: '256Mi',
        cpu: '0.5',
        timeout: 30000,
        logLevel: 'debug',
        public: false
      },
      staging: {
        minScale: 1,
        maxScale: 5,
        memory: '512Mi',
        cpu: '1',
        timeout: 30000,
        logLevel: 'info',
        public: false
      },
      production: {
        minScale: 2,
        maxScale: 20,
        memory: '1Gi',
        cpu: '2',
        timeout: 60000,
        logLevel: 'warn',
        public: true,
        tls: true
      }
    };

    return configs[environment] || configs.production;
  }

  // Advanced configuration methods
  configureLoadBalancer(serviceName, config) {
    const loadBalancerConfig = {
      serviceName,
      strategy: config.strategy || 'round-robin', // round-robin, least-connections, random
      sessionAffinity: config.sessionAffinity || false,
      stickySessions: config.stickySessions || false,
      healthCheck: {
        path: config.healthCheckPath || '/health',
        interval: config.healthCheckInterval || 30000,
        timeout: config.healthCheckTimeout || 5000,
        retries: config.healthCheckRetries || 3
      },
      circuitBreaker: {
        enabled: config.circuitBreaker !== false,
        threshold: config.circuitBreakerThreshold || 5,
        timeout: config.circuitBreakerTimeout || 60000
      },
      timeouts: {
        connect: config.connectTimeout || 5000,
        read: config.readTimeout || 30000,
        write: config.writeTimeout || 30000
      }
    };

    return loadBalancerConfig;
  }

  configureCanaryDeployment(serviceName, config) {
    return {
      serviceName,
      strategy: 'canary',
      steps: config.steps || [
        { trafficPercentage: 10, duration: 300000 },  // 10% for 5 minutes
        { trafficPercentage: 50, duration: 600000 },  // 50% for 10 minutes
        { trafficPercentage: 100, duration: 0 }       // 100% immediately
      ],
      rollbackTriggers: {
        errorRate: config.errorRateThreshold || 0.05,  // 5% error rate
        responseTime: config.responseTimeThreshold || 2000,  // 2 seconds
        healthCheck: config.healthCheckFailures || 3
      },
      monitoring: {
        enabled: true,
        metrics: ['error_rate', 'response_time', 'throughput'],
        alerting: {
          webhook: config.alertWebhook,
          email: config.alertEmail
        }
      }
    };
  }

  configureBlueGreenDeployment(serviceName, config) {
    return {
      serviceName,
      strategy: 'blue-green',
      switchMethod: config.switchMethod || 'instant', // instant, gradual, traffic-based
      trafficRouting: {
        method: config.routingMethod || 'header', // header, cookie, percentage
        header: config.trafficHeader || 'X-Deployment-Version',
        cookie: config.trafficCookie || 'deployment-version'
      },
      validation: {
        healthCheck: config.healthCheckPath || '/health',
        smokeTests: config.smokeTests || [],
        performanceTests: config.performanceTests || []
      },
      rollback: {
        automatic: config.automaticRollback !== false,
        conditions: {
          errorRate: config.errorRateThreshold || 0.05,
          responseTime: config.responseTimeThreshold || 2000,
          healthCheck: config.healthCheckThreshold || 3
        }
      }
    };
  }

  // Secret and configuration management
  addSecret(name, value, environment = 'production') {
    const secrets = this.environmentVariables.get(environment) || new Map();
    secrets.set(name, value);
    this.environmentVariables.set(environment, secrets);
  }

  addConfigMap(name, data, environment = 'production') {
    const configMaps = this.environmentVariables.get(`${environment}-configmaps`) || new Map();
    configMaps.set(name, data);
    this.environmentVariables.set(`${environment}-configmaps`, configMaps);
  }

  // Generate deployment manifests
  generateDeploymentManifest(serviceName, environment = 'production') {
    const container = this.containers.get(serviceName);
    const deployment = this.deploymentConfigs.get(serviceName);
    const envConfig = this.getEnvironmentConfig(environment);

    if (!container || !deployment) {
      throw new Error(`Container or deployment configuration not found for ${serviceName}`);
    }

    const manifest = {
      apiVersion: 'cloudflare.com/v1',
      kind: 'ContainerDeployment',
      metadata: {
        name: serviceName,
        namespace: this.options.namespace,
        environment,
        labels: {
          app: serviceName,
          version: container.version || 'latest',
          managedBy: 'cloudflare-container-gateway'
        },
        annotations: {
          'cloudflare.com/created-by': 'container-deployment-config',
          'cloudflare.com/created-at': new Date().toISOString()
        }
      },
      spec: {
        replicas: {
          min: Math.max(envConfig.minScale, deployment.replicas.min),
          max: Math.max(envConfig.maxScale, deployment.replicas.max),
          desired: deployment.replicas.desired
        },
        image: deployment.image,
        port: deployment.port,
        resources: {
          memory: envConfig.memory || deployment.resources.memory,
          cpu: envConfig.cpu || deployment.resources.cpu
        },
        timeout: envConfig.timeout || deployment.timeout,
        environment: {
          ...container.environment,
          ...deployment.environment,
          ...this.getEnvironmentVariables(environment)
        },
        healthCheck: deployment.healthCheck,
        networking: {
          ...deployment.networking,
          public: envConfig.public
        },
        scaling: {
          ...deployment.scaling,
          minReplicas: envConfig.minScale,
          maxReplicas: envConfig.maxScale
        },
        logging: {
          ...deployment.logging,
          level: envConfig.logLevel
        }
      }
    };

    return manifest;
  }

  generateServiceManifest(serviceName) {
    const deployment = this.deploymentConfigs.get(serviceName);

    return {
      apiVersion: 'cloudflare.com/v1',
      kind: 'ContainerService',
      metadata: {
        name: serviceName,
        namespace: this.options.namespace,
        labels: {
          app: serviceName,
          type: 'service'
        }
      },
      spec: {
        selector: {
          app: serviceName
        },
        ports: [{
          port: deployment.port,
          targetPort: deployment.port,
          protocol: 'TCP'
        }],
        type: deployment.networking.customDomain ? 'custom-domain' : 'cluster-ip',
        loadBalancer: deployment.loadBalancer || this.configureLoadBalancer(serviceName, {}),
        healthCheck: deployment.healthCheck
      }
    };
  }

  getEnvironmentVariables(environment) {
    const secrets = this.environmentVariables.get(environment) || new Map();
    const configMaps = this.environmentVariables.get(`${environment}-configmaps`) || new Map();

    const envVars = {};

    // Add secrets
    for (const [key, value] of secrets.entries()) {
      envVars[key] = {
        valueFrom: {
          secretKeyRef: {
            name: key,
            key: 'value'
          }
        }
      };
    }

    // Add config maps
    for (const [key, value] of configMaps.entries()) {
      envVars[key] = {
        valueFrom: {
          configMapKeyRef: {
            name: key,
            key: 'value'
          }
        }
      };
    }

    return envVars;
  }

  // Utility methods
  mergeConfig(base, overrides) {
    return {
      ...base,
      ...overrides,
      environment: { ...base.environment, ...overrides.environment },
      healthCheck: { ...base.healthCheck, ...overrides.healthCheck },
      build: { ...base.build, ...overrides.build }
    };
  }

  validateConfig(config) {
    const required = ['name', 'image', 'port'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (config.port < 1 || config.port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }

    if (config.replicas && config.replicas.min > config.replicas.max) {
      throw new Error('Minimum replicas cannot be greater than maximum replicas');
    }

    return true;
  }

  // Export configurations
  exportConfigurations(format = 'yaml') {
    const configs = {
      containers: Object.fromEntries(this.containers),
      deployments: Object.fromEntries(this.deploymentConfigs),
      environment: this.options.environment,
      namespace: this.options.namespace
    };

    if (format === 'json') {
      return JSON.stringify(configs, null, 2);
    } else if (format === 'yaml') {
      return this.convertToYAML(configs);
    }

    return configs;
  }

  convertToYAML(obj) {
    // Simple YAML conversion (in production, use a proper YAML library)
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/,/g, '')
      .replace(/\{/g, '')
      .replace(/\}/g, '');
  }

  // Template generation helpers
  generateDockerComposeConfig() {
    const services = {};

    for (const [name, container] of this.containers.entries()) {
      services[name] = {
        image: container.image,
        ports: [`${container.port}:${container.port}`],
        environment: container.environment,
        deploy: {
          replicas: container.desiredReplicas || 1,
          resources: {
            limits: {
              memory: container.memory,
              cpus: container.cpu
            }
          }
        },
        healthcheck: container.healthCheck ? {
          test: [`CMD-SHELL`, `curl -f http://localhost:${container.port}${container.healthCheck.path} || exit 1`],
          interval: `${container.healthCheck.interval}ms`,
          timeout: `${container.healthCheck.timeout}ms`,
          retries: container.healthCheck.retries,
          start_period: `${container.healthCheck.startPeriod || 0}ms`
        } : undefined
      };
    }

    return {
      version: '3.8',
      services
    };
  }
}

// Example usage
const deploymentConfig = new ContainerDeploymentConfig({
  accountId: 'your-account-id',
  namespace: 'production',
  environment: 'production'
});

// Create a container from template
deploymentConfig.createContainerConfig('user-api', 'node-api', {
  version: 'v1.2.0',
  environment: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/users',
    JWT_SECRET: 'your-jwt-secret'
  },
  maxScale: 20,
  memory: '1Gi'
});

// Create deployment configuration
deploymentConfig.createDeploymentConfig('user-api', deploymentConfig.containers.get('user-api'), {
  customDomain: 'api.example.com',
  scalingStrategy: 'concurrency',
  scalingTarget: 50
});

module.exports = {
  ContainerDeploymentConfig,
  deploymentConfig
};