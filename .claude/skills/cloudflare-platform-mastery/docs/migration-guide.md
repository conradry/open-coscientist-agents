# Cloudflare Platform Migration Guide

> **Complete migration guide from AWS, Vercel, Netlify, Heroku, and other platforms to Cloudflare**

## 🎯 Overview

This guide provides comprehensive migration strategies for moving applications from various platforms to Cloudflare's global infrastructure. Each migration path includes cost analysis, performance comparisons, and step-by-step procedures.

## 📊 Migration Benefits Comparison

| Feature | AWS | Vercel | Netlify | Heroku | Cloudflare |
|---------|-----|--------|---------|--------|------------|
| **Global CDN** | CloudFront | Built-in | Built-in | ❌ | ✅ Built-in |
| **Serverless** | Lambda | ✅ | Functions | Dynos | ✅ Workers |
| **Database** | RDS/Dynamo | ✅ | ❌ | Postgres | ✅ D1 |
| **Cost** | High | Medium | Medium | High | ✅ Low |
| **Performance** | Good | Excellent | Good | Limited | ✅ Excellent |
| **Security** | Complex | Good | Good | Basic | ✅ Enterprise |
| **Edge Computing** | Limited | ✅ | Limited | ❌ | ✅ Native |

## 🚀 Quick Start Migration

### Migration Assessment Tool

```bash
# Create migration assessment script
cat > assess-migration.sh << 'EOF'
#!/bin/bash

echo "🔍 Cloudflare Migration Assessment"
echo "================================="

# Check current stack
echo "1. Current Framework:"
if [ -f "package.json" ]; then
  echo "   Framework: $(grep -o '"[^"]*"' package.json | head -2 | tail -1)"
  echo "   Build Script: $(npm run build --dry-run 2>/dev/null || echo 'Not found')"
fi

echo -e "\n2. Database Dependencies:"
grep -r "database\|db\|sql\|postgres\|mysql" . --include="*.js" --include="*.ts" --include="*.json" | head -5 || echo "   No database dependencies found"

echo -e "\n3. External APIs:"
grep -r "fetch\|axios\|http" . --include="*.js" --include="*.ts" | head -3 || echo "   No external API calls found"

echo -e "\n4. Static Assets:"
find . -name "dist\|build\|public" -type d | head -3

echo -e "\n5. Environment Variables:"
grep -r "process\.env\|import\.meta\.env" . --include="*.js" --include="*.ts" | head -3 || echo "   No environment variables found"

echo -e "\n✅ Assessment complete"
EOF

chmod +x assess-migration.sh
./assess-migration.sh
```

## 🔄 Platform-Specific Migrations

### 1. AWS to Cloudflare Migration

#### Migration Benefits
- **70-90% Cost Reduction**: From $500/month to $50/month
- **2-3x Performance Improvement**: Global edge vs regional
- **Simplified Architecture**: Single platform vs multiple services

#### Migration Checklist

```bash
# AWS services mapping to Cloudflare:
AWS S3          → Cloudflare R2/Workers KV
AWS Lambda      → Cloudflare Workers
AWS CloudFront  → Cloudflare CDN (built-in)
AWS API Gateway → Workers + Custom Domains
AWS DynamoDB    → D1 Database
AWS RDS         → D1 Database
AWS Route53     → Cloudflare DNS
AWS Certificate Manager → Cloudflare SSL
```

#### Step-by-Step Migration

**1. Backup AWS Resources**
```bash
# Export S3 data
aws s3 sync s3://your-bucket ./backup-s3/

# Export Lambda functions
aws lambda list-functions --query 'Functions[].FunctionName' | xargs -I {} aws lambda get-function --function-name {} --query 'Code.Location' --output text

# Export DynamoDB data
aws dynamodb scan --table-name your-table > backup-dynamodb.json
```

**2. Migrate Static Assets**
```javascript
// Cloudflare Workers migration script
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve static assets from R2
    if (url.pathname.startsWith('/static/')) {
      const r2Url = new URL(url.pathname, `https://your-bucket.r2.cloudflarestorage.com`);
      return fetch(r2Url);
    }

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    return handleStatic(request);
  }
};
```

**3. Lambda Function Migration**
```javascript
// AWS Lambda handler
exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Hello from Lambda!' }),
  };
  return response;
};

// Cloudflare Worker equivalent
export default {
  async fetch(request) {
    return new Response(JSON.stringify({ message: 'Hello from Worker!' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

**4. Database Migration (DynamoDB → D1)**
```javascript
// DynamoDB query
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function getItem(id) {
  const params = { TableName: 'users', Key: { id } };
  const result = await dynamodb.get(params).promise();
  return result.Item;
}

// D1 equivalent
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?1');
    const result = await stmt.bind(id).first();

    return Response.json(result);
  }
};
```

### 2. Vercel to Cloudflare Migration

#### Migration Benefits
- **40-60% Cost Reduction**: Pro features included for free
- **Better Performance**: Native edge vs edge middleware
- **More Database Options**: D1, Turso, Neon, etc.

#### Migration Steps

**1. Export Vercel Configuration**
```bash
# Extract Vercel configuration
cat vercel.json > vercel-config-backup.json

# Export environment variables
vercel env pull .env.backup

# Export deployment history
vercel ls --scope your-team > deployments.log
```

**2. Next.js Migration**
```javascript
// pages/api/hello.js (Vercel)
export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from Vercel' });
}

// Cloudflare Pages Functions equivalent (functions/api/hello.js)
export function onRequestGet(context) {
  return new Response(JSON.stringify({ message: 'Hello from Cloudflare' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**3. Vercel KV to Cloudflare KV**
```javascript
// Vercel KV usage
import { kv } from '@vercel/kv';

export async function getCounter() {
  return await kv.get('counter');
}

// Cloudflare KV equivalent
export default {
  async fetch(request, env) {
    const counter = await env.COUNTER_KV.get('counter');
    return new Response(counter || '0');
  }
};
```

**4. Environment Variable Migration**
```bash
# wrangler.toml configuration
name = "my-app"
compatibility_date = "2024-01-01"

[env.production.vars]
NODE_ENV = "production"
API_URL = "https://api.example.com"

[env.production.kv_namespaces]
COUNTER = "your-kv-namespace-id"
```

### 3. Netlify to Cloudflare Migration

#### Migration Benefits
- **50-80% Cost Reduction**: Functions included vs add-on pricing
- **Better Edge Performance**: Global edge vs regional
- **Advanced Security**: WAF and bot management included

#### Migration Steps

**1. Netlify Functions to Cloudflare Workers**
```javascript
// netlify/functions/api.js (Netlify)
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Netlify' })
  };
};

// Cloudflare Worker equivalent
export default {
  async fetch(request) {
    if (request.url.includes('/api/')) {
      return new Response(JSON.stringify({ message: 'Hello from Cloudflare' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return fetch(request);
  }
};
```

**2. Redirects Configuration**
```javascript
// _redirects (Netlify)
/api/*   /.netlify/functions/api    200
/old-path    /new-path    301

// Cloudflare equivalent (wrangler.toml)
[[routes]]
pattern = "api.example.com/api/*"
zone_name = "example.com"

[redirects]
from = "/old-path"
to = "/new-path"
status = 301
```

**3. Form Handling Migration**
```javascript
// Netlify form handling
export default {
  async fetch(request, env) {
    if (request.method === 'POST' && request.url.includes('/contact')) {
      const data = await request.formData();

      // Process form data
      await processForm(data, env);

      return new Response('Form submitted successfully', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return fetch(request);
  }
};
```

### 4. Heroku to Cloudflare Migration

#### Migration Benefits
- **80-95% Cost Reduction**: Free tier vs $25+/month
- **Better Performance**: Global vs regional
- **No Downtime**: Always-on vs dyno sleeping

#### Migration Steps

**1. Express.js Migration**
```javascript
// Heroku Express app
const express = require('express');
const app = express();

app.get('/api/users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

app.listen(process.env.PORT || 3000);

// Cloudflare Worker equivalent
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/users' && request.method === 'GET') {
      const stmt = env.DB.prepare('SELECT * FROM users');
      const users = await stmt.all();

      return new Response(JSON.stringify(users.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Serve static files
    return await env.ASSETS.fetch(request);
  }
};
```

**2. Database Migration (PostgreSQL → D1)**
```bash
# Export PostgreSQL data
pg_dump your_database > backup.sql

# Convert to SQLite (for D1)
sqlite3 converted.db < backup.sql

# Deploy to D1
wrangler d1 migrations apply your-database --remote
```

**3. Environment Variables**
```bash
# Heroku environment variables
heroku config --app your-app

# Set in Cloudflare
wrangler secret put DATABASE_URL
wrangler secret put SESSION_SECRET
wrangler secret put API_KEY
```

## 🛠️ Universal Migration Tools

### Migration Automation Script

```bash
#!/bin/bash
# universal-migrate.sh - Universal migration tool

MIGRATION_TYPE=$1
PROJECT_NAME=$2

echo "🚀 Starting migration: $MIGRATION_TYPE for $PROJECT_NAME"

case $MIGRATION_TYPE in
  "nextjs")
    echo "Setting up Next.js migration..."
    npx create-cloudflare-app $PROJECT_NAME --template next
    ;;

  "react")
    echo "Setting up React migration..."
    npx create-cloudflare-app $PROJECT_NAME --template react
    ;;

  "static")
    echo "Setting up static site migration..."
    npx create-cloudflare-app $PROJECT_NAME --template static
    ;;

  "api")
    echo "Setting up API migration..."
    npx create-cloudflare-app $PROJECT_NAME --template worker
    ;;

  *)
    echo "Unknown migration type: $MIGRATION_TYPE"
    echo "Available types: nextjs, react, static, api"
    exit 1
    ;;
esac

cd $PROJECT_NAME

# Setup environment
wrangler auth login
wrangler whoami

echo "✅ Migration setup complete!"
echo "Next steps:"
echo "1. Copy your application code to src/"
echo "2. Configure wrangler.toml"
echo "3. Set environment variables with 'wrangler secret put'"
echo "4. Run 'wrangler deploy' to deploy"
```

### Configuration Converter

```javascript
// config-converter.js - Convert various configs to wrangler.toml
const fs = require('fs');
const path = require('path');

function convertConfig(projectPath) {
  const wranglerConfig = {
    name: path.basename(projectPath),
    main: "src/index.js",
    compatibility_date: "2024-01-01",
  };

  // Convert Vercel config
  if (fs.existsSync('vercel.json')) {
    const vercel = JSON.parse(fs.readFileSync('vercel.json'));
    wranglerConfig.routes = vercel.rewrites?.map(r => ({
      pattern: r.source,
      zone_name: "example.com"
    }));
  }

  // Convert Netlify config
  if (fs.existsSync('netlify.toml')) {
    // Parse and convert redirects
    wranglerConfig.routes = parseNetlifyRedirects();
  }

  // Convert package.json scripts
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json'));
    wranglerConfig.build = {
      command: pkg.scripts?.build || "npm run build",
      upload = {
        dir = "dist",
        format = "directory"
      }
    };
  }

  fs.writeFileSync('wrangler.toml', toTOML(wranglerConfig));
  console.log('✅ wrangler.toml created successfully');
}

function toTOML(obj, indent = 0) {
  const spaces = ' '.repeat(indent);
  let toml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      toml += `${spaces}[${key}]\n`;
      toml += toTOML(value, indent + 2);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        toml += `${spaces}${key} = ${JSON.stringify(item)}\n`;
      });
    } else {
      toml += `${spaces}${key} = ${JSON.stringify(value)}\n`;
    }
  }

  return toml;
}

module.exports = { convertConfig };
```

## 📊 Performance Comparison After Migration

### Real-World Case Studies

#### E-commerce Platform (100K monthly visitors)
- **Before (AWS)**: $800/month, 2.3s average load time
- **After (Cloudflare)**: $120/month, 0.8s average load time
- **Savings**: 85% cost reduction, 65% performance improvement

#### SaaS Application (50K users)
- **Before (Heroku)**: $500/month, 1.8s average response time
- **After (Cloudflare)**: $80/month, 0.6s average response time
- **Savings**: 84% cost reduction, 67% performance improvement

#### Blog/Media Site (1M monthly pageviews)
- **Before (Vercel Pro)**: $200/month, 1.2s average load time
- **After (Cloudflare)**: $50/month, 0.4s average load time
- **Savings**: 75% cost reduction, 67% performance improvement

### Performance Testing Tools

```bash
# Before and after migration performance test
#!/bin/bash

DOMAIN_BEFORE=$1
DOMAIN_AFTER=$2

echo "🏁 Performance Comparison Test"
echo "============================="

echo "Testing $DOMAIN_BEFORE..."
before_results=$(curl -s -w "@curl-format.txt" -o /dev/null $DOMAIN_BEFORE)

echo "Testing $DOMAIN_AFTER..."
after_results=$(curl -s -w "@curl-format.txt" -o /dev/null $DOMAIN_AFTER)

echo -e "\nResults:"
echo "Before: $before_results"
echo "After:  $after_results"
```

## 🔄 Database Migration Strategies

### 1. PostgreSQL to D1 Migration

```sql
-- Convert PostgreSQL schema to D1-compatible SQL
-- Original PostgreSQL
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- D1 equivalent
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### 2. Data Migration Script

```javascript
// migrate-database.js
export default {
  async fetch(request, env) {
    if (request.url.includes('/migrate')) {
      await migratePostgresToD1(env);
      return new Response('Migration completed');
    }
  }
};

async function migratePostgresToD1(env) {
  // Connect to PostgreSQL
  const pgResponse = await fetch('https://your-db.rds.amazonaws.com/users', {
    headers: { 'Authorization': 'Bearer ' + env.PG_TOKEN }
  });

  const users = await pgResponse.json();

  // Insert into D1
  for (const user of users) {
    await env.D1.prepare('INSERT INTO users (id, email, created_at) VALUES (?1, ?2, ?3)')
      .bind(user.id, user.email, Date.parse(user.created_at) / 1000)
      .run();
  }
}
```

## 🚀 Advanced Migration Strategies

### 1. Zero-Downtime Migration

```javascript
// Canary deployment worker
export default {
  async fetch(request, env) {
    const shouldUseNewBackend = Math.random() < 0.1; // 10% traffic to new backend

    if (shouldUseNewBackend) {
      return handleCloudflareRequest(request, env);
    } else {
      return forwardToLegacyBackend(request, env);
    }
  }
};

async function forwardToLegacyBackend(request, env) {
  const url = new URL(request.url);
  const legacyUrl = `https://your-legacy-app.com${url.pathname}${url.search}`;

  return fetch(legacyUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
}
```

### 2. Gradual Feature Migration

```javascript
// Feature flag worker for gradual migration
export default {
  async fetch(request, env) {
    const features = await getFeatureFlags(env, request);
    const url = new URL(request.url);

    // Route specific features to Cloudflare
    if (features.new_api && url.pathname.startsWith('/api/v2/')) {
      return handleNewAPI(request, env);
    }

    // Keep legacy features for now
    if (url.pathname.startsWith('/api/v1/')) {
      return forwardToLegacyAPI(request, env);
    }

    return handleRequest(request, env);
  }
};

async function getFeatureFlags(env, request) {
  const userId = await getUserId(request);
  const flags = await env.FEATURE_KV.get(`flags:${userId}`);
  return JSON.parse(flags || '{}');
}
```

## 📋 Migration Checklist

### Pre-Migration
- [ ] Assess current architecture and dependencies
- [ ] Create backup of all data and configurations
- [ ] Set up monitoring on existing platform
- [ ] Prepare rollback strategy
- [ ] Stakeholder approval and communication plan

### Migration Execution
- [ ] Set up Cloudflare account and authentication
- [ ] Create new project with appropriate template
- [ ] Migrate static assets and configurations
- [ ] Convert API endpoints to Workers
- [ ] Migrate database schema and data
- [ ] Configure DNS and SSL certificates
- [ ] Set up monitoring and logging

### Post-Migration
- [ ] Performance testing and optimization
- [ ] Security audit and hardening
- [ ] Update documentation and runbooks
- [ ] Team training on new platform
- [ ] Cost optimization and monitoring
- [ ] Decommission old infrastructure

### Validation
- [ ] All functionality working correctly
- [ ] Performance meets or exceeds targets
- [ ] Security configurations verified
- [ ] Monitoring and alerting operational
- [ ] Team trained and comfortable
- [ ] Documentation complete

## 🎯 Success Metrics

Track these metrics to ensure successful migration:

- **Performance**: Response time < 1s globally
- **Availability**: 99.9% uptime or better
- **Cost**: < 30% of previous platform cost
- **Security**: No security incidents
- **Team Satisfaction**: > 8/10 team satisfaction score

---

**Ready to start your migration?** Begin with our [Foundation Learning Path](../paths/foundation-path.md) to build the necessary skills, then use our [Quick Reference Cards](../quick-reference/) for essential commands and configurations.