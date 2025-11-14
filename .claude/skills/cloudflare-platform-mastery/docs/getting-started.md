# Getting Started with Cloudflare Platform

> **Complete beginner's guide to setting up and deploying your first application on Cloudflare**

## 🎯 What You'll Learn

In this comprehensive getting started guide, you'll:

- Set up your Cloudflare account and development environment
- Deploy your first static website and serverless function
- Understand the core concepts of Cloudflare's ecosystem
- Configure security and performance optimizations
- Set up monitoring and analytics

## ⏱️ Time Investment: 45 minutes

- Account Setup: 10 minutes
- Environment Configuration: 15 minutes
- First Deployment: 15 minutes
- Monitoring Setup: 5 minutes

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Cloudflare Account**: [Create free account](https://dash.cloudflare.com/sign-up)
- [ ] **Domain Name** (optional for custom domains)
- [ ] **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- [ ] **Git**: Download from [git-scm.com](https://git-scm.com/)
- [ ] **Code Editor**: VS Code, WebStorm, or similar

```bash
# Verify your environment setup
node --version  # Should show 18.0.0+
npm --version   # Should show 8.0.0+
git --version   # Should show git version
```

## 🚀 Step 1: Account Setup (10 minutes)

### 1.1 Create Cloudflare Account

1. Navigate to [cloudflare.com](https://cloudflare.com)
2. Click "Sign Up" and choose the Free plan
3. Complete email verification
4. Enable Two-Factor Authentication (recommended)

### 1.2 Add Your Domain

```bash
# If you have a custom domain:
# 1. Log into your domain registrar
# 2. Update nameservers to Cloudflare's:
#    - dina.ns.cloudflare.com
#    - josh.ns.cloudflare.com
# 3. Wait for DNS propagation (5-10 minutes)
```

### 1.3 Get API Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to "My Profile" → "API Tokens"
3. Create a Custom Token with these permissions:
   - Zone: Zone:Read, Zone:Edit
   - Account: Account:Read
   - User: User:Read
   - Zone Resources: Include All zones

Save your API token securely - you'll need it for automation.

## 🔧 Step 2: Development Environment Setup (15 minutes)

### 2.1 Install Wrangler CLI

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

### 2.2 Set Up Environment Variables

Create `.env.local` in your project root:

```bash
# Cloudflare API credentials
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Project settings
CLOUDFLARE_ZONE_ID=your_zone_id_here  # For custom domains
```

### 2.3 Initialize Your First Project

```bash
# Create a new project directory
mkdir my-cloudflare-app
cd my-cloudflare-app

# Initialize with a template
npx wrangler init my-app --template https://github.com/cloudflare/templates/tree/main/worker

# Or for a static site
npm create vite@latest my-static-app -- --template react
cd my-static-app
```

## 🌐 Step 3: Deploy Your First Application (15 minutes)

### 3.1 Deploy a Static Site with Pages

```bash
# Navigate to your static site project
cd my-static-app

# Build your application
npm run build

# Initialize Pages
wrangler pages project create my-static-app

# Deploy to Pages
wrangler pages deploy dist --project-name my-static-app
```

**Expected Output:**
```
🚀 Uploading... (1/1)
✨ Success! Uploaded 12 files (100%)
🔗 Published at: https://my-static-app.pages.dev
```

### 3.2 Deploy a Serverless Worker

```bash
# Navigate to your worker project
cd my-worker-app

# Configure wrangler.toml
cat > wrangler.toml << EOF
name = "my-worker-app"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "my-worker-app-prod"
routes = [
  { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
]
EOF

# Create a simple worker
cat > src/index.js << EOF
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({
        message: 'Hello from Cloudflare Worker!',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Worker is running!', { status: 200 });
  },
};
EOF

# Deploy your worker
wrangler deploy
```

**Expected Output:**
```
🚀 Deploying...
✨ Success! Published at: https://my-worker-app.your-subdomain.workers.dev
```

### 3.3 Test Your Deployments

```bash
# Test your static site
curl https://my-static-app.pages.dev

# Test your worker
curl https://my-worker-app.your-subdomain.workers.dev/api/hello

# Expected worker response:
# {"message":"Hello from Cloudflare Worker!","timestamp":"2024-01-15T10:30:00.000Z"}
```

## 🛡️ Step 4: Security Configuration (5 minutes)

### 4.1 Enable SSL/TLS

1. Go to Cloudflare Dashboard
2. Navigate to "SSL/TLS" → "Overview"
3. Select "Full (Strict)" mode
4. Enable "Automatic HTTPS Rewrites"

### 4.2 Configure Basic Security Rules

```bash
# Enable Bot Fight Mode (Free)
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"bot_management":{"fight_mode":true}}'

# Set security level to medium
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/security_level" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":"medium"}'
```

### 4.3 Enable Basic Caching

```bash
# Set browser cache TTL
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/browser_cache_ttl" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":86400}'
```

## 📊 Step 5: Monitoring Setup (5 minutes)

### 5.1 Enable Analytics

1. Navigate to "Analytics & Logs" → "Analytics"
2. Enable "Web Analytics"
3. Set up "Real User Monitoring (RUM)"

### 5.2 Set Up Uptime Monitoring

```bash
# Create an uptime monitor
curl -X POST "https://api.cloudflare.com/client/v4/accounts/your_account_id/uptime_monitors" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "My Site Monitor",
    "targets": ["https://my-static-app.pages.dev"],
    "frequency": 60,
    "type": "http"
  }'
```

### 5.3 Configure Logging

```javascript
// Add logging to your worker
export default {
  async fetch(request, env, ctx) {
    const start = Date.now();
    const url = new URL(request.url);

    try {
      // Your application logic here
      const response = await handleRequest(request);

      // Log successful requests
      console.log(`Request processed: ${request.method} ${url.pathname} - ${response.status}`);

      return response;
    } catch (error) {
      // Log errors
      console.error(`Request failed: ${request.method} ${url.pathname} - ${error.message}`);

      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
```

## 🎯 Validation Checklist

Ensure your setup is complete:

- [ ] **Account**: Cloudflare account created and authenticated
- [ ] **Environment**: Wrangler CLI installed and authenticated
- [ ] **Static Site**: Successfully deployed to Pages
- [ ] **Worker**: Deployed and responding to requests
- [ ] **Security**: SSL/TLS enabled, basic security rules configured
- [ ] **Monitoring**: Analytics and uptime monitoring active

## 🔄 Common First-Time Issues & Solutions

### Issue: DNS Propagation Delays

```bash
# Check DNS status
dig your-domain.com

# If not pointing to Cloudflare yet:
# 1. Wait 10-15 minutes for propagation
# 2. Verify nameservers at your registrar
# 3. Clear local DNS cache: sudo dscacheutil -flushcache
```

### Issue: Worker Deployment Fails

```bash
# Check wrangler.toml configuration
wrangler tail  # View real-time logs

# Common fixes:
# - Ensure compatibility_date is current
# - Check for syntax errors in worker code
# - Verify API token has proper permissions
```

### Issue: Pages Build Fails

```bash
# Check build configuration
# Ensure build script works locally:
npm run build

# Check output directory exists
ls -la dist/  # or build/, .next/, etc.
```

## 🚀 What's Next?

Congratulations! You've successfully deployed your first applications on Cloudflare. Here's what to explore next:

1. **Performance Optimization**: [Performance Learning Path](../paths/performance-path.md)
2. **Advanced Security**: [Security Learning Path](../paths/security-path.md)
3. **Serverless Development**: [Developer Learning Path](../paths/developer-path.md)
4. **Enterprise Features**: [Enterprise Learning Path](../paths/enterprise-path.md)

## 📚 Additional Resources

- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Wrangler CLI Guide](https://developers.cloudflare.com/workers/wrangler/)
- [Community Forum](https://community.cloudflare.com/)
- [YouTube Tutorials](https://www.youtube.com/c/Cloudflare)

---

**Ready for more?** Continue to the [Best Practices Guide](best-practices.md) to learn professional deployment patterns and optimization techniques.