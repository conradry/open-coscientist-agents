# Cloudflare Anti-Patterns Documentation

## Overview

This document documents common mistakes and anti-patterns observed in real-world Cloudflare deployments, particularly from the medical research platform implementation. Each anti-pattern includes what went wrong, why it's problematic, and how to fix it.

---

## 🚫 Critical Anti-Patterns

### Anti-Pattern 1: "Over-caching Dynamic Content"
**Severity**: HIGH
**Seen in**: Medical research platform v1.0

#### What it looks like:
```javascript
// DANGEROUS: Cache everything with long TTL
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const cache = caches.default
  let response = await cache.match(request)

  if (!response) {
    response = await fetch(request)
    // DON'T: Cache API responses for days
    event.waitUntil(cache.put(request, response.clone()))
  }

  return response
}
```

#### Why it's bad:
- **Stale Medical Data**: Users saw outdated research results for hours
- **Cache Poisoning**: Malicious responses cached and served to all users
- **Invalidation Hell**: Complex cache-busting required for updates
- **User Trust Issues**: Critical medical information appeared outdated

#### Real-world impact:
```
User reports: "Why am I seeing research from yesterday?"
Backend team: "The data is updated, but users see old results"
Root cause: API responses cached for 24 hours
Resolution time: 4 hours of debugging + cache purge
```

#### ✅ Correct approach:
```javascript
// SAFE: Intelligent caching based on content type and volatility
async function handleRequest(request, env) {
  const url = new URL(request.url)
  const cache = caches.default
  let response = await cache.match(request)

  if (!response) {
    response = await fetch(request)

    // Smart caching based on endpoint and content type
    if (shouldCache(request, response)) {
      const ttl = getCacheTTL(request, response)
      response = new Response(response.body, {
        ...response,
        headers: {
          ...response.headers,
          'Cache-Control': `public, max-age=${ttl}`,
          'X-Cache-Bypass': request.headers.get('X-Cache-Bypass')
        }
      })
      event.waitUntil(cache.put(request, response.clone()))
    }
  }

  return response
}

function shouldCache(request, response) {
  // Cache static assets
  if (request.url.match(/\.(css|js|png|jpg|gif|ico|woff2?)$/)) {
    return true
  }

  // Cache API responses cautiously
  if (request.url.includes('/api/')) {
    const contentType = response.headers.get('content-type')
    return contentType?.includes('application/json') &&
           response.status === 200 &&
           !request.url.includes('/search') &&
           !request.url.includes('/patient/')
  }

  return false
}

function getCacheTTL(request, response) {
  // Long TTL for static assets
  if (request.url.match(/\.(css|js|png|jpg|gif|ico|woff2?)$/)) {
    return 86400 // 24 hours
  }

  // Short TTL for stable API responses
  if (request.url.includes('/api/')) {
    return 300 // 5 minutes
  }

  return 60 // Default: 1 minute
}
```

---

### Anti-Pattern 2: "No Environment Separation"
**Severity**: CRITICAL
**Seen in**: Development affecting production

#### What it looks like:
```toml
# DANGEROUS: Single environment configuration
name = "medresearch-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Same database for all environments
[[d1_databases]]
binding = "DB"
database_name = "medresearch-db"
database_id = "single-db-id"

# Same KV namespace for all environments
[[kv_namespaces]]
binding = "CACHE_KV"
id = "single-kv-id"
```

#### Why it's bad:
- **Data Contamination**: Development data appeared in production
- **Schema Conflicts**: Database migrations broke production
- **Cache Pollution**: Development test data cached for production users
- **Rollback Disasters**: No safe rollback path

#### Real-world impact:
```
Monday 9am: Developer runs test script with fake patient data
Monday 9:01am: Script runs against production database (oops)
Monday 9:15am: Production reports showing fake patient names
Monday 10am: Emergency database restore from backup
Downtime: 45 minutes
User impact: High (medical data integrity)
```

#### ✅ Correct approach:
```toml
# SAFE: Environment-specific configuration
name = "medresearch-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Production environment
[env.production]
name = "medresearch-api-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "medresearch-db-prod"
database_id = "production-db-id"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "production-kv-id"

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
CACHE_TTL = "3600"
RATE_LIMIT = "100"

# Staging environment
[env.staging]
name = "medresearch-api-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "medresearch-db-staging"
database_id = "staging-db-id"

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "staging-kv-id"

[env.staging.vars]
ENVIRONMENT = "staging"
LOG_LEVEL = "info"
CACHE_TTL = "300"
RATE_LIMIT = "500"

# Development environment (local)
[[d1_databases]]
binding = "DB"
database_name = "medresearch-db-dev"
database_id = "dev-db-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "dev-kv-id"

[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
CACHE_TTL = "60"
RATE_LIMIT = "1000"
```

---

### Anti-Pattern 3: "Missing Error Handling for External APIs"
**Severity**: HIGH
**Seen in**: PubMed API integration outage

#### What it looks like:
```javascript
// DANGEROUS: No error handling for external API
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')

    // DON'T: Direct API call without error handling
    const pubmedResponse = await fetch(
      `https://pubmed.ncbi.nlm.nih.gov/api/search?term=${query}`
    )

    const data = await pubmedResponse.json()

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

#### Why it's bad:
- **Cascading Failures**: External API downtime causes complete service outage
- **Poor UX**: Users see cryptic error messages
- **No Fallback**: No alternative data source or cached results
- **SLA Violations**: Service becomes unreliable

#### Real-world impact:
```
2:00 PM: PubMed API becomes slow (500ms+ response times)
2:05 PM: All user requests start timing out
2:10 PM: Service completely unavailable
2:30 PM: Team diagnoses issue, deploys hotfix
2:45 PM: Service restored with cached data
Impact: 45-minute outage, 100% error rate
```

#### ✅ Correct approach:
```javascript
// SAFE: Comprehensive error handling with fallbacks
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url)
      const query = url.searchParams.get('q')
      const cacheKey = `pubmed:${query}`

      // Try cache first
      const cached = await env.CACHE_KV.get(cacheKey, 'json')
      if (cached && cached.timestamp > Date.now() - 300000) { // 5 minutes old
        return new Response(JSON.stringify({
          ...cached.data,
          cached: true,
          source: 'cache'
        }), {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache-Status': 'hit'
          }
        })
      }

      // Try external API with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const pubmedResponse = await fetch(
        `https://pubmed.ncbi.nlm.nih.gov/api/search?term=${encodeURIComponent(query)}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'MedResearch-API/1.0'
          }
        }
      ).catch(error => {
        console.error('PubMed API error:', error)
        throw new Error('External service unavailable')
      }).finally(() => {
        clearTimeout(timeoutId)
      })

      if (!pubmedResponse.ok) {
        throw new Error(`API returned ${pubmedResponse.status}`)
      }

      const data = await pubmedResponse.json()

      // Cache successful response
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        source: 'api'
      }

      event.waitUntil(
        env.CACHE_KV.put(cacheKey, JSON.stringify(cacheData), {
          expirationTtl: 300 // 5 minutes
        })
      )

      return new Response(JSON.stringify({
        ...data,
        cached: false,
        source: 'api'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Status': 'miss'
        }
      })

    } catch (error) {
      console.error('Request failed:', error)

      // Try to return cached data even if expired
      try {
        const staleCache = await env.CACHE_KV.get(cacheKey, 'json')
        if (staleCache) {
          return new Response(JSON.stringify({
            ...staleCache.data,
            cached: true,
            source: 'stale-cache',
            warning: 'Showing stale data due to API issues'
          }), {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Status': 'stale'
            }
          })
        }
      } catch (cacheError) {
        console.error('Cache fallback failed:', cacheError)
      }

      // Graceful error response
      return new Response(JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Unable to fetch research data at this time',
        retryAfter: 60,
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      })
    }
  }
}
```

---

### Anti-Pattern 4: "Inefficient Database Queries"
**Severity**: MEDIUM
**Seen in**: Medical research database performance issues

#### What it looks like:
```javascript
// INEFFICIENT: N+1 query problem
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const studyIds = url.searchParams.get('ids').split(',')

    const results = []

    // DON'T: Individual query for each ID
    for (const id of studyIds) {
      const result = await env.DB.prepare(
        'SELECT * FROM studies WHERE id = ?'
      ).bind(id).first()
      results.push(result)
    }

    return new Response(JSON.stringify(results))
  }
}
```

#### Why it's bad:
- **Performance Issues**: 100 IDs = 100 database queries
- **Timeout Problems**: Long-running requests exceed limits
- **Cost Overruns**: Excessive database operations
- **Poor Scalability**: Performance degrades linearly with request size

#### Real-world impact:
```
User requests: 100 study records
Execution time: 2.3 seconds (timeout at 2.5 seconds)
Memory usage: 128MB+ (approaching limits)
Cost: 10x higher than necessary
User experience: "The search is too slow"
```

#### ✅ Correct approach:
```javascript
// EFFICIENT: Batch query with proper indexing
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url)
      const studyIds = url.searchParams.get('ids')

      if (!studyIds || studyIds.split(',').length > 100) {
        return new Response(JSON.stringify({
          error: 'Invalid request',
          message: 'Please provide 1-100 study IDs'
        }), { status: 400 })
      }

      const idArray = studyIds.split(',').filter(id => id.trim())

      // Single query with IN clause
      const placeholders = idArray.map(() => '?').join(',')
      const query = `
        SELECT id, title, authors, abstract, publication_date, journal
        FROM studies
        WHERE id IN (${placeholders})
        ORDER BY publication_date DESC
        LIMIT 100
      `

      const start = Date.now()
      const results = await env.DB.prepare(query)
        .bind(...idArray)
        .all()

      const duration = Date.now() - start

      // Log performance metrics
      console.log(`Query executed in ${duration}ms for ${idArray.length} IDs`)

      return new Response(JSON.stringify({
        results: results.results,
        count: results.results.length,
        queryTime: duration,
        cached: false
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Query-Time': duration.toString()
        }
      })

    } catch (error) {
      console.error('Database query failed:', error)

      return new Response(JSON.stringify({
        error: 'Database query failed',
        message: 'Unable to retrieve study information',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
```

---

### Anti-Pattern 5: "Ignoring Rate Limits"
**Severity**: MEDIUM
**Seen in**: API abuse and temporary blocks

#### What it looks like:
```javascript
// RECKLESS: No rate limiting
export default {
  async fetch(request, env) {
    // DON'T: Process every request without rate limiting
    const data = await expensiveOperation()
    return new Response(JSON.stringify(data))
  }
}
```

#### Why it's bad:
- **API Abuse**: Automated scripts can overwhelm your service
- **Cost Explosion**: Unexpected traffic spikes increase costs
- **Service Degradation**: Legitimate users affected by abuse
- **IP Blocking**: Cloudflare may block your domain

#### Real-world impact:
```
Automated bot: 1000 requests/second for 10 minutes
Total requests: 600,000
Normal traffic: 100 requests/second
Cost increase: 5000%
User impact: "The site is slow" or "The site is down"
Cloudflare action: Automatic rate limiting enabled
```

#### ✅ Correct approach:
```javascript
// RESPONSIBLE: Multi-layer rate limiting
export default {
  async fetch(request, env) {
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')
    const userAgent = request.headers.get('User-Agent')
    const url = new URL(request.url)

    // 1. Global rate limiting (per IP)
    const ipKey = `rate_limit:ip:${clientIP}`
    const ipCount = await env.RATE_LIMIT_KV.get(ipKey, 'json') || { count: 0, resetTime: Date.now() + 60000 }

    if (Date.now() > ipCount.resetTime) {
      ipCount.count = 0
      ipCount.resetTime = Date.now() + 60000
    }

    if (ipCount.count >= 100) { // 100 requests per minute per IP
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many requests from your IP',
        retryAfter: Math.ceil((ipCount.resetTime - Date.now()) / 1000)
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((ipCount.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': ipCount.resetTime.toString()
        }
      })
    }

    // 2. Endpoint-specific rate limiting
    const endpointKey = `rate_limit:endpoint:${url.pathname}`
    const endpointCount = await env.RATE_LIMIT_KV.get(endpointKey, 'json') || { count: 0, resetTime: Date.now() + 60000 }

    const endpointLimits = {
      '/api/search': 1000,    // Higher limit for search
      '/api/upload': 10,      // Very low limit for uploads
      '/api/data': 500,       // Medium limit for data access
      '/api/admin': 5         // Very low limit for admin
    }

    const limit = endpointLimits[url.pathname] || 100

    if (Date.now() > endpointCount.resetTime) {
      endpointCount.count = 0
      endpointCount.resetTime = Date.now() + 60000
    }

    if (endpointCount.count >= limit) {
      return new Response(JSON.stringify({
        error: 'Endpoint rate limit exceeded',
        message: `Too many requests to ${url.pathname}`,
        retryAfter: Math.ceil((endpointCount.resetTime - Date.now()) / 1000)
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((endpointCount.resetTime - Date.now()) / 1000).toString()
        }
      })
    }

    // 3. Bot detection
    const botScore = await detectBot(request, env)
    if (botScore > 0.7) { // 70% confidence it's a bot
      if (botScore > 0.9) {
        return new Response('Access denied', { status: 403 })
      } else {
        // Challenge suspicious bots
        return new Response('Please verify you are human', {
          status: 403,
          headers: { 'CF-Challenge': '1' }
        })
      }
    }

    // Update rate limit counters
    ipCount.count++
    endpointCount.count++

    event.waitUntil(Promise.all([
      env.RATE_LIMIT_KV.put(ipKey, JSON.stringify(ipCount), { expirationTtl: 120 }),
      env.RATE_LIMIT_KV.put(endpointKey, JSON.stringify(endpointCount), { expirationTtl: 120 })
    ]))

    // Process the actual request
    try {
      const data = await expensiveOperation()
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': Math.max(0, 100 - ipCount.count).toString(),
          'X-RateLimit-Reset': ipCount.resetTime.toString()
        }
      })
    } catch (error) {
      console.error('Request processing failed:', error)
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: 'Unable to process request'
      }), { status: 500 })
    }
  }
}

async function detectBot(request, env) {
  const userAgent = request.headers.get('User-Agent') || ''
  const ip = request.headers.get('CF-Connecting-IP') || ''

  // Check against known bot patterns
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /python/i, /curl/i, /wget/i, /java/i
  ]

  let botScore = 0

  // User agent analysis
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      botScore += 0.3
    }
  }

  // Request frequency analysis (simplified)
  const recentKey = `recent:${ip}`
  const recent = await env.RATE_LIMIT_KV.get(recentKey, 'json') || { count: 0 }

  if (recent.count > 50) { // More than 50 requests in last minute
    botScore += 0.4
  }

  // Update recent counter
  event.waitUntil(
    env.RATE_LIMIT_KV.put(recentKey, JSON.stringify({ count: recent.count + 1 }), { expirationTtl: 60 })
  )

  return Math.min(botScore, 1.0)
}
```

---

## 🛠️ Prevention Strategies

### 1. Code Review Checklist
- [ ] **Caching Strategy**: Verify cache TTLs and invalidation logic
- [ ] **Environment Separation**: Ensure prod/staging/dev isolation
- [ ] **Error Handling**: Check for graceful degradation
- [ ] **Rate Limiting**: Validate abuse prevention mechanisms
- [ ] **Database Queries**: Review for N+1 problems and efficiency
- [ ] **Security Headers**: Verify comprehensive protection

### 2. Pre-deployment Testing
```bash
# Performance testing
./scripts/performance-test.sh --endpoint /api/search --requests 1000

# Security testing
./scripts/security-audit.sh --tests waf,ddos,access,ssl

# Load testing with caching validation
./scripts/cache-test.sh --validate-hit-ratio --threshold 0.8

# Environment separation validation
./scripts/env-validation.sh --check-isolation
```

### 3. Monitoring Setup
```yaml
# Critical alerts to configure
alerts:
  cache_hit_ratio_too_low:
    condition: "cache_hit_ratio < 0.7"
    severity: "warning"

  error_rate_too_high:
    condition: "error_rate > 0.05"
    severity: "critical"

  response_time_too_slow:
    condition: "p95_response_time > 500ms"
    severity: "warning"

  rate_limit_blocking:
    condition: "rate_limit_blocks > 100/hour"
    severity: "info"
```

### 4. Recovery Procedures
```bash
# Emergency cache purge
wrangler kv:key delete --namespace-id=your-namespace --key="pattern:*"

# Database rollback
wrangler d1 execute your-db --command="ROLLBACK;"

# Rate limit adjustment
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/zone_id/settings/rate_limit" \
  -H "Authorization: Bearer token" \
  -d '{"threshold": 1000}'
```

---

## 📚 Lessons Learned

### From Medical Research Platform
1. **Always implement environment separation** - The cost of data contamination is too high
2. **Cache intelligently, not aggressively** - Stale medical data is dangerous
3. **Build in fallback mechanisms** - External APIs will fail
4. **Monitor performance continuously** - Users notice degradation quickly
5. **Test under realistic load** - Development performance ≠ production performance

### General Principles
1. **Start conservative, optimize based on data** - Don't assume optimal settings
2. **Automate everything** - Manual processes fail under pressure
3. **Design for failure** - Assume everything can and will break
4. **Measure what matters** - Focus on user-impact metrics
5. **Document decisions** - Future you will thank present you

---

**Remember**: Every anti-pattern here was learned from real production incidents. The cost of preventing these issues is tiny compared to the cost of fixing them in production.