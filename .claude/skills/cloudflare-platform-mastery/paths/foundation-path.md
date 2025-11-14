# Foundation Learning Path

> **2-hour comprehensive introduction to Cloudflare Platform fundamentals**

## 🎯 Learning Objectives

By the end of this 2-hour learning path, you will:

- ✅ Understand Cloudflare's global network architecture
- ✅ Deploy your first static website and serverless function
- ✅ Configure DNS, SSL, and basic security settings
- ✅ Implement caching strategies for optimal performance
- ✅ Set up monitoring and analytics
- ✅ Troubleshoot common deployment issues

## ⏱️ Time Breakdown

| Module | Duration | Topics |
|--------|----------|--------|
| **Module 1: Platform Overview** | 15 min | Architecture, benefits, account setup |
| **Module 2: Static Site Deployment** | 25 min | Pages, DNS, SSL, domain setup |
| **Module 3: Serverless Workers** | 30 min | Workers, KV storage, D1 database |
| **Module 4: Security & Performance** | 25 min | WAF, caching, optimization |
| **Module 5: Monitoring & Troubleshooting** | 25 min | Analytics, logging, debugging |

## 📚 Prerequisites

- Basic understanding of web development (HTML, CSS, JavaScript)
- Command line experience
- Node.js 18+ installed
- A domain name (optional but recommended)

---

## 🏗️ Module 1: Platform Overview (15 minutes)

### 1.1 Cloudflare Architecture

**Learning Goal**: Understand how Cloudflare's global network works.

**Key Concepts:**
- **Global Network**: 310+ cities in 120+ countries
- **Edge Computing**: Process data closer to users
- **Anycast Network**: Route traffic to nearest data center
- **Integrated Security**: Built-in DDoS protection and WAF

**Interactive Exercise**:
```bash
# Test Cloudflare's global network performance
# Visit: https://www.cloudflare.com/network/
# Explore the interactive map to see data center locations

# Check latency to nearest Cloudflare edge
ping -c 5 1.1.1.1
```

### 1.2 Account Setup and Authentication

**Hands-on Activity**:

1. **Create Cloudflare Account**
```bash
# Visit: https://dash.cloudflare.com/sign-up
# Choose Free plan
# Enable Two-Factor Authentication
```

2. **Install Wrangler CLI**
```bash
# Install Wrangler globally
npm install -g wrangler

# Verify installation
wrangler --version

# Authenticate with Cloudflare
wrangler auth login

# Test authentication
wrangler whoami
```

3. **Set Up Project Directory**
```bash
# Create learning project
mkdir cloudflare-foundation
cd cloudflare-foundation

# Initialize git repository
git init
echo "node_modules/" > .gitignore
echo ".wrangler/" >> .gitignore
echo "dist/" >> .gitignore
```

**✅ Module 1 Completion Check:**
- [ ] Cloudflare account created and authenticated
- [ ] Wrangler CLI installed and working
- [ ] Project directory initialized

---

## 🌐 Module 2: Static Site Deployment (25 minutes)

### 2.1 First Static Site with Pages

**Learning Goal**: Deploy a static website using Cloudflare Pages.

**Create Your First Site:**

1. **Set Up Basic HTML Site**
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Cloudflare Site</title>
    <style>
        body { font-family: system-ui; margin: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { background: #e8f5e8; padding: 1rem; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to Cloudflare!</h1>
        <div class="status">
            <p>This site is served from Cloudflare's global network.</p>
            <p>Request time: <span id="load-time"></span></p>
        </div>
    </div>
    <script>
        document.getElementById('load-time').textContent = new Date().toLocaleTimeString();
    </script>
</body>
</html>
```

2. **Deploy to Pages**
```bash
# Create Pages project
wrangler pages project create my-first-site

# Deploy the site
wrangler pages deploy . --project-name my-first-site

# Expected output:
# 🚀 Uploading... (1/1)
# ✨ Success! Published at: https://my-first-site.pages.dev
```

### 2.2 Domain Configuration

**Learning Goal**: Connect a custom domain to your Pages site.

**DNS Setup:**

1. **Add Custom Domain**
```bash
# Add domain to Pages project (if you have a custom domain)
wrangler pages project create my-first-site --domain your-domain.com

# Or add via dashboard:
# 1. Go to Pages → your project → Custom domains
# 2. Add your domain name
# 3. Update nameservers at your registrar
```

2. **DNS Configuration**
```bash
# Check DNS propagation
dig your-domain.com

# Verify SSL certificate
curl -I https://your-domain.com
```

### 2.3 SSL and Security Setup

**Learning Goal**: Configure SSL and basic security settings.

**SSL Configuration:**
```bash
# SSL is automatically configured, but verify:
# 1. Go to SSL/TLS → Overview in dashboard
# 2. Set mode to "Full (Strict)"
# 3. Enable "Always Use HTTPS"
```

**Basic Security:**
```bash
# Set security level via API
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/security_level" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":"medium"}'
```

**✅ Module 2 Completion Check:**
- [ ] Static site deployed to Pages
- [ ] Custom domain configured (if available)
- [ ] SSL/TLS enabled and verified
- [ ] Basic security settings configured

---

## ⚡ Module 3: Serverless Workers (30 minutes)

### 3.1 First Worker Function

**Learning Goal**: Create and deploy your first Cloudflare Worker.

**Create a Simple Worker:**

1. **Initialize Worker Project**
```bash
# Go back to project root
cd ..

# Create worker directory
mkdir my-first-worker
cd my-first-worker

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "my-first-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "my-first-worker-prod"
EOF

# Create source directory
mkdir src
```

2. **Create Worker Code**
```javascript
// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route handling
    if (path === '/') {
      return new Response(getHomePage(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (path === '/api/hello') {
      return new Response(JSON.stringify({
        message: 'Hello from Cloudflare Worker!',
        timestamp: new Date().toISOString(),
        method: request.method
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/time') {
      return new Response(JSON.stringify({
        unix: Date.now(),
        iso: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

function getHomePage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>My Worker</title></head>
    <body>
      <h1>🤖 Cloudflare Worker</h1>
      <ul>
        <li><a href="/api/hello">Hello API</a></li>
        <li><a href="/api/time">Current Time</a></li>
      </ul>
    </body>
    </html>
  `;
}
```

3. **Deploy Worker**
```bash
# Deploy worker
wrangler deploy

# Expected output:
# 🚀 Deploying...
# ✨ Success! Published at: https://my-first-worker.your-subdomain.workers.dev
```

4. **Test Your Worker**
```bash
# Test different endpoints
curl https://my-first-worker.your-subdomain.workers.dev
curl https://my-first-worker.your-subdomain.workers.dev/api/hello
curl https://my-first-worker.your-subdomain.workers.dev/api/time
```

### 3.2 Working with KV Storage

**Learning Goal**: Store and retrieve data using Cloudflare KV.

**KV Storage Exercise:**

1. **Create KV Namespace**
```bash
# Create KV namespace
wrangler kv:namespace create "MY_CACHE"

# Note the ID for your wrangler.toml
# Create preview namespace
wrangler kv:namespace create "MY_CACHE" --preview

# Update wrangler.toml with both IDs
```

2. **Update wrangler.toml**
```toml
name = "my-first-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "MY_CACHE"
id = "your-production-kv-id"
preview_id = "your-preview-kv-id"
```

3. **Add KV Functionality**
```javascript
// Add to your src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/hello') {
      // Try to get from cache first
      const cacheKey = 'hello_response';
      let response = await env.MY_CACHE.get(cacheKey);

      if (!response) {
        // Generate new response
        const data = {
          message: 'Hello from Cloudflare Worker!',
          timestamp: new Date().toISOString(),
          cached: false
        };

        response = JSON.stringify(data);

        // Cache for 60 seconds
        ctx.waitUntil(env.MY_CACHE.put(cacheKey, response, { expirationTtl: 60 }));
      } else {
        // Parse cached response
        const data = JSON.parse(response);
        data.cached = true;
        response = JSON.stringify(data);
      }

      return new Response(response, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/counter') {
      const key = 'visit_counter';
      let count = await env.MY_CACHE.get(key) || '0';
      count = (parseInt(count) + 1).toString();

      ctx.waitUntil(env.MY_CACHE.put(key, count));

      return new Response(JSON.stringify({
        visits: count,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ... rest of your routes
  }
};
```

4. **Deploy and Test**
```bash
# Deploy updated worker
wrangler deploy

# Test KV functionality
curl https://my-first-worker.your-subdomain.workers.dev/api/hello
curl https://my-first-worker.your-subdomain.workers.dev/api/counter
```

### 3.3 Introduction to D1 Database

**Learning Goal**: Understand basic D1 database operations.

**D1 Setup:**

1. **Create D1 Database**
```bash
# Create D1 database
wrangler d1 create my_first_db

# Note the database ID for wrangler.toml
```

2. **Update wrangler.toml**
```toml
[[d1_databases]]
binding = "DB"
database_name = "my_first_db"
database_id = "your-database-id"
```

3. **Create Database Schema**
```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT,
  user_agent TEXT,
  visit_time INTEGER,
  path TEXT
);

CREATE TABLE IF NOT EXISTS counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  count INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0);
```

4. **Apply Migrations**
```bash
# Create migrations
wrangler d1 migrations create initial_schema --compatibility-date=2024-01-01

# Apply migrations
wrangler d1 migrations apply my_first_db --remote
```

5. **Add Database Functions**
```javascript
// Add database functionality to your worker
async function logVisit(env, request) {
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const path = url.pathname;

  // Log the visit
  await env.DB.prepare(`
    INSERT INTO visitors (ip_address, user_agent, visit_time, path)
    VALUES (?, ?, ?, ?)
  `).bind(ip, userAgent, Date.now(), path).run();

  // Update counter
  await env.DB.prepare(`
    UPDATE counter SET count = count + 1 WHERE id = 1
  `).run();

  // Get current count
  const result = await env.DB.prepare(`
    SELECT count FROM counter WHERE id = 1
  `).first();

  return result.count;
}

// Add route for visitor statistics
if (path === '/api/stats') {
  const visitCount = await logVisit(env, request);
  const recentVisitors = await env.DB.prepare(`
    SELECT * FROM visitors ORDER BY visit_time DESC LIMIT 5
  `).all();

  return new Response(JSON.stringify({
    totalVisits: visitCount,
    recentVisitors: recentVisitors.results,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**✅ Module 3 Completion Check:**
- [ ] First Worker deployed and functional
- [ ] KV storage implemented with caching
- [ ] D1 database created and basic queries working
- [ ] API endpoints responding correctly

---

## 🛡️ Module 4: Security & Performance (25 minutes)

### 4.1 Web Application Firewall (WAF)

**Learning Goal**: Configure basic WAF rules for security.

**WAF Configuration:**

1. **Set Up Basic WAF Rules**
```bash
# Create rate limiting rule
curl -X POST "https://api.cloudflare.com/client/v4/zones/your_zone_id/firewall/rules" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Rate limit API endpoints",
    "action": "rate_limit",
    "filter": {
      "expression": "(http.request.uri.path contains \"/api/\")"
    },
    "ratelimit": {
      "characteristics": ["ip.src"],
      "period": 60,
      "requests_per_period": 100,
      "mitigation_timeout": 600
    }
  }'
```

2. **Add Bot Protection**
```bash
# Enable Bot Fight Mode (Free tier)
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"bot_management":{"fight_mode":true}}'
```

### 4.2 Caching Strategies

**Learning Goal**: Implement effective caching for performance.

**Advanced Caching Worker:**

```javascript
// Create a new worker for caching demo
// caching-worker/src/index.js
export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const url = new URL(request.url);

    // Check cache first
    let response = await cache.match(request);
    if (response) {
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Get response from origin
    response = await fetch(request);

    // Only cache successful GET requests
    if (request.method === 'GET' && response.ok) {
      // Determine cache TTL based on content
      let ttl = 3600; // Default 1 hour

      if (url.pathname.includes('/api/')) {
        ttl = 60; // API: 1 minute
      } else if (url.pathname.includes('/static/')) {
        ttl = 86400; // Static: 1 day
      }

      // Clone response to cache
      response.headers.set('Cache-Control', `public, max-age=${ttl}`);
      response.headers.set('X-Cache', 'MISS');

      const responseToCache = response.clone();
      ctx.waitUntil(cache.put(request, responseToCache));
    }

    return response;
  }
};
```

### 4.3 Performance Optimization

**Learning Goal**: Optimize your applications for global performance.

**Image Optimization Example:**

```javascript
// Add image optimization to your worker
if (url.pathname.startsWith('/images/')) {
  const imageUrl = url.searchParams.get('url');
  const width = parseInt(url.searchParams.get('w')) || 800;
  const height = parseInt(url.searchParams.get('h')) || 600;
  const quality = parseInt(url.searchParams.get('q')) || 80;

  if (imageUrl) {
    const imageRequest = new Request(imageUrl, {
      cf: {
        image: {
          width, height, quality,
          format: 'auto', // Automatically choose best format
          fit: 'cover'
        }
      }
    });

    const imageResponse = await fetch(imageRequest);

    // Cache optimized images
    imageResponse.headers.set('Cache-Control', 'public, max-age=31536000');
    return imageResponse;
  }
}
```

**✅ Module 4 Completion Check:**
- [ ] WAF rules configured and active
- [ ] Bot protection enabled
- [ ] Advanced caching implemented
- [ ] Image optimization working (if applicable)

---

## 📊 Module 5: Monitoring & Troubleshooting (25 minutes)

### 5.1 Analytics and Monitoring

**Learning Goal**: Set up comprehensive monitoring for your applications.

**Enable Analytics:**

1. **Enable Web Analytics**
```bash
# Via Dashboard:
# 1. Go to Analytics & Logs → Web Analytics
# 2. Enable "Web Analytics"
# 3. Set up "Real User Monitoring (RUM)"
```

2. **Create Custom Analytics Worker**
```javascript
// analytics-worker/src/index.js
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      // Process request
      const response = await handleRequest(request, env);
      const duration = Date.now() - startTime;

      // Log performance metrics
      ctx.waitUntil(logAnalytics(env, {
        url: url.pathname,
        method: request.method,
        status: response.status,
        duration,
        timestamp: Date.now(),
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP')
      }));

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      ctx.waitUntil(logAnalytics(env, {
        url: url.pathname,
        method: request.method,
        status: 500,
        duration,
        timestamp: Date.now(),
        error: error.message,
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP')
      }));

      throw error;
    }
  }
};

async function logAnalytics(env, data) {
  const key = `analytics:${data.timestamp}:${Math.random()}`;
  await env.ANALYTICS_KV.put(key, JSON.stringify(data), {
    expirationTtl: 7 * 24 * 60 * 60 // Keep for 7 days
  });
}
```

### 5.2 Logging and Debugging

**Learning Goal**: Implement effective logging and debugging strategies.

**Advanced Logging Worker:**

```javascript
// Add comprehensive logging to your worker
export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Log request start
    console.log(`[${requestId}] Request started: ${request.method} ${request.url}`);

    try {
      const response = await handleRequest(request, env);
      const duration = Date.now() - startTime;

      // Log success
      console.log(`[${requestId}] Request completed: ${response.status} (${duration}ms)`);

      // Add response headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Response-Time', `${duration}ms`);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error with full context
      console.error(`[${requestId}] Request failed: ${error.message}`, {
        stack: error.stack,
        duration,
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      });

      // Return error response
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        requestId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });
    }
  }
};
```

### 5.3 Troubleshooting Common Issues

**Learning Goal**: Learn to diagnose and fix common Cloudflare issues.

**Troubleshooting Tools:**

```bash
# Real-time log monitoring
wrangler tail --format=pretty

# Test with different headers
curl -H "User-Agent: TestBot/1.0" https://your-worker.workers.dev

# Check DNS resolution
dig your-domain.com
dig @8.8.8.8 your-domain.com
dig @1.1.1.1 your-domain.com

# Test SSL certificate
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

**Common Issues and Solutions:**

1. **Worker Timeouts**
```javascript
// Use streaming for long operations
export default {
  async fetch(request) {
    const { readable, writable } = new TransformStream();

    // Process in background
    const writer = writable.getWriter();
    processLargeData(writer).catch(console.error);

    return new Response(readable);
  }
};
```

2. **Memory Issues**
```javascript
// Process data in chunks
async function processLargeData() {
  const data = await fetchLargeDataset();
  for (const chunk of data) {
    await processChunk(chunk);
    // Process small chunks to avoid memory issues
  }
}
```

**✅ Module 5 Completion Check:**
- [ ] Analytics enabled and tracking data
- [ ] Comprehensive logging implemented
- [ ] Debugging tools configured
- [ ] Common issues understood and resolved

---

## 🎯 Final Assessment

### Comprehensive Exercise

Create a complete application that demonstrates all learned concepts:

1. **Static Site**: Landing page with Cloudflare Pages
2. **API Backend**: Worker with KV caching and D1 database
3. **Security**: WAF rules and rate limiting
4. **Performance**: Caching and optimization
5. **Monitoring**: Analytics and logging

**Deployment Checklist:**

```bash
# Final deployment script
#!/bin/bash

echo "🚀 Deploying Foundation Project"

# 1. Deploy static site
echo "Deploying static site..."
cd my-static-site
wrangler pages deploy . --project-name foundation-site

# 2. Deploy API worker
echo "Deploying API worker..."
cd ../my-worker
wrangler deploy --env production

# 3. Test deployment
echo "Testing deployment..."
curl -I https://foundation-site.pages.dev
curl https://my-worker.your-subdomain.workers.dev/api/health

echo "✅ Foundation project deployed successfully!"
```

### Knowledge Validation

Answer these questions to validate your understanding:

1. **Architecture**: How does Cloudflare's edge network improve performance?
2. **Security**: What are the three layers of security in Cloudflare?
3. **Caching**: When would you use browser cache vs edge cache?
4. **Database**: What's the difference between KV and D1?
5. **Monitoring**: What metrics should you track for production apps?

---

## 🚀 Next Steps

Congratulations! You've completed the Foundation Learning Path. You now have:

✅ **Deployed** static sites and serverless functions
✅ **Configured** DNS, SSL, and security settings
✅ **Implemented** caching and performance optimizations
✅ **Set up** monitoring and analytics
✅ **Troubleshot** common deployment issues

### Continue Your Journey:

1. **Security Path** → Master advanced security features and compliance
2. **Performance Path** → Optimize for global scale and speed
3. **Developer Path** → Advanced Workers and serverless development
4. **Enterprise Path** → Multi-account management and enterprise features

### Quick References:

- **Emergency Commands**: [Emergency Commands](../quick-reference/emergency-commands.md)
- **Performance Tuning**: [Performance Tuning](../quick-reference/performance-tuning.md)
- **CLI Cheatsheet**: [CLI Reference](../reference/cli-cheatsheet.md)

---

**🎓 Foundation Complete!** You're ready to specialize in your area of interest or continue with comprehensive platform mastery.