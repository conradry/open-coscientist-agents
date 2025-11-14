# Foundation Learning Path - Hands-On Exercise

## 🎯 Learning Objectives
- [ ] Set up Cloudflare account and authenticate
- [ ] Configure domain with Cloudflare DNS
- [ ] Implement SSL certificates
- [ ] Activate basic CDN configuration
- [ ] Deploy your first Worker
- [ ] Measure performance improvements

## 📋 Prerequisites Check
- [ ] **Cloudflare Account**: Created and email verified
  - *How to verify*: Login to dashboard.cloudflare.com
- [ ] **Domain Name**: Available for configuration
  - *How to verify*: You have access to DNS settings
- [ ] **Node.js 18+**: Installed locally
  - *How to verify*: Run `node --version` (should be 18+)
- [ ] **Wrangler CLI**: Installed globally
  - *How to verify*: Run `wrangler --version`
  - *If missing*: Run `npm install -g wrangler`

## 🚀 Quick Win (5 minutes) - Account Setup

### Step 1: Authenticate with Cloudflare
```bash
# Login to Cloudflare
wrangler auth login

# Verify authentication
wrangler whoami

# Expected output:
# You are logged in as your-email@example.com
```

### Step 2: Create your first Worker
```bash
# Create a new Worker project
mkdir foundation-worker && cd foundation-worker
wrangler init foundation-worker

# Choose "Hello World" template when prompted
# This creates a basic Worker you can customize

# Test locally
wrangler dev

# Expected output:
# Listening on http://localhost:8787
# Open in browser to see "Hello World!"
```

## 📖 Core Concepts (15 minutes)

### Cloudflare Architecture Overview
```
User → Cloudflare Edge → Origin Server
  ↓         ↓              ↓
DNS     CDN + Security    Your Application

Benefits:
- Global performance: 200+ edge locations
- DDoS protection: 15 Tbps+ network capacity
- SSL/TLS: Free certificates for all domains
- Analytics: Real-time traffic insights
```

### Key Components Explained
1. **DNS Management**: Translates domain names to IP addresses
2. **CDN (Content Delivery Network)**: Caches content globally
3. **SSL/TLS**: Encrypts traffic between users and your site
4. **Workers**: Serverless functions at the edge
5. **Firewall Rules**: Protects against threats

## 💻 Hands-on Practice (20 minutes)

### Exercise 1: Domain Configuration

#### Step 1: Add Domain to Cloudflare
```bash
# If you have a domain, add it via dashboard:
# 1. Go to dashboard.cloudflare.com
# 2. Click "Add a site"
# 3. Enter your domain name
# 4. Choose free plan
# 5. Update nameservers as instructed
```

#### Step 2: DNS Configuration
```bash
# Test DNS propagation
dig yourdomain.com

# Expected output should show Cloudflare nameservers:
# ;; ANSWER SECTION:
# yourdomain.com.     300 IN A  192.168.1.1
```

### Exercise 2: SSL Certificate Setup

#### Step 1: SSL Mode Configuration
```bash
# Via dashboard or API, set SSL to "Flexible" for testing
# In production, use "Full (strict)"

# Test SSL configuration
curl -I https://yourdomain.com

# Expected headers:
# HTTP/2 200
# server: cloudflare
# ...
```

#### Step 2: Certificate Validation
```bash
# Check certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Look for:
# - Subject Alternative Name includes your domain
# - Issuer: Let's Encrypt or Cloudflare
```

### Exercise 3: CDN Configuration

#### Step 1: Basic Caching Rules
```bash
# Set cache level to "Standard" for testing
# Configure TTL settings:
# - Browser Cache TTL: 4 hours
# - Edge Cache TTL: 1 day

# Test caching behavior
curl -I https://yourdomain.com/static/style.css

# Look for cache headers:
# cf-cache-status: HIT/MISS
# cache-control: public, max-age=14400
```

#### Step 2: Performance Testing
```bash
# Test from multiple locations
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com

# curl-format.txt content:
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                      ----------\n
#           time_total:  %{time_total}\n
```

### Exercise 4: Worker Deployment

#### Step 1: Customize Foundation Worker
```javascript
// Edit src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response('Hello from Cloudflare Workers!', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (url.pathname === '/api/time') {
      return new Response(JSON.stringify({
        time: new Date().toISOString(),
        location: 'Cloudflare Edge'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
```

#### Step 2: Deploy Worker
```bash
# Deploy to Cloudflare
wrangler deploy

# Test deployed worker
curl https://foundation-worker.your-subdomain.workers.dev

# Expected output:
# Hello from Cloudflare Workers!

# Test API endpoint
curl https://foundation-worker.your-subdomain.workers.dev/api/time

# Expected output:
# {"time":"2024-01-01T12:00:00.000Z","location":"Cloudflare Edge"}
```

## 🔧 Real-world Application (10 minutes)

### Create Your Personal Dashboard
```javascript
// Enhanced Worker with dashboard functionality
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dashboard home
    if (path === '/') {
      return new Response(getDashboardHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // API endpoints
    if (path.startsWith('/api/')) {
      return handleAPI(request, url);
    }

    return new Response('Not found', { status: 404 });
  }
};

function getDashboardHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cloudflare Learning Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .metric { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 5px; }
            .success { background: #d4edda; }
        </style>
    </head>
    <body>
        <h1>🚀 Cloudflare Learning Dashboard</h1>
        <div class="metric success">
            <h3>Status</h3>
            <p>✅ Workers deployed successfully</p>
            <p>✅ CDN active and caching</p>
            <p>✅ SSL certificates valid</p>
        </div>
        <div class="metric">
            <h3>Quick Actions</h3>
            <button onclick="checkTime()">Check Current Time</button>
            <button onclick="testAPI()">Test API</button>
        </div>
        <div id="results"></div>
        <script>
            async function checkTime() {
                const response = await fetch('/api/time');
                const data = await response.json();
                document.getElementById('results').innerHTML =
                    '<h3>Time Response:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            }
            async function testAPI() {
                document.getElementById('results').innerHTML =
                    '<h3>API Status:</h3><p>✅ All endpoints responding</p>';
            }
        </script>
    </body>
    </html>
  `;
}

async function handleAPI(request, url) {
  if (url.pathname === '/api/time') {
    return new Response(JSON.stringify({
      time: new Date().toISOString(),
      edge_location: request.cf?.colo || 'Unknown'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (url.pathname === '/api/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      uptime: Date.now() - (globalThis.startTime || Date.now()),
      version: '1.0.0'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('API endpoint not found', { status: 404 });
}
```

## ✅ Knowledge Check (5 minutes)

### Question 1: SSL/TLS Modes
**What's the difference between "Flexible" and "Full" SSL modes?**
- **Flexible**: encrypts user-to-Cloudflare connection
- **Full**: encrypts end-to-end from user to origin
- **Full (strict)**: Full + validates origin SSL certificate

### Question 2: Cache Control
**How does Cloudflare's edge caching work?**
1. User requests content
2. Cloudflare checks if content is in edge cache
3. If cache hit: serve from edge (fast!)
4. If cache miss: fetch from origin, cache for future requests

### Question 3: Worker Benefits
**What are the main advantages of Cloudflare Workers?**
- **Global deployment**: Runs in 200+ edge locations
- **Zero maintenance**: No servers to manage
- **Auto-scaling**: Handles traffic spikes automatically
- **Cost-effective**: Pay only for what you use

### Practical Exercise
```bash
# Test your understanding:
# 1. Deploy a Worker that returns your name and current time
# 2. Configure a page rule to cache /api/* for 5 minutes
# 3. Verify SSL is working on your domain
# 4. Measure the performance difference with and without CDN
```

## 📚 Next Steps

### Continue Learning
1. **Security Path**: Implement WAF rules and DDoS protection
2. **Performance Path**: Advanced caching and optimization
3. **Developer Path**: Build serverless applications
4. **Enterprise Path**: Multi-account management

### Practice Projects
- Personal blog with Cloudflare Pages
- API with Workers and D1 database
- E-commerce site with image optimization
- SaaS application with Workers KV

### Resources
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Learning Center](https://www.cloudflare.com/learning/)
- [Community Forums](https://community.cloudflare.com/)

---

**Success Validation**: You should now have:
- ✅ Working Cloudflare Workers deployment
- ✅ Domain with SSL and CDN active
- ✅ Measurable performance improvement (20%+)
- ✅ Basic understanding of Cloudflare architecture
- ✅ Hands-on experience with edge computing

**Expected Performance Gains**:
- **First Contentful Paint**: 30-50% faster
- **Time to Interactive**: 20-40% faster
- **Bandwidth Usage**: 15-25% reduction
- **Server Load**: 50-80% reduction

Congratulations! You've completed the Foundation path and are ready for advanced Cloudflare features.