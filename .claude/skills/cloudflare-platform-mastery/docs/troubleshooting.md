# Cloudflare Platform Troubleshooting Guide

> **Comprehensive troubleshooting guide with real-world solutions for common Cloudflare deployment issues**

## 🎯 Overview

This troubleshooting guide provides systematic approaches to diagnosing and resolving issues across Cloudflare's platform. Each section includes symptoms, root causes, diagnostic commands, and step-by-step solutions.

## 📋 Quick Diagnosis Framework

### 1. The 5-Minute Health Check

```bash
# Run this comprehensive health check first
#!/bin/bash

echo "🔍 Cloudflare Platform Health Check"
echo "=================================="

# Check authentication
echo "1. Authentication Status:"
wrangler whoami || echo "❌ Authentication failed"

# Check worker status
echo -e "\n2. Worker Status:"
wrangler deployments list || echo "❌ Cannot fetch deployments"

# Check DNS propagation
echo -e "\n3. DNS Status:"
dig +short your-domain.com || echo "❌ DNS lookup failed"

# Check SSL certificate
echo -e "\n4. SSL Certificate:"
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -dates || echo "❌ SSL check failed"

# Check connectivity
echo -e "\n5. Connectivity Test:"
curl -s -o /dev/null -w "%{http_code}" https://your-domain.com || echo "❌ Connection failed"

echo -e "\n✅ Health check complete"
```

### 2. Symptom Classification

| Symptom Category | Common Issues | Quick Fix |
|------------------|---------------|-----------|
| **Deployment** | Build failures, missing dependencies, authentication errors | Check `wrangler.toml`, verify secrets, run locally |
| **Runtime** | Worker timeouts, 500 errors, missing environment variables | Check logs, verify bindings, test locally |
| **Performance** | Slow responses, high latency, cache misses | Analyze caching strategy, optimize workers |
| **Security** | 403 errors, CORS issues, SSL problems | Check security rules, verify headers |
| **DNS** | Propagation delays, wrong records, subdomain issues | Use dig/nslookup, verify nameservers |

## 🚀 Deployment Issues

### Issue: Worker Deployment Fails

**Symptoms:**
```
Error: Worker script not found
Error: Invalid worker name
Error: Authentication failed
```

**Diagnosis:**

```bash
# 1. Check wrangler.toml configuration
cat wrangler.toml

# 2. Verify authentication
wrangler whoami

# 3. Check file structure
find . -name "*.js" -type f

# 4. Test local build
wrangler dev --local
```

**Solutions:**

1. **Fix Configuration Issues:**
```toml
# ✅ Correct wrangler.toml structure
name = "my-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "my-worker-prod"

# ❌ Common mistakes to avoid:
# - Missing main entry point
# - Invalid compatibility date
# - Duplicate name in environments
```

2. **Authentication Problems:**
```bash
# Re-authenticate wrangler
wrangler auth login

# Check API token permissions
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/user/tokens/verify"
```

3. **Build System Issues:**
```javascript
// ✅ Proper module exports
export default {
  async fetch(request, env, ctx) {
    return new Response('Hello World');
  }
};

// ❌ Common export mistakes
export default async function fetch(request, env) {
  // Wrong function signature
}
```

### Issue: Pages Build Fails

**Symptoms:**
```
Build failed: "npm run build" exited with code 1
Error: No output directory found
Static asset not found
```

**Diagnosis:**

```bash
# 1. Check build process locally
npm run build

# 2. Verify output directory
ls -la dist/ build/ .next/

# 3. Check build configuration
cat package.json | grep -A 5 -B 5 "build"

# 4. Test wrangler pages build locally
wrangler pages dev dist/
```

**Solutions:**

1. **Fix Build Configuration:**
```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "wrangler pages deploy dist"
  }
}
```

2. **Output Directory Issues:**
```javascript
// vite.config.js
export default {
  build: {
    outDir: 'dist', // Ensure this matches wrangler deployment
    assetsDir: 'assets'
  }
};
```

## 🔄 Runtime Issues

### Issue: Worker Timeout Errors

**Symptoms:**
```
Error: Worker execution timeout
504 Gateway Timeout
Worker exceeded CPU time limit
```

**Diagnosis:**

```bash
# 1. Check worker logs
wrangler tail

# 2. Monitor CPU usage
wrangler tail --format=json | grep 'cpu_time'

# 3. Test with timeouts
curl -w "@curl-format.txt" https://your-worker.workers.dev
```

**Solutions:**

1. **Optimize Worker Logic:**
```javascript
// ✅ GOOD: Streaming responses for long operations
export default {
  async fetch(request) {
    const { readable, writable } = new TransformStream();

    // Start processing in background
    const writer = writable.getWriter();
    processLargeDataset(writer).catch(console.error);

    return new Response(readable);
  }
};

async function processLargeDataset(writer) {
  for await (const chunk of getDataset()) {
    await writer.write(chunk);
  }
  await writer.close();
}

// ❌ BAD: Blocking operations
export default {
  async fetch() {
    const data = await fetchLargeDataset(); // Blocks entire worker
    return new Response(JSON.stringify(data));
  }
};
```

2. **Use Background Processing:**
```javascript
export default {
  async fetch(request, env, ctx) {
    // Respond immediately
    const response = new Response('Processing started');

    // Process in background
    ctx.waitUntil(
      processLongTask(request, env)
        .then(result => console.log('Background task completed:', result))
        .catch(error => console.error('Background task failed:', error))
    );

    return response;
  }
};
```

### Issue: Environment Variables Not Working

**Symptoms:**
```
ReferenceError: env is not defined
undefined variable access
Secret not available
```

**Diagnosis:**

```bash
# 1. List available secrets
wrangler secret list

# 2. Check environment configuration
wrangler dev --vars

# 3. Test environment access
wrangler dev --test
```

**Solutions:**

1. **Proper Secret Management:**
```bash
# Set secrets correctly
wrangler secret put DATABASE_URL
wrangler secret put API_KEY --env production

# Set environment variables in wrangler.toml
[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
```

2. **Access Environment Variables Correctly:**
```javascript
// ✅ Correct access patterns
export default {
  async fetch(request, env) {
    // Access environment variables
    const dbUrl = env.DATABASE_URL;
    const apiKey = env.API_KEY;

    // Access KV namespaces
    const data = await env.CACHE_KV.get('key');

    return new Response('OK');
  }
};
```

## 🌐 Performance Issues

### Issue: Slow Response Times

**Symptoms:**
`` High TTFB (Time to First Byte)
Slow API responses
Cache misses
```

**Diagnosis:**

```bash
# 1. Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.com

# curl-format.txt content:
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                      ----------\n
#           time_total:  %{time_total}\n

# 2. Check cache headers
curl -I https://your-app.com

# 3. Monitor worker performance
wrangler tail --format=json
```

**Solutions:**

1. **Implement Smart Caching:**
```javascript
// ✅ GOOD: Hierarchical caching
export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request(request.url);

    // Check cache first
    let response = await cache.match(cacheKey);
    if (response) {
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Generate response
    response = await generateResponse(request);
    response.headers.set('X-Cache', 'MISS');

    // Cache with appropriate TTL
    const ttl = getCacheTTL(request.url);
    response.headers.set('Cache-Control', `public, max-age=${ttl}`);

    // Store in cache
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
};

function getCacheTTL(url) {
  if (url.includes('/api/')) return 60;
  if (url.includes('/static/')) return 86400;
  return 3600;
}
```

2. **Optimize Database Queries:**
```javascript
// ✅ GOOD: Efficient D1 usage
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    // Use prepared statements
    const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?1');
    const result = await stmt.bind(id).first();

    // Batch operations
    const batch = [
      env.DB.prepare('UPDATE users SET last_seen = ?1 WHERE id = ?2')
        .bind(Date.now(), id),
      env.DB.prepare('INSERT INTO analytics (user_id, action) VALUES (?1, ?2)')
        .bind(id, 'view')
    ];

    await env.DB.batch(batch);

    return Response.json(result);
  }
};
```

## 🛡️ Security Issues

### Issue: CORS Errors

**Symptoms:**
```
Access to fetch has been blocked by CORS policy
No 'Access-Control-Allow-Origin' header is present
CORS preflight failed
```

**Diagnosis:**

```bash
# 1. Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v https://your-api.com/endpoint

# 2. Check response headers
curl -I https://your-api.com/endpoint
```

**Solutions:**

```javascript
// ✅ GOOD: Comprehensive CORS handling
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': getOriginFromRequest(request),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Add CORS headers to all responses
    const response = await handleRequest(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
};

function getOriginFromRequest(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = ['https://your-frontend.com', 'https://admin.your-frontend.com'];

  return allowedOrigins.includes(origin) ? origin : 'null';
}
```

### Issue: 403 Forbidden Errors

**Symptoms:**
```
403 Forbidden
Access denied
WAF blocked request
```

**Diagnosis:**

```bash
# 1. Check WAF rules
curl -H "CF-Ray: debug" https://your-domain.com

# 2. Test with different user agents
curl -H "User-Agent: Mozilla/5.0" https://your-domain.com
curl -H "User-Agent: curl/7.68.0" https://your-domain.com

# 3. Check IP reputation
curl -H "CF-Connecting-IP: 1.2.3.4" https://your-domain.com
```

**Solutions:**

1. **Configure WAF Rules:**
```javascript
// ✅ GOOD: Application-level rate limiting
export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get('CF-Connecting-IP');
    const rateLimitKey = `rate_limit:${clientIP}`;

    // Check rate limit
    const currentCount = await env.RATE_LIMIT_KV.get(rateLimitKey);
    if (currentCount && parseInt(currentCount) > 100) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Process request
    const response = await handleRequest(request);

    // Update rate limit counter
    const newCount = (parseInt(currentCount) || 0) + 1;
    ctx.waitUntil(
      env.RATE_LIMIT_KV.put(rateLimitKey, newCount.toString(), {
        expirationTtl: 60 // 1 minute window
      })
    );

    return response;
  }
};
```

## 🔧 DNS & SSL Issues

### Issue: DNS Propagation Problems

**Symptoms:**
```
DNS_PROBE_FINISHED_NXDOMAIN
Domain not found
Nameserver not responding
```

**Diagnosis:**

```bash
# 1. Check DNS from multiple servers
dig your-domain.com
dig @8.8.8.8 your-domain.com
dig @1.1.1.1 your-domain.com

# 2. Check nameservers
dig NS your-domain.com

# 3. Check propagation
whois your-domain.com
```

**Solutions:**

1. **Verify DNS Configuration:**
```bash
# Set correct nameservers at your registrar
# Nameservers should be:
# dina.ns.cloudflare.com
# josh.ns.cloudflare.com

# Check with your domain registrar
# Update if necessary and wait 24-48 hours for full propagation
```

2. **Local DNS Cache:**
```bash
# Clear local DNS cache
# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux
sudo systemctl flush-dns
sudo systemctl restart systemd-resolved

# Windows
ipconfig /flushdns
```

### Issue: SSL Certificate Problems

**Symptoms:**
```
SSL_ERROR_BAD_CERT_DOMAIN
Your connection is not private
Certificate expired
```

**Diagnosis:**

```bash
# 1. Check certificate details
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 2. Check certificate chain
echo | openssl s_client -connect your-domain.com:443 -showcerts

# 3. Verify SSL configuration
curl -I https://your-domain.com
```

**Solutions:**

1. **SSL/TLS Mode Configuration:**
```
In Cloudflare Dashboard:
1. Go to SSL/TLS → Overview
2. Select "Full (Strict)" for maximum security
3. Enable "Always Use HTTPS"
4. Set "Automatic HTTPS Rewrites" to On
```

2. **Certificate Validation:**
```javascript
// ✅ GOOD: HTTPS enforcement
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirect HTTP to HTTPS
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    return handleRequest(request, env);
  }
};
```

## 🔍 Advanced Debugging Techniques

### 1. Real-time Log Analysis

```bash
# Monitor all worker activity
wrangler tail --format=pretty

# Filter by specific patterns
wrangler tail | grep "ERROR"
wrangler tail | grep "timeout"

# Export logs for analysis
wrangler tail --format=json > worker-logs.json
```

### 2. Performance Profiling

```javascript
// ✅ GOOD: Performance monitoring
export default {
  async fetch(request, env, ctx) {
    const startTime = performance.now();
    const url = new URL(request.url);

    try {
      const response = await handleRequest(request, env);
      const duration = performance.now() - startTime;

      // Log performance metrics
      console.log(`Request completed: ${url.pathname} - ${duration.toFixed(2)}ms`);

      // Add performance headers
      response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);

      return response;

    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`Request failed: ${url.pathname} - ${duration.toFixed(2)}ms - ${error.message}`);
      throw error;
    }
  }
};
```

### 3. Memory Usage Analysis

```javascript
// ✅ GOOD: Memory monitoring
export default {
  async fetch(request, env, ctx) {
    const initialMemory = getMemoryUsage();

    try {
      const response = await handleRequest(request, env);
      const finalMemory = getMemoryUsage();

      // Log memory usage
      console.log(`Memory delta: ${finalMemory - initialMemory} bytes`);

      return response;

    } catch (error) {
      console.error(`Memory leak detected: ${getMemoryUsage() - initialMemory} bytes`);
      throw error;
    }
  }
};

function getMemoryUsage() {
  // Note: Cloudflare Workers don't expose direct memory usage
  // This is a placeholder for when such APIs become available
  return Date.now(); // Temporary metric
}
```

## 📋 Troubleshooting Checklist

### Immediate Response (5 minutes)
- [ ] Run quick health check script
- [ ] Check authentication status
- [ ] Verify DNS propagation
- [ ] Test with curl from multiple locations
- [ ] Check worker status and logs

### Detailed Investigation (15 minutes)
- [ ] Review recent deployment changes
- [ ] Check environment variable configuration
- [ ] Analyze error patterns in logs
- [ ] Test individual components in isolation
- [ ] Verify external service dependencies

### Resolution Steps (30 minutes)
- [ ] Implement fixes based on diagnosis
- [ ] Test solution in staging environment
- [ ] Deploy to production with monitoring
- [ ] Verify fix resolution
- [ ] Document root cause and solution

### Prevention (Ongoing)
- [ ] Set up monitoring alerts
- [ ] Implement automated testing
- [ ] Create runbooks for common issues
- [ ] Regular backup and recovery testing
- [ ] Performance and security audits

## 🚨 Emergency Procedures

### 1. Immediate Rollback

```bash
# Roll to previous worker version
wrangler rollback --env production

# Or deploy known-good version
wrangler deploy --env production --compatibility-date 2024-01-01
```

### 2. Emergency Bypass

```javascript
// Emergency bypass worker
export default {
  async fetch(request) {
    // Simple pass-through during emergencies
    return fetch(request);
  }
};
```

### 3. Service Status Check

```bash
# Check Cloudflare status
curl https://www.cloudflarestatus.com/api/v2/status.json

# Check regional status
curl https://www.cloudflarestatus.com/api/v2/summary.json
```

---

**Need more help?** Check out our [Migration Guide](migration-guide.md) for moving from other platforms, or explore our [Learning Paths](../paths/) for comprehensive skill development.