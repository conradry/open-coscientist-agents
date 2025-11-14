# Cloudflare Platform Best Practices

> **Comprehensive guide to professional deployment patterns, optimization techniques, and operational excellence on Cloudflare**

## 🎯 Overview

This guide covers production-ready best practices for deploying and managing applications on Cloudflare's platform. These practices are based on thousands of successful deployments across various scales and use cases.

## 📋 Table of Contents

- [Architecture & Design Patterns](#architecture--design-patterns)
- [Security Best Practices](#security-best-practices)
- [Performance Optimization](#performance-optimization)
- [Development & Deployment](#development--deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Cost Optimization](#cost-optimization)
- [Disaster Recovery](#disaster-recovery)
- [Enterprise Considerations](#enterprise-considerations)

## 🏗️ Architecture & Design Patterns

### 1. Edge-First Architecture

```javascript
// ✅ GOOD: Design for the edge from the start
export default {
  async fetch(request, env, ctx) {
    // Process requests at the edge
    const cacheKey = new Request(request.url);
    const cache = caches.default;

    // Check cache first
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // Generate response
    response = await generateResponse(request);

    // Cache for future requests
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};

// ❌ AVOID: Origin-dependent designs that don't leverage edge capabilities
export default {
  async fetch(request, env) {
    // Always hitting origin - defeats edge benefits
    const response = await fetch(env.ORIGIN_URL + request.url);
    return response;
  }
};
```

### 2. Microservice Workers Pattern

```javascript
// ✅ GOOD: Single responsibility workers
// auth-worker.js
export default {
  async fetch(request, env) {
    if (!request.headers.get('Authorization')) {
      return new Response('Unauthorized', { status: 401 });
    }
    // Authentication logic only
  }
};

// api-worker.js
export default {
  async fetch(request, env) {
    // API business logic only
  }
};

// ❌ AVOID: Monolithic workers doing everything
export default {
  async fetch(request, env) {
    // Authentication + API + Database + Email + etc...
  }
};
```

### 3. Environment-Specific Deployments

```javascript
// wrangler.toml - Proper environment configuration
name = "my-app"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "my-app-prod"
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
kv_namespaces = [
  { binding = "DATA", id = "prod-kv-id", preview_id = "preview-kv-id" }
]

[env.staging]
name = "my-app-staging"
routes = [
  { pattern = "api-staging.example.com/*", zone_name = "example.com" }
]
kv_namespaces = [
  { binding = "DATA", id = "staging-kv-id" }
]
```

## 🛡️ Security Best Practices

### 1. Defense in Depth Security

```javascript
// ✅ GOOD: Multiple security layers
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP');
    const key = `rate-limit:${clientIP}`;
    const count = await env.KV.get(key);

    if (count && parseInt(count) > 100) {
      return new Response('Too Many Requests', { status: 429 });
    }

    // 2. Request validation
    if (!isValidRequest(request)) {
      return new Response('Bad Request', { status: 400 });
    }

    // 3. Authentication
    if (!isAuthenticated(request, env)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 4. Authorization
    if (!isAuthorized(request, env)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Process request
    const response = await handleRequest(request);

    // 5. Response headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 6. Update rate limit
    ctx.waitUntil(env.KV.put(key, (parseInt(count) || 0) + 1, { expirationTtl: 60 }));

    return response;
  }
};
```

### 2. Environment Variable Security

```javascript
// ✅ GOOD: Use secrets for sensitive data
// wrangler.toml
[env.production.vars]
API_BASE_URL = "https://api.example.com"
API_KEY = ""  # Set via wrangler secret put

[env.development.vars]
API_BASE_URL = "https://api-dev.example.com"
API_KEY = ""  # Set via wrangler secret put

# CLI commands to set secrets
wrangler secret put API_KEY --env production
wrangler secret put API_KEY --env development
```

### 3. CORS Configuration

```javascript
// ✅ GOOD: Proper CORS handling
function handleCORS(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': getOriginFromRequest(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return { corsHeaders };
}
```

## ⚡ Performance Optimization

### 1. Smart Caching Strategies

```javascript
// ✅ GOOD: Hierarchical caching
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;

    // 1. Exact match cache
    const exactKey = new Request(request.url);
    let response = await cache.match(exactKey);

    if (!response) {
      // 2. Vary cache for authenticated content
      const varyKey = new Request(request.url, {
        headers: { 'Vary': 'Authorization' }
      });
      response = await cache.match(varyKey);
    }

    if (!response) {
      // 3. Generate fresh response
      response = await generateResponse(request);

      // 4. Cache with appropriate TTL based on content
      const ttl = getCacheTTL(request.url, response);
      response.headers.set('Cache-Control', `public, max-age=${ttl}`);

      ctx.waitUntil(cache.put(exactKey, response.clone()));
    }

    return response;
  }
};

function getCacheTTL(url, response) {
  // Different TTLs for different content
  if (url.includes('/api/')) return 60;        // API: 1 minute
  if (url.includes('/static/')) return 86400;  // Static: 1 day
  return 3600;                                 // Default: 1 hour
}
```

### 2. Image Optimization

```javascript
// ✅ GOOD: Dynamic image optimization
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/images/')) {
      const imageUrl = url.searchParams.get('url');
      const width = parseInt(url.searchParams.get('w')) || 800;
      const height = parseInt(url.searchParams.get('h')) || 600;
      const quality = parseInt(url.searchParams.get('q')) || 80;

      // Use Cloudflare Image Resizing
      const imageRequest = new Request(imageUrl, {
        cf: {
          image: {
            width, height, quality,
            format: 'auto',  // Automatically choose best format
            fit: 'cover'
          }
        }
      });

      const response = await fetch(imageRequest);

      // Cache optimized images
      response.headers.set('Cache-Control', 'public, max-age=31536000');
      return response;
    }

    return fetch(request);
  }
};
```

### 3. Database Connection Pooling

```javascript
// ✅ GOOD: Efficient D1 usage
export default {
  async fetch(request, env) {
    // Use prepared statements for better performance
    const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?1');
    const result = await stmt.bind(userId).first();

    // Batch operations when possible
    const batch = [
      env.DB.prepare('UPDATE users SET last_login = ?1 WHERE id = ?2').bind(Date.now(), userId),
      env.DB.prepare('INSERT INTO analytics (event, user_id) VALUES (?1, ?2)').bind('login', userId)
    ];

    await env.DB.batch(batch);

    return Response.json(result);
  }
};
```

## 🚀 Development & Deployment

### 1. CI/CD Pipeline Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build application
      run: npm run build

    - name: Deploy to staging
      if: github.ref == 'refs/pull/*/head'
      run: wrangler deploy --env staging
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

    - name: Deploy to production
      if: github.ref == 'refs/heads/main'
      run: wrangler deploy --env production
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 2. Local Development Setup

```javascript
// wrangler.toml - Development configuration
[env.dev]
name = "my-app-dev"
local = true
vars = { ENVIRONMENT: "development" }

# Development scripts in package.json
{
  "scripts": {
    "dev": "wrangler dev --env dev",
    "dev:debug": "wrangler dev --env dev --verbose",
    "test": "jest",
    "test:watch": "jest --watch",
    "build": "webpack --mode=production",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:prod": "wrangler deploy --env production"
  }
}
```

### 3. Error Handling & Logging

```javascript
// ✅ GOOD: Comprehensive error handling
export default {
  async fetch(request, env, ctx) {
    try {
      const response = await handleRequest(request, env);

      // Log successful requests
      ctx.waitUntil(
        env.KV.put(`log:${Date.now()}`, JSON.stringify({
          status: 'success',
          url: request.url,
          method: request.method,
          responseStatus: response.status,
          timestamp: new Date().toISOString()
        }))
      );

      return response;

    } catch (error) {
      // Log errors
      console.error('Request failed:', error);

      ctx.waitUntil(
        env.KV.put(`error:${Date.now()}`, JSON.stringify({
          status: 'error',
          url: request.url,
          method: request.method,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }))
      );

      // Return appropriate error response
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## 📊 Monitoring & Observability

### 1. Custom Analytics Implementation

```javascript
// ✅ GOOD: Detailed performance tracking
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      const response = await handleRequest(request);
      const duration = Date.now() - startTime;

      // Track performance metrics
      ctx.waitUntil(
        fetch('https://analytics.example.com/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric: 'request_duration',
            value: duration,
            tags: {
              path: url.pathname,
              method: request.method,
              status: response.status
            }
          })
        })
      );

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Track error metrics
      ctx.waitUntil(
        fetch('https://analytics.example.com/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric: 'error_count',
            value: 1,
            tags: {
              error_type: error.name,
              path: url.pathname,
              duration: duration
            }
          })
        })
      );

      throw error;
    }
  }
};
```

### 2. Health Check Endpoints

```javascript
// ✅ GOOD: Comprehensive health checks
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const health = await checkHealth(env);
      const status = health.healthy ? 200 : 503;

      return new Response(JSON.stringify(health), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handleRequest(request, env);
  }
};

async function checkHealth(env) {
  const checks = {
    kv: false,
    database: false,
    external_api: false
  };

  try {
    await env.KV.get('health-check');
    checks.kv = true;
  } catch (e) {
    console.error('KV health check failed:', e);
  }

  try {
    await env.DB.prepare('SELECT 1').first();
    checks.database = true;
  } catch (e) {
    console.error('Database health check failed:', e);
  }

  try {
    const response = await fetch('https://api.example.com/health');
    checks.external_api = response.ok;
  } catch (e) {
    console.error('External API health check failed:', e);
  }

  const healthy = Object.values(checks).every(Boolean);

  return {
    healthy,
    timestamp: new Date().toISOString(),
    checks,
    version: env.VERSION || 'unknown'
  };
}
```

## 💰 Cost Optimization

### 1. Resource Usage Optimization

```javascript
// ✅ GOOD: Efficient resource usage
export default {
  async fetch(request, env, ctx) {
    // 1. Use streaming responses for large data
    if (request.url.includes('/stream/')) {
      return new Response(
        (async function* () {
          for await (const chunk of generateLargeData()) {
            yield chunk;
          }
        })(),
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
    }

    // 2. Use background processing for non-critical tasks
    ctx.waitUntil(
      processAnalytics(request).catch(console.error)
    );

    // 3. Implement request deduplication
    const deduplicationKey = generateDeduplicationKey(request);
    const existingPromise = env.PROMISES.get(deduplicationKey);

    if (existingPromise) {
      return existingPromise;
    }

    const promise = handleRequest(request, env);
    env.PROMISES.set(deduplicationKey, promise);

    return promise;
  }
};
```

### 2. Caching Strategy Optimization

```javascript
// ✅ GOOD: Cost-effective caching
const CACHE_STRATEGIES = {
  static: {
    maxAge: 365 * 24 * 60 * 60,  // 1 year
    edgeMaxAge: 365 * 24 * 60 * 60,
    browserMaxAge: 24 * 60 * 60   // 1 day browser cache
  },

  api: {
    maxAge: 5 * 60,               // 5 minutes
    edgeMaxAge: 5 * 60,
    browserMaxAge: 0              // No browser cache
  },

  dynamic: {
    maxAge: 60,                   // 1 minute
    edgeMaxAge: 60,
    browserMaxAge: 0
  }
};

function applyCacheStrategy(response, strategy) {
  const config = CACHE_STRATEGIES[strategy] || CACHE_STRATEGIES.dynamic;

  response.headers.set('Cache-Control',
    `public, max-age=${config.browserMaxAge}, s-maxage=${config.edgeMaxAge}`
  );
  response.headers.set('Edge-Cache-Control',
    `public, max-age=${config.edgeMaxAge}`
  );

  return response;
}
```

## 🔄 Disaster Recovery

### 1. Backup Strategy

```javascript
// ✅ GOOD: Automated backups
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === '0 2 * * *') { // Daily at 2 AM
      await performBackup(env);
    }
  }
};

async function performBackup(env) {
  const timestamp = new Date().toISOString().split('T')[0];

  // Backup KV data
  const kvData = await listAllKVData(env.KV);
  await env.BACKUP_KV.put(`backup:${timestamp}:kv`, JSON.stringify(kvData));

  // Backup D1 database
  const dbBackup = await env.DB.export();
  await env.BACKUP_KV.put(`backup:${timestamp}:db`, dbBackup);

  // Cleanup old backups (keep 30 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const oldBackups = await env.BACKUP_KV.list({
    prefix: 'backup:',
    limit: 1000
  });

  for (const key of oldBackups.keys) {
    const backupDate = new Date(key.name.split(':')[1]);
    if (backupDate < cutoffDate) {
      await env.BACKUP_KV.delete(key.name);
    }
  }
}
```

### 2. Fallback Mechanisms

```javascript
// ✅ GOOD: Graceful degradation
export default {
  async fetch(request, env) {
    try {
      // Try primary service
      return await handlePrimaryRequest(request, env);

    } catch (primaryError) {
      console.warn('Primary service failed:', primaryError);

      try {
        // Fallback to secondary service
        return await handleFallbackRequest(request, env);

      } catch (fallbackError) {
        console.error('Fallback service failed:', fallbackError);

        // Return cached version if available
        return await getCachedResponse(request, env) ||
               new Response('Service Unavailable', { status: 503 });
      }
    }
  }
};
```

## 🏢 Enterprise Considerations

### 1. Multi-Environment Management

```javascript
// ✅ GOOD: Environment-agnostic configuration
const config = {
  production: {
    apiUrl: 'https://api.company.com',
    rateLimit: 1000,
    cacheTTL: 3600,
    logLevel: 'warn'
  },

  staging: {
    apiUrl: 'https://api-staging.company.com',
    rateLimit: 100,
    cacheTTL: 60,
    logLevel: 'info'
  },

  development: {
    apiUrl: 'http://localhost:3001',
    rateLimit: 10,
    cacheTTL: 0,
    logLevel: 'debug'
  }
};

function getConfig(env) {
  return config[env.ENVIRONMENT] || config.development;
}
```

### 2. Compliance & Audit

```javascript
// ✅ GOOD: Comprehensive audit logging
export default {
  async fetch(request, env, ctx) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      userId: await getUserId(request, env)
    };

    try {
      const response = await handleRequest(request, env);

      auditLog.status = response.status;
      auditLog.success = true;

      ctx.waitUntil(
        env.AUDIT_LOGS.put(
          `audit:${auditLog.requestId}`,
          JSON.stringify(auditLog),
          { expirationTtl: 365 * 24 * 60 * 60 } // Keep for 1 year
        )
      );

      return response;

    } catch (error) {
      auditLog.status = 500;
      auditLog.success = false;
      auditLog.error = error.message;

      ctx.waitUntil(
        env.AUDIT_LOGS.put(
          `audit:${auditLog.requestId}`,
          JSON.stringify(auditLog),
          { expirationTtl: 365 * 24 * 60 * 60 }
        )
      );

      throw error;
    }
  }
};
```

## 🎯 Implementation Checklist

Use this checklist to ensure you're following best practices:

### Architecture
- [ ] Edge-first design principles
- [ ] Single responsibility workers
- [ ] Proper environment separation
- [ ] Scalable data structures

### Security
- [ ] Multiple security layers
- [ ] Proper secret management
- [ ] CORS configuration
- [ ] Input validation and sanitization

### Performance
- [ ] Hierarchical caching strategy
- [ ] Image optimization
- [ ] Efficient database usage
- [ ] Streaming responses for large data

### Development
- [ ] CI/CD pipeline setup
- [ ] Local development environment
- [ ] Comprehensive error handling
- [ ] Code quality tools

### Monitoring
- [ ] Custom analytics implementation
- [ ] Health check endpoints
- [ ] Performance tracking
- [ ] Error monitoring

### Operations
- [ ] Cost optimization strategies
- [ ] Backup procedures
- [ ] Fallback mechanisms
- [ ] Documentation and runbooks

---

**Next Steps**: Explore our [Troubleshooting Guide](troubleshooting.md) for advanced debugging techniques and solutions to common issues.