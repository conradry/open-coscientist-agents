/**
 * Node.js Microservice Container for Cloudflare Container Registry
 * Production-ready Express.js API with comprehensive monitoring and optimization
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const promBundle = require('express-prom-bundle');
const winston = require('winston');
const Redis = require('ioredis');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const EventEmitter = require('events');
const cluster = require('cluster');
const os = require('os');

// Configuration
const config = {
  port: process.env.PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  appName: process.env.APP_NAME || 'Node.js Cloudflare Container',
  appVersion: process.env.APP_VERSION || '1.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/app',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  bcryptRounds: 12,

  // Performance
  maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 20,
  compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
  cacheTTL: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // Clustering
  clusterWorkers: parseInt(process.env.CLUSTER_WORKERS) || os.cpus().length,

  // Monitoring
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT) || 9090,

  // Cloudflare Integration
  cloudflareWorkers: process.env.CLOUDFLARE_WORKERS === 'true',
  webhookSecret: process.env.WEBHOOK_SECRET,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json'
};

// Enhanced Winston Logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: config.logFormat === 'json'
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.simple()
      ),
  defaultMeta: {
    service: config.appName,
    version: config.appVersion,
    environment: config.nodeEnv
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Application State Management
class AppState extends EventEmitter {
  constructor() {
    super();
    this.startTime = Date.now();
    this.requests = new Map();
    this.connections = new Set();
    this.metrics = {
      totalRequests: 0,
      activeRequests: 0,
      totalConnections: 0,
      errors: 0
    };
    this.health = {
      database: 'unknown',
      redis: 'unknown',
      lastCheck: null
    };
  }

  addRequest(requestId, metadata) {
    this.requests.set(requestId, {
      ...metadata,
      startTime: Date.now()
    });
    this.metrics.activeRequests++;
    this.metrics.totalRequests++;
  }

  completeRequest(requestId) {
    const request = this.requests.get(requestId);
    if (request) {
      const duration = Date.now() - request.startTime;
      this.emit('requestCompleted', { request, duration });
      this.requests.delete(requestId);
      this.metrics.activeRequests--;
    }
  }

  addConnection(connection) {
    this.connections.add(connection);
    this.metrics.totalConnections++;
  }

  removeConnection(connection) {
    this.connections.delete(connection);
  }

  updateHealth(component, status) {
    this.health[component] = status;
    this.health.lastCheck = new Date().toISOString();
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const memUsage = process.memoryUsage();

    return {
      ...this.metrics,
      uptime,
      connections: this.connections.size,
      memoryUsage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      },
      health: this.health,
      version: config.appVersion
    };
  }
}

const appState = new AppState();

// Database Connection
class DatabaseManager {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        max: config.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      appState.updateHealth('database', 'healthy');
      logger.info('Database connection established');

    } catch (error) {
      appState.updateHealth('database', 'unhealthy');
      logger.error('Database connection failed', { error: error.message });
      throw error;
    }
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        query: text.substring(0, 100),
        duration,
        rows: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text.substring(0, 100),
        duration,
        error: error.message
      });
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Redis Connection
class RedisManager {
  constructor() {
    this.redis = null;
  }

  async initialize() {
    try {
      this.redis = new Redis(config.redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        appState.updateHealth('redis', 'healthy');
        logger.info('Redis connection established');
      });

      this.redis.on('error', (error) => {
        appState.updateHealth('redis', 'unhealthy');
        logger.error('Redis connection error', { error: error.message });
      });

      await this.redis.connect();

    } catch (error) {
      appState.updateHealth('redis', 'unhealthy');
      logger.error('Redis initialization failed', { error: error.message });
      throw error;
    }
  }

  async get(key) {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Redis get failed', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = config.cacheTTL) {
    try {
      return await this.redis.setex(key, ttl, value);
    } catch (error) {
      logger.error('Redis set failed', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      return await this.redis.del(key);
    } catch (error) {
      logger.error('Redis delete failed', { key, error: error.message });
      return false;
    }
  }

  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// JWT Service
class JWTService {
  generateToken(payload) {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiration
    });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  generateRefreshToken() {
    return require('crypto').randomBytes(64).toString('hex');
  }
}

// Validation Schemas
const schemas = {
  userCreate: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(100).required(),
    password: Joi.string().min(8).required(),
    metadata: Joi.object().optional()
  }),

  userUpdate: Joi.object({
    name: Joi.string().min(2).max(100),
    metadata: Joi.object()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

// Create Express Application
function createApp() {
  const app = express();

  // Prometheus Metrics Middleware
  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    promClient: {
      collectDefaultMetrics: {
        timeout: 5000
      }
    }
  });
  app.use(metricsMiddleware);

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS Configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ?
      process.env.ALLOWED_ORIGINS.split(',') :
      ['https://*.workers.dev', 'https://*.pages.dev'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  }));

  // Compression Middleware
  app.use(compression({
    level: config.compressionLevel,
    threshold: 1024
  }));

  // Body Parsing Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate Limiting Middleware
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);

  // Request ID and Logging Middleware
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startTime = Date.now();
    appState.addRequest(requestId, {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });

    // Log request
    logger.info('Request started', {
      requestId,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      appState.completeRequest(requestId);

      logger.info('Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent')
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  });

  // Connection Tracking
  app.use((req, res, next) => {
    appState.addConnection(res);

    res.on('close', () => {
      appState.removeConnection(res);
    });

    next();
  });

  // Initialize Services
  const db = new DatabaseManager();
  const redis = new RedisManager();
  const jwtService = new JWTService();

  // Database Initialization
  app.locals.db = db;
  app.locals.redis = redis;
  app.locals.jwtService = jwtService;

  // Health Check Endpoints
  app.get('/health', async (req, res) => {
    try {
      const startTime = Date.now();

      // Check database
      let dbStatus = 'healthy';
      try {
        await db.query('SELECT 1');
      } catch (error) {
        dbStatus = 'unhealthy';
        logger.error('Health check: Database unhealthy', { error: error.message });
      }

      // Check Redis
      let redisStatus = 'healthy';
      try {
        await redis.ping();
      } catch (error) {
        redisStatus = 'unhealthy';
        logger.error('Health check: Redis unhealthy', { error: error.message });
      }

      const duration = Date.now() - startTime;
      const overallStatus = (dbStatus === 'healthy' && redisStatus === 'healthy') ? 'healthy' : 'degraded';

      appState.updateHealth('database', dbStatus);
      appState.updateHealth('redis', redisStatus);

      res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: config.appVersion,
        environment: config.nodeEnv,
        uptime: Date.now() - appState.startTime,
        checks: {
          database: dbStatus,
          redis: redisStatus
        },
        duration
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Metrics Endpoint
  app.get('/metrics', (req, res) => {
    const metrics = appState.getMetrics();
    res.json(metrics);
  });

  // API Routes
  const apiRouter = express.Router();

  // Authentication Middleware
  const authenticate = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwtService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Cache Middleware
  const cache = (ttl = config.cacheTTL) => {
    return async (req, res, next) => {
      if (req.method !== 'GET') return next();

      const key = `cache:${req.originalUrl}`;
      try {
        const cached = await redis.get(key);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (error) {
        logger.error('Cache retrieval failed', { key, error: error.message });
      }

      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data) {
        try {
          redis.set(key, JSON.stringify(data), ttl);
        } catch (error) {
          logger.error('Cache storage failed', { key, error: error.message });
        }
        return originalJson.call(this, data);
      };

      next();
    };
  };

  // User Routes
  apiRouter.post('/auth/register', async (req, res) => {
    try {
      const { error, value } = schemas.userCreate.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      // Check if user exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [value.email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(value.password, config.bcryptRounds);

      // Create user
      const result = await db.query(
        `INSERT INTO users (email, name, password_hash, metadata)
         VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at`,
        [value.email, value.name, hashedPassword, JSON.stringify(value.metadata || {})]
      );

      const user = result.rows[0];
      const token = jwtService.generateToken({
        id: user.id,
        email: user.email
      });

      logger.info('User registered', { userId: user.id, email: user.email });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        },
        token
      });
    } catch (error) {
      logger.error('Registration failed', { error: error.message });
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  apiRouter.post('/auth/login', async (req, res) => {
    try {
      const { error, value } = schemas.login.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      // Find user
      const result = await db.query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1',
        [value.email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(value.password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwtService.generateToken({
        id: user.id,
        email: user.email
      });

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      res.status(500).json({ error: 'Login failed' });
    }
  });

  apiRouter.get('/users/profile', authenticate, cache(300), async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, email, name, metadata, created_at, updated_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        metadata: JSON.parse(user.metadata || '{}'),
        createdAt: user.created_at,
        updatedAt: user.updated_at
      });
    } catch (error) {
      logger.error('Get profile failed', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  apiRouter.put('/users/profile', authenticate, async (req, res) => {
    try {
      const { error, value } = schemas.userUpdate.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await db.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             metadata = COALESCE($2, metadata::jsonb),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, name, metadata, updated_at`,
        [
          value.name,
          value.metadata ? JSON.stringify(value.metadata) : null,
          req.user.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      // Clear cache
      await redis.del(`cache:/api/users/profile`);

      logger.info('Profile updated', { userId: req.user.id });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        metadata: JSON.parse(user.metadata || '{}'),
        updatedAt: user.updated_at
      });
    } catch (error) {
      logger.error('Profile update failed', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Cloudflare Webhook Endpoint
  apiRouter.post('/webhooks/cloudflare', async (req, res) => {
    try {
      const signature = req.headers['cf-webhook-signature'];
      if (!signature || !config.webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized webhook' });
      }

      // Verify webhook signature (simplified)
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Process webhook
      const { type, data } = req.body;
      logger.info('Cloudflare webhook received', { type, data });

      // Handle different webhook types
      switch (type) {
        case 'deployment':
          await handleDeploymentWebhook(data);
          break;
        case 'cache_purge':
          await handleCachePurgeWebhook(data);
          break;
        default:
          logger.warn('Unknown webhook type', { type });
      }

      res.json({ status: 'processed' });
    } catch (error) {
      logger.error('Webhook processing failed', { error: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Webhook Handlers
  async function handleDeploymentWebhook(data) {
    logger.info('Processing deployment webhook', { deployment: data });
    // Implementation for deployment handling
  }

  async function handleCachePurgeWebhook(data) {
    if (data.urls) {
      for (const url of data.urls) {
        await redis.del(`cache:${url}`);
      }
    }
    logger.info('Cache purged', { urls: data.urls });
  }

  app.use('/api', apiRouter);

  // 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
      method: req.method
    });
  });

  // Error Handler
  app.use((error, req, res, next) => {
    appState.metrics.errors++;

    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId,
      path: req.path,
      method: req.method
    });

    res.status(500).json({
      error: 'Internal Server Error',
      requestId: req.requestId
    });
  });

  return app;
}

// Main Application
async function main() {
  try {
    const app = createApp();

    // Initialize services
    await app.locals.db.initialize();
    await app.locals.redis.initialize();

    const server = app.listen(config.port, config.host, () => {
      logger.info(`Server started on ${config.host}:${config.port}`, {
        version: config.appVersion,
        environment: config.nodeEnv,
        cluster: cluster.isMaster ? 'master' : 'worker',
        pid: process.pid
      });
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await app.locals.db.close();
          await app.locals.redis.close();
          logger.info('Database and Redis connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Cluster support
if (config.clusterWorkers > 1 && cluster.isMaster) {
  logger.info(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < config.clusterWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });
} else {
  main();
}

module.exports = { createApp };