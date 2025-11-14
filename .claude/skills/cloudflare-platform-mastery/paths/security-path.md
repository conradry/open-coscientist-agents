# Security Learning Path

> **3-hour comprehensive security implementation and mastery on Cloudflare**

## 🎯 Learning Objectives

By the end of this 3-hour security learning path, you will:

- ✅ Implement enterprise-grade security architecture
- ✅ Configure advanced WAF rules and bot management
- ✅ Set up comprehensive access control and authentication
- ✅ Deploy DDoS protection and rate limiting
- ✅ Implement security monitoring and incident response
- ✅ Achieve compliance with security standards (SOC 2, ISO 27001)

## ⏱️ Time Breakdown

| Module | Duration | Topics |
|--------|----------|--------|
| **Module 1: Security Architecture** | 30 min | Defense in depth, security layers, threat modeling |
| **Module 2: WAF & Bot Management** | 45 min | Advanced WAF rules, bot detection, rate limiting |
| **Module 3: Access Control** | 40 min | Cloudflare Access, SSO, MFA, device posture |
| **Module 4: DDoS Protection** | 35 min | Layer 7 protection, rate limiting, traffic analysis |
| **Module 5: Monitoring & Response** | 50 min | Security analytics, incident response, compliance |

## 📚 Prerequisites

- Completed Foundation Learning Path
- Understanding of web security fundamentals
- Basic knowledge of HTTP/S protocols
- Access to Cloudflare dashboard (Pro plan recommended for advanced features)

---

## 🛡️ Module 1: Security Architecture (30 minutes)

### 1.1 Defense in Depth Strategy

**Learning Goal**: Understand and implement multi-layered security.

**Security Layers Overview:**

```
┌─────────────────────────────────────────┐
│              Application Layer          │  ← Your Workers/Pages
├─────────────────────────────────────────┤
│             Cloudflare WAF             │  ← Web Application Firewall
├─────────────────────────────────────────┤
│           Bot Management                │  ← Bot Detection/Blocking
├─────────────────────────────────────────┤
│            DDoS Protection              │  ← Network/Layer 7 Protection
├─────────────────────────────────────────┤
│           DNS Security                  │  ← DNSSEC + DNS Firewall
├─────────────────────────────────────────┤
│          Network Security               │  ← DDoS Mitigation, Magic Transit
└─────────────────────────────────────────┘
```

**Implementation Exercise:**

1. **Create Security Assessment Worker**
```javascript
// security-assessment/src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const securityScan = await performSecurityScan(request);

    if (url.pathname === '/security-scan') {
      return new Response(JSON.stringify(securityScan, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Apply security headers to all responses
    const response = await handleRequest(request, env);
    applySecurityHeaders(response, securityScan);

    return response;
  }
};

async function performSecurityScan(request) {
  const scan = {
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      url: request.url,
      headers: {},
      riskScore: 0
    },
    threats: [],
    recommendations: []
  };

  // Analyze request headers for threats
  for (const [key, value] of request.headers.entries()) {
    scan.request.headers[key] = value;

    // Check for suspicious patterns
    if (key.toLowerCase().includes('user-agent')) {
      if (value.includes('bot') || value.includes('crawler')) {
        scan.threats.push('Suspicious User-Agent detected');
        scan.request.riskScore += 20;
      }
    }

    if (key.toLowerCase().includes('x-forwarded-for')) {
      const ips = value.split(',');
      if (ips.length > 3) {
        scan.threats.push('Multiple proxy layers detected');
        scan.request.riskScore += 15;
      }
    }
  }

  // Check request body for injection attempts
  if (request.method === 'POST' || request.method === 'PUT') {
    const body = await request.clone().text();
    const injectionPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /union.*select/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(body)) {
        scan.threats.push(`Potential injection attack detected: ${pattern}`);
        scan.request.riskScore += 50;
      }
    }
  }

  // Generate recommendations
  if (scan.request.riskScore > 30) {
    scan.recommendations.push('Implement additional WAF rules');
    scan.recommendations.push('Consider enabling stricter bot protection');
  }

  if (!request.headers.get('X-Forwarded-Proto')?.includes('https')) {
    scan.recommendations.push('Enforce HTTPS-only connections');
  }

  return scan;
}

function applySecurityHeaders(response, securityScan) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  };

  // Apply headers conditionally based on risk score
  if (securityScan.request.riskScore > 50) {
    headers['X-Robots-Tag'] = 'noindex, nofollow';
  }

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  response.headers.set('X-Security-Score', securityScan.request.riskScore.toString());
}
```

2. **Deploy Security Assessment Worker**
```bash
# Create worker
mkdir security-assessment
cd security-assessment

# Initialize wrangler.toml
cat > wrangler.toml << EOF
name = "security-assessment"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "security-assessment-prod"
EOF

# Deploy
wrangler deploy
```

### 1.2 Threat Modeling Exercise

**Learning Goal**: Identify and categorize potential threats.

**Threat Model Template:**

```javascript
// threat-model/src/index.js
const THREAT_CATEGORIES = {
  INJECTION: {
    name: 'Injection Attacks',
    patterns: [SQL, XSS, Command injection],
    severity: 'HIGH',
    mitigations: ['Input validation', 'Parameterized queries', 'WAF rules']
  },
  AUTHENTICATION: {
    name: 'Authentication Bypass',
    patterns: ['Brute force', 'Credential stuffing', 'Session hijacking'],
    severity: 'HIGH',
    mitigations: ['Rate limiting', 'MFA', 'Session management']
  },
  AUTHORIZATION: {
    name: 'Authorization Issues',
    patterns: ['Privilege escalation', 'Direct object references'],
    severity: 'MEDIUM',
    mitigations: ['Access controls', 'Principle of least privilege']
  },
  DDOS: {
    name: 'Denial of Service',
    patterns: ['Volumetric attacks', 'Application layer attacks'],
    severity: 'HIGH',
    mitigations: ['DDoS protection', 'Rate limiting', 'CDN']
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/threat-analysis') {
      const analysis = await analyzeThreats(request);
      return new Response(JSON.stringify(analysis, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Security Worker Active');
  }
};

async function analyzeThreats(request) {
  const analysis = {
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers.entries())
    },
    identifiedThreats: [],
    riskLevel: 'LOW',
    mitigations: []
  };

  // Analyze request for each threat category
  Object.entries(THREAT_CATEGORIES).forEach(([key, category]) => {
    const threats = detectThreats(request, category);
    if (threats.length > 0) {
      analysis.identifiedThreats.push({
        category: category.name,
        threats: threats,
        severity: category.severity
      });

      if (category.severity === 'HIGH') {
        analysis.riskLevel = 'HIGH';
        analysis.mitigations.push(...category.mitigations);
      }
    }
  });

  return analysis;
}
```

**✅ Module 1 Completion Check:**
- [ ] Security assessment worker deployed and functional
- [ ] Multi-layer security architecture understood
- [ ] Threat model created for your application
- [ ] Basic security headers implemented

---

## 🔥 Module 2: WAF & Bot Management (45 minutes)

### 2.1 Advanced WAF Rules

**Learning Goal**: Create sophisticated WAF rules for custom protection.

**WAF Rule Creation:**

1. **Create Custom WAF Rules via API**
```bash
#!/bin/bash
# create-waf-rules.sh

ZONE_ID="your_zone_id"
API_TOKEN="your_api_token"

# Rule 1: SQL Injection Protection
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "SQL Injection Protection",
    "action": "block",
    "filter": {
      "expression": "(http.request.uri.path contains \"?\") and (http.request.uri.query contains \"union\" or http.request.uri.query contains \"select\" or http.request.uri.query contains \"insert\" or http.request.uri.query contains \"delete\" or http.request.uri.query contains \"drop\")"
    },
    "paused": false
  }'

# Rule 2: XSS Protection
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "XSS Protection",
    "action": "block",
    "filter": {
      "expression": "(http.request.uri.query contains \"<script\" or http.request.uri.query contains \"javascript:\" or http.request.uri.query contains \"onload=\")"
    },
    "paused": false
  }'

# Rule 3: File Upload Protection
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Malicious File Upload Protection",
    "action": "block",
    "filter": {
      "expression": "(http.request.method in {\"POST\" \"PUT\"}) and (http.request.uri.path contains \"/upload\") and (http.request.uri.query contains \".php\" or http.request.uri.query contains \".jsp\" or http.request.uri.query contains \".asp\")"
    },
    "paused": false
  }'

echo "WAF rules created successfully!"
```

2. **Advanced Rate Limiting Rules**
```bash
# Create sophisticated rate limiting
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "API Rate Limiting",
    "action": "rate_limit",
    "filter": {
      "expression": "(http.request.uri.path contains \"/api/\")"
    },
    "ratelimit": {
      "characteristics": [
        "ip.src",
        "http.request.uri.path"
      ],
      "period": 60,
      "requests_per_period": 100,
      "mitigation_timeout": 600,
      "counting_expression": "http.request.method"
    }
  }'

# Login endpoint specific rate limiting
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Login Rate Limiting",
    "action": "rate_limit",
    "filter": {
      "expression": "(http.request.uri.path contains \"/login\" or http.request.uri.path contains \"/auth\") and (http.request.method eq \"POST\")"
    },
    "ratelimit": {
      "characteristics": ["ip.src", "http.request.headers.names[\"User-Agent\"]"],
      "period": 900,
      "requests_per_period": 5,
      "mitigation_timeout": 1800
    }
  }'
```

### 2.2 Bot Detection and Management

**Learning Goal**: Configure advanced bot protection strategies.

**Bot Management Configuration:**

1. **Enable Bot Fight Mode**
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "bot_management": {
      "fight_mode": true,
      "enable_js": true
    }
  }'
```

2. **Create Custom Bot Detection Worker**
```javascript
// bot-detection/src/index.js
export default {
  async fetch(request, env, ctx) {
    const botAnalysis = await analyzeBot(request, env);

    // Log bot detection results
    ctx.waitUntil(
      env.BOT_ANALYTICS.put(
        `bot:${Date.now()}:${Math.random()}`,
        JSON.stringify(botAnalysis),
        { expirationTtl: 7 * 24 * 60 * 60 }
      )
    );

    // If suspicious bot detected, take action
    if (botAnalysis.isSuspicious) {
      return handleSuspiciousBot(request, botAnalysis);
    }

    // Continue normal processing
    return handleRequest(request, env);
  }
};

async function analyzeBot(request, env) {
  const analysis = {
    timestamp: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent') || '',
    headers: {},
    score: 0,
    isBot: false,
    isSuspicious: false,
    reasons: []
  };

  // Collect relevant headers
  const botHeaders = [
    'CF-Bot-Detection',
    'CF-Device-Type',
    'CF-IPCountry',
    'CF-Ray',
    'CF-Visitor'
  ];

  botHeaders.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      analysis.headers[header] = value;
    }
  });

  // Analyze User-Agent
  const suspiciousUAPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /spider/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http/i
  ];

  const goodBotPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /facebookexternalhit/i
  ];

  const userAgent = analysis.userAgent.toLowerCase();

  // Check for good bots
  const isGoodBot = goodBotPatterns.some(pattern => pattern.test(userAgent));
  if (isGoodBot) {
    analysis.isBot = true;
    analysis.score -= 20;
    analysis.reasons.push('Recognized good bot');
    return analysis;
  }

  // Check for suspicious patterns
  suspiciousUAPatterns.forEach(pattern => {
    if (pattern.test(userAgent)) {
      analysis.score += 30;
      analysis.isBot = true;
      analysis.reasons.push(`Suspicious User-Agent pattern: ${pattern}`);
    }
  });

  // Check for missing or empty User-Agent
  if (!analysis.userAgent || analysis.userAgent.length < 10) {
    analysis.score += 25;
    analysis.reasons.push('Missing or short User-Agent');
  }

  // Analyze request patterns
  const url = new URL(request.url);
  if (url.pathname.includes('/admin') || url.pathname.includes('/wp-admin')) {
    analysis.score += 40;
    analysis.reasons.push('Accessing sensitive paths');
  }

  // Check for automated behavior indicators
  const acceptHeader = request.headers.get('Accept');
  if (!acceptHeader || acceptHeader.includes('*/*')) {
    analysis.score += 15;
    analysis.reasons.push('Generic Accept header');
  }

  // Check for common bot headers
  if (request.headers.get('CF-Bot-Detection') === 'bot') {
    analysis.isBot = true;
    analysis.score += 50;
    analysis.reasons.push('Cloudflare bot detection');
  }

  // Determine if suspicious
  analysis.isSuspicious = analysis.score > 60;

  return analysis;
}

async function handleSuspiciousBot(request, analysis) {
  const userAgent = analysis.userAgent || 'Unknown';

  // Return challenge page for suspicious bots
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Check</title>
      <style>
        body { font-family: system-ui; margin: 2rem; text-align: center; }
        .container { max-width: 600px; margin: 0 auto; }
        .warning { background: #fff3cd; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🛡️ Security Check</h1>
        <div class="warning">
          <p>We detected unusual activity from your browser.</p>
          <p>User Agent: <code>${userAgent}</code></p>
          <p>Score: ${analysis.score}/100</p>
          <p>Reasons: ${analysis.reasons.join(', ')}</p>
        </div>
        <p>If you are a legitimate user, please try again in a few minutes.</p>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html',
      'X-Bot-Score': analysis.score.toString(),
      'X-Bot-Reasons': analysis.reasons.join(';')
    }
  });
}
```

### 2.3 Advanced Security Rules

**Learning Goal**: Implement complex security logic with Workers.

**Advanced Security Worker:**

```javascript
// advanced-security/src/index.js
const SECURITY_RULES = {
  // IP-based security
  IP_BLACKLIST: {
    enabled: true,
    ips: ['192.168.1.100', '10.0.0.50'], // Example malicious IPs
    action: 'block'
  },

  // Geographic restrictions
  GEO_RESTRICTIONS: {
    enabled: true,
    blocked: ['CN', 'RU', 'KP'], // Country codes to block
    action: 'challenge'
  },

  // Request pattern detection
  ANOMALY_DETECTION: {
    enabled: true,
    suspiciousPatterns: [
      /\.\.\//g,  // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /exec\(/i,  // Code execution
    ],
    action: 'block'
  },

  // Session security
  SESSION_SECURITY: {
    enabled: true,
    maxConcurrentSessions: 5,
    sessionTimeout: 3600, // 1 hour
    action: 'rate_limit'
  }
};

export default {
  async fetch(request, env, ctx) {
    const securityResult = await applySecurityRules(request, env);

    // Log security events
    if (securityResult.action !== 'allow') {
      ctx.waitUntil(
        logSecurityEvent(env, securityResult)
      );
    }

    // Apply security action
    switch (securityResult.action) {
      case 'block':
        return blockRequest(securityResult);
      case 'challenge':
        return challengeRequest(securityResult);
      case 'rate_limit':
        return rateLimitRequest(securityResult);
      default:
        return handleRequest(request, env);
    }
  }
};

async function applySecurityRules(request, env) {
  const result = {
    timestamp: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP'),
    action: 'allow',
    ruleTriggered: null,
    details: {}
  };

  // 1. IP Blacklist check
  if (SECURITY_RULES.IP_BLACKLIST.enabled) {
    const clientIP = result.ip;
    if (SECURITY_RULES.IP_BLACKLIST.ips.includes(clientIP)) {
      result.action = SECURITY_RULES.IP_BLACKLIST.action;
      result.ruleTriggered = 'IP_BLACKLIST';
      result.details.blacklistedIP = clientIP;
      return result;
    }
  }

  // 2. Geographic restrictions
  if (SECURITY_RULES.GEO_RESTRICTIONS.enabled) {
    const country = request.headers.get('CF-IPCountry');
    if (country && SECURITY_RULES.GEO_RESTRICTIONS.blocked.includes(country)) {
      result.action = SECURITY_RULES.GEO_RESTRICTIONS.action;
      result.ruleTriggered = 'GEO_RESTRICTIONS';
      result.details.country = country;
      return result;
    }
  }

  // 3. Anomaly detection
  if (SECURITY_RULES.ANOMALY_DETECTION.enabled) {
    const url = request.url;
    const suspiciousPatterns = SECURITY_RULES.ANOMALY_DETECTION.suspiciousPatterns;

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        result.action = SECURITY_RULES.ANOMALY_DETECTION.action;
        result.ruleTriggered = 'ANOMALY_DETECTION';
        result.details.suspiciousPattern = pattern.toString();
        return result;
      }
    }

    // Check request body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const body = await request.clone().text();
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(body)) {
          result.action = SECURITY_RULES.ANOMALY_DETECTION.action;
          result.ruleTriggered = 'ANOMALY_DETECTION';
          result.details.suspiciousPattern = pattern.toString();
          return result;
        }
      }
    }
  }

  // 4. Session security
  if (SECURITY_RULES.SESSION_SECURITY.enabled) {
    const sessionKey = `sessions:${result.ip}`;
    const currentSessions = await env.SESSION_KV.get(sessionKey);

    if (currentSessions) {
      const sessions = JSON.parse(currentSessions);
      const activeCount = sessions.filter(s => Date.now() - s.lastSeen < 60000).length;

      if (activeCount > SECURITY_RULES.SESSION_SECURITY.maxConcurrentSessions) {
        result.action = SECURITY_RULES.SESSION_SECURITY.action;
        result.ruleTriggered = 'SESSION_SECURITY';
        result.details.activeSessions = activeCount;
        return result;
      }

      // Update session
      const updatedSessions = [
        ...sessions,
        { lastSeen: Date.now(), endpoint: new URL(request.url).pathname }
      ].slice(-10); // Keep last 10 sessions

      ctx.waitUntil(
        env.SESSION_KV.put(sessionKey, JSON.stringify(updatedSessions), {
          expirationTtl: SECURITY_RULES.SESSION_SECURITY.sessionTimeout
        })
      );
    } else {
      // Create new session
      ctx.waitUntil(
        env.SESSION_KV.put(sessionKey, JSON.stringify([{
          lastSeen: Date.now(),
          endpoint: new URL(request.url).pathname
        }]), {
          expirationTtl: SECURITY_RULES.SESSION_SECURITY.sessionTimeout
        })
      );
    }
  }

  return result;
}

async function logSecurityEvent(env, securityResult) {
  const logEntry = {
    ...securityResult,
    userAgent: request.headers.get('User-Agent'),
    url: request.url,
    method: request.method
  };

  await env.SECURITY_LOGS.put(
    `security:${Date.now()}:${Math.random()}`,
    JSON.stringify(logEntry),
    { expirationTtl: 30 * 24 * 60 * 60 } // Keep for 30 days
  );
}

function blockRequest(securityResult) {
  return new Response('Access Denied', {
    status: 403,
    headers: {
      'Content-Type': 'text/plain',
      'X-Security-Action': 'block',
      'X-Security-Rule': securityResult.ruleTriggered
    }
  });
}

function challengeRequest(securityResult) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Security Challenge</title></head>
    <body>
      <h1>Security Check Required</h1>
      <p>Your request has been flagged for review.</p>
      <p>Reason: ${securityResult.ruleTriggered}</p>
      <p>Please wait a moment and try again.</p>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 429,
    headers: {
      'Content-Type': 'text/html',
      'X-Security-Action': 'challenge',
      'X-Security-Rule': securityResult.ruleTriggered
    }
  });
}

function rateLimitRequest(securityResult) {
  return new Response('Too Many Requests', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain',
      'X-Security-Action': 'rate_limit',
      'X-Security-Rule': securityResult.ruleTriggered,
      'Retry-After': '60'
    }
  });
}
```

**✅ Module 2 Completion Check:**
- [ ] Custom WAF rules deployed and functional
- [ ] Advanced rate limiting implemented
- [ ] Bot detection system operational
- [ ] Security monitoring and logging active

---

## 🔐 Module 3: Access Control (40 minutes)

### 3.1 Cloudflare Access Implementation

**Learning Goal**: Set up comprehensive access control with Cloudflare Access.

**Access Configuration:**

1. **Create Access Application**
```bash
# Create Access application via API
curl -X POST "https://api.cloudflare.com/client/v4/accounts/your_account_id/access/apps" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Secure Application",
    "domain": "secure.yourdomain.com",
    "type": "self_hosted",
    "policies": [
      {
        "name": "Allow Corporate Users",
        "decision": "allow",
        "include": [
          {
            "email": {
              "email": "@yourcompany.com"
            }
          }
        ]
      }
    ],
    "settings": {
      "domain": "secure.yourdomain.com",
      "session_duration": "24h",
      "auto_redirect_to_identity": true
    }
  }'
```

2. **Configure SSO Integration**
```bash
# Add SSO identity provider
curl -X POST "https://api.cloudflare.com/client/v4/accounts/your_account_id/access/identity_providers" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "oidc",
    "name": "Company SSO",
    "config": {
      "client_id": "your_sso_client_id",
      "client_secret": "your_sso_client_secret",
      "auth_url": "https://sso.yourcompany.com/auth",
      "token_url": "https://sso.yourcompany.com/token",
      "userinfo_url": "https://sso.yourcompany.com/userinfo",
      "scopes": ["openid", "profile", "email"]
    }
  }'
```

3. **Access Gateway Worker**
```javascript
// access-gateway/src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle Access authentication
    if (url.pathname === '/access-auth') {
      return handleAccessAuth(request, env);
    }

    // Verify Access token
    const authResult = await verifyAccess(request, env);
    if (!authResult.valid) {
      return Response.redirect(`${url.origin}/access-auth`, 302);
    }

    // Process authenticated request
    return handleAuthenticatedRequest(request, env, authResult.user);
  }
};

async function verifyAccess(request, env) {
  const authHeader = request.headers.get('Cf-Access-Jwt-Assertion');

  if (!authHeader) {
    return { valid: false, reason: 'No token provided' };
  }

  try {
    // Decode JWT payload (without verification - Cloudflare does this)
    const payload = JSON.parse(atob(authHeader.split('.')[1]));

    // Check token validity
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { valid: false, reason: 'Token expired' };
    }

    return {
      valid: true,
      user: {
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        groups: payload.groups || []
      }
    };

  } catch (error) {
    return { valid: false, reason: 'Invalid token format' };
  }
}

function handleAccessAuth(request, env) {
  const url = new URL(request.url);

  // Redirect to Cloudflare Access login
  const loginUrl = `https://your-team.cloudflareaccess.com/cdn-cgi/access/login/${url.hostname}?redirect_url=${encodeURIComponent(url.href)}`;

  return Response.redirect(loginUrl, 302);
}

async function handleAuthenticatedRequest(request, env, user) {
  const url = new URL(request.url);

  // User dashboard
  if (url.pathname === '/') {
    return new Response(generateDashboard(user), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // API endpoints
  if (url.pathname.startsWith('/api/')) {
    return handleAPI(request, env, user);
  }

  return new Response('Not Found', { status: 404 });
}

function generateDashboard(user) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Secure Dashboard</title>
      <style>
        body { font-family: system-ui; margin: 2rem; }
        .dashboard { max-width: 800px; margin: 0 auto; }
        .user-info { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .avatar { width: 50px; height: 50px; border-radius: 50%; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h1>🔐 Secure Dashboard</h1>
        <div class="user-info">
          <img src="${user.avatar}" alt="Avatar" class="avatar">
          <h2>Welcome, ${user.name}!</h2>
          <p>Email: ${user.email}</p>
          <p>Groups: ${user.groups.join(', ')}</p>
        </div>

        <div>
          <h3>Available Actions</h3>
          <ul>
            <li><a href="/api/user-info">View API User Info</a></li>
            <li><a href="/api/secure-data">Access Secure Data</a></li>
            <li><a href="/api/admin-panel">Admin Panel (if authorized)</a></li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

### 3.2 Multi-Factor Authentication (MFA)

**Learning Goal**: Implement robust MFA strategies.

**MFA Implementation Worker:**

```javascript
// mfa-authentication/src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/mfa/setup') {
      return handleMFASetup(request, env);
    }

    if (url.pathname === '/mfa/verify') {
      return handleMFAVerification(request, env);
    }

    if (url.pathname === '/mfa/challenge') {
      return handleMFAChallenge(request, env);
    }

    // Check if MFA verification required
    const authResult = await checkAuthentication(request, env);
    if (authResult.mfaRequired) {
      return new Response(generateMFAChallenge(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return handleRequest(request, env, authResult.user);
  }
};

async function handleMFASetup(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { userId, method } = await request.json();

  switch (method) {
    case 'totp':
      return setupTOTP(userId, env);
    case 'sms':
      return setupSMS(userId, env);
    case 'email':
      return setupEmail(userId, env);
    default:
      return new Response('Invalid MFA method', { status: 400 });
  }
}

async function setupTOTP(userId, env) {
  // Generate TOTP secret
  const secret = crypto.getRandomValues(new Uint8Array(20));
  const secretBase32 = arrayBufferToBase32(secret);

  // Store secret
  await env.MFA_SECRETS.put(`${userId}:totp`, secretBase32);

  // Generate QR code URL
  const appName = encodeURIComponent('Secure Application');
  const accountName = encodeURIComponent(userId);
  const qrUrl = `otpauth://totp/${appName}:${accountName}?secret=${secretBase32}&issuer=${appName}`;

  return new Response(JSON.stringify({
    secret: secretBase32,
    qrUrl: qrUrl,
    backupCodes: await generateBackupCodes(userId, env)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleMFAVerification(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { userId, code, method } = await request.json();

  switch (method) {
    case 'totp':
      return verifyTOTP(userId, code, env);
    case 'backup_code':
      return verifyBackupCode(userId, code, env);
    default:
      return new Response('Invalid verification method', { status: 400 });
  }
}

async function verifyTOTP(userId, code, env) {
  const secret = await env.MFA_SECRETS.get(`${userId}:totp`);

  if (!secret) {
    return new Response(JSON.stringify({ valid: false, error: 'TOTP not set up' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify TOTP code (simplified - in production, use proper TOTP library)
  const expectedCode = generateTOTPCode(secret);
  const isValid = code === expectedCode;

  if (isValid) {
    // Generate temporary MFA session
    const mfaToken = crypto.randomUUID();
    await env.MFA_SESSIONS.put(mfaToken, JSON.stringify({
      userId,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    }), { expirationTtl: 5 * 60 });

    return new Response(JSON.stringify({
      valid: true,
      mfaToken: mfaToken
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ valid: false, error: 'Invalid code' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

function generateMFAChallenge() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MFA Verification Required</title>
      <style>
        body { font-family: system-ui; margin: 2rem; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin: 1rem 0; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
        input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
        .tabs { display: flex; margin-bottom: 1rem; }
        .tab { flex: 1; padding: 0.5rem; text-align: center; background: #f0f0f0; border: 1px solid #ddd; cursor: pointer; }
        .tab.active { background: #007cba; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Multi-Factor Authentication</h1>
        <p>Please enter your verification code to continue.</p>

        <div class="tabs">
          <div class="tab active" onclick="showTab('totp')">Authenticator App</div>
          <div class="tab" onclick="showTab('backup')">Backup Code</div>
        </div>

        <form id="mfa-form" onsubmit="verifyMFA(event)">
          <div id="totp-tab">
            <div class="form-group">
              <label for="totp-code">Enter 6-digit code from your authenticator app:</label>
              <input type="text" id="totp-code" maxlength="6" pattern="[0-9]{6}" required>
            </div>
          </div>

          <div id="backup-tab" style="display: none;">
            <div class="form-group">
              <label for="backup-code">Enter 8-digit backup code:</label>
              <input type="text" id="backup-code" maxlength="8" pattern="[A-Z0-9]{8}" required>
            </div>
          </div>

          <button type="submit">Verify</button>
        </form>

        <p style="margin-top: 1rem; font-size: 0.9em; color: #666;">
          Can't access your codes? <a href="/support">Contact support</a>
        </p>
      </div>

      <script>
        let currentTab = 'totp';

        function showTab(tab) {
          currentTab = tab;
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelector(`[onclick="showTab('${tab}')"]`).classList.add('active');

          document.getElementById('totp-tab').style.display = tab === 'totp' ? 'block' : 'none';
          document.getElementById('backup-tab').style.display = tab === 'backup' ? 'block' : 'none';
        }

        async function verifyMFA(event) {
          event.preventDefault();

          const code = currentTab === 'totp'
            ? document.getElementById('totp-code').value
            : document.getElementById('backup-code').value;

          try {
            const response = await fetch('/mfa/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: 'current_user', // This would come from session
                code: code,
                method: currentTab === 'totp' ? 'totp' : 'backup_code'
              })
            });

            const result = await response.json();

            if (result.valid) {
              // Store MFA token and redirect
              localStorage.setItem('mfaToken', result.mfaToken);
              window.location.reload();
            } else {
              alert('Invalid code: ' + result.error);
            }
          } catch (error) {
            alert('Verification failed. Please try again.');
          }
        }
      </script>
    </body>
    </html>
  `;
}

// Helper functions
function arrayBufferToBase32(buffer) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.byteLength; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += chars[(value << (5 - bits)) & 31];
  }

  return output;
}

function generateTOTPCode(secret) {
  // Simplified TOTP generation - in production, use proper TOTP library
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateBackupCodes(userId, env) {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
  }

  await env.MFA_BACKUP_CODES.put(userId, JSON.stringify(codes));
  return codes;
}
```

**✅ Module 3 Completion Check:**
- [ ] Cloudflare Access configured and working
- [ ] SSO integration implemented
- [ ] MFA system deployed with TOTP support
- [ ] User authentication flow operational

---

## 🚨 Module 4: DDoS Protection (35 minutes)

### 4.1 Layer 7 DDoS Protection

**Learning Goal**: Implement advanced Layer 7 attack mitigation.

**DDoS Protection Worker:**

```javascript
// ddos-protection/src/index.js
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const clientIP = request.headers.get('CF-Connecting-IP');
    const url = new URL(request.url);

    // Analyze request for DDoS indicators
    const ddosAnalysis = await analyzeDDoS(request, env);

    // Log suspicious activity
    if (ddosAnalysis.suspicious) {
      ctx.waitUntil(
        logDDoSAttempt(env, ddosAnalysis, request)
      );
    }

    // Apply mitigation strategies
    const action = determineAction(ddosAnalysis);
    switch (action) {
      case 'block':
        return blockDDoSRequest(ddosAnalysis);
      case 'challenge':
        return challengeDDoSRequest(ddosAnalysis);
      case 'rate_limit':
        return rateLimitDDoSRequest(ddosAnalysis);
      case 'allow':
        return handleRequestWithMonitoring(request, env, ddosAnalysis);
      default:
        return new Response('Service Unavailable', { status: 503 });
    }
  }
};

async function analyzeDDoS(request, env) {
  const analysis = {
    timestamp: Date.now(),
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent') || '',
    method: request.method,
    url: request.url,
    path: new URL(request.url).pathname,
    suspicious: false,
    score: 0,
    indicators: [],
    recommendations: []
  };

  // 1. Rate-based analysis
  const rateData = await analyzeRequestRate(analysis.ip, env);
  if (rateData.abnormal) {
    analysis.score += 40;
    analysis.suspicious = true;
    analysis.indicators.push(`Abnormal request rate: ${rateData.rps} RPS`);
  }

  // 2. Geographic analysis
  const country = request.headers.get('CF-IPCountry');
  if (await isHighRiskCountry(country, env)) {
    analysis.score += 20;
    analysis.suspicious = true;
    analysis.indicators.push(`High-risk country: ${country}`);
  }

  // 3. User-Agent analysis
  if (!analysis.userAgent || analysis.userAgent.length < 10) {
    analysis.score += 25;
    analysis.suspicious = true;
    analysis.indicators.push('Missing or suspicious User-Agent');
  }

  // 4. Request pattern analysis
  if (await hasAbnormalPatterns(request, env)) {
    analysis.score += 35;
    analysis.suspicious = true;
    analysis.indicators.push('Abnormal request patterns detected');
  }

  // 5. Resource intensity analysis
  if (isResourceIntensive(request)) {
    analysis.score += 30;
    analysis.suspicious = true;
    analysis.indicators.push('Resource-intensive request');
  }

  // 6. Header analysis
  const headerAnalysis = analyzeHeaders(request);
  analysis.score += headerAnalysis.score;
  analysis.indicators.push(...headerAnalysis.indicators);

  return analysis;
}

async function analyzeRequestRate(ip, env) {
  const windowStart = Date.now() - 60000; // 1 minute window
  const key = `ddos:${ip}:${Math.floor(windowStart / 60000)}`; // Per-minute bucket

  let current = await env.DDoS_ANALYTICS.get(key);
  current = current ? parseInt(current) : 0;

  // Update counter
  const newCount = current + 1;
  await env.DDoS_ANALYTICS.put(key, newCount.toString(), { expirationTtl: 120 });

  // Check if rate is abnormal
  const normalThreshold = 100; // Adjust based on your application
  const abnormal = newCount > normalThreshold;

  return {
    currentCount: newCount,
    rps: newCount / 60, // Requests per second
    abnormal,
    threshold: normalThreshold
  };
}

async function isHighRiskCountry(country, env) {
  // Define high-risk countries based on your threat model
  const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
  return country && highRiskCountries.includes(country);
}

async function hasAbnormalPatterns(request, env) {
  const url = new URL(request.url);

  // Check for common DDoS patterns
  const suspiciousPatterns = [
    /\?\d+$/,                    // Random query parameters
    /\/\//,                      // Double slashes
    /\.\.\//,                    // Path traversal attempts
    /\/(admin|wp-admin|phpmyadmin)/i,  // Admin path attempts
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url.pathname + url.search)) {
      return true;
    }
  }

  // Check for repeated requests to same endpoint
  const endpointKey = `endpoint:${url.pathname}:${Math.floor(Date.now() / 60000)}`;
  let endpointCount = await env.DDoS_ANALYTICS.get(endpointKey);
  endpointCount = endpointCount ? parseInt(endpointCount) : 0;

  await env.DDoS_ANALYTICS.put(endpointKey, (endpointCount + 1).toString(), {
    expirationTtl: 120
  });

  return endpointCount > 50; // More than 50 requests to same endpoint per minute
}

function isResourceIntensive(request) {
  const url = new URL(request.url);

  // Large file uploads
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
    return true;
  }

  // Expensive query parameters
  const searchParams = url.searchParams;
  if (searchParams.has('limit') && parseInt(searchParams.get('limit')) > 1000) {
    return true;
  }

  // Complex database queries (simplified detection)
  if (url.pathname.includes('/api/') && url.search.includes('sort=') && url.search.includes('filter=')) {
    return true;
  }

  return false;
}

function analyzeHeaders(request) {
  const analysis = {
    score: 0,
    indicators: []
  };

  const headers = Object.fromEntries(request.headers.entries());

  // Missing common headers
  const requiredHeaders = ['Accept', 'User-Agent'];
  requiredHeaders.forEach(header => {
    if (!headers[header]) {
      analysis.score += 10;
      analysis.indicators.push(`Missing ${header} header`);
    }
  });

  // Suspicious header combinations
  if (headers['User-Agent']?.includes('curl') || headers['User-Agent']?.includes('wget')) {
    analysis.score += 15;
    analysis.indicators.push('CLI tool detected');
  }

  if (headers['X-Forwarded-For'] && headers['X-Forwarded-For'].split(',').length > 3) {
    analysis.score += 20;
    analysis.indicators.push('Multiple proxy layers');
  }

  return analysis;
}

function determineAction(analysis) {
  if (analysis.score >= 80) {
    return 'block';
  } else if (analysis.score >= 60) {
    return 'challenge';
  } else if (analysis.score >= 40) {
    return 'rate_limit';
  } else {
    return 'allow';
  }
}

function blockDDoSRequest(analysis) {
  const response = new Response('Access Denied', {
    status: 403,
    headers: {
      'Content-Type': 'text/plain',
      'X-DDoS-Action': 'block',
      'X-DDoS-Score': analysis.score.toString(),
      'X-DDoS-Reasons': analysis.indicators.join(';')
    }
  });

  // Log the block
  console.log(`DDoS Block: ${analysis.ip}, Score: ${analysis.score}, Reasons: ${analysis.indicators.join(', ')}`);

  return response;
}

function challengeDDoSRequest(analysis) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Check</title>
      <style>
        body { font-family: system-ui; margin: 2rem; text-align: center; background: #f8f9fa; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .warning { background: #fff3cd; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🛡️ Security Check Required</h1>
        <div class="warning">
          <p>We detected unusual traffic patterns.</p>
          <p>Security Score: ${analysis.score}/100</p>
          <p>Reasons: ${analysis.indicators.join(', ')}</p>
        </div>
        <p>Please wait a moment and try again, or complete the verification below.</p>

        <!-- Add CAPTCHA or other verification here -->
        <button onclick="retryAfterDelay()">Continue</button>
      </div>

      <script>
        function retryAfterDelay() {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      </script>
    </body>
    </html>
  `;

  const response = new Response(html, {
    status: 429,
    headers: {
      'Content-Type': 'text/html',
      'X-DDoS-Action': 'challenge',
      'X-DDoS-Score': analysis.score.toString(),
      'Retry-After': '30'
    }
  });

  console.log(`DDoS Challenge: ${analysis.ip}, Score: ${analysis.score}`);

  return response;
}

function rateLimitDDoSRequest(analysis) {
  return new Response('Too Many Requests', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain',
      'X-DDoS-Action': 'rate_limit',
      'X-DDoS-Score': analysis.score.toString(),
      'Retry-After': '60'
    }
  });
}

async function handleRequestWithMonitoring(request, env, analysis) {
  const startTime = Date.now();

  try {
    const response = await handleRequest(request, env);
    const processingTime = Date.now() - startTime;

    // Log normal requests for monitoring
    if (processingTime > 5000) { // Slow requests
      console.log(`Slow Request: ${analysis.ip}, Time: ${processingTime}ms, URL: ${request.url}`);
    }

    // Add security headers
    response.headers.set('X-DDoS-Monitored', 'true');
    response.headers.set('X-Request-ID', crypto.randomUUID());

    return response;

  } catch (error) {
    console.error(`Request Error: ${analysis.ip}, Error: ${error.message}`);
    throw error;
  }
}

async function logDDoSAttempt(env, analysis, request) {
  const logEntry = {
    timestamp: analysis.timestamp,
    ip: analysis.ip,
    score: analysis.score,
    indicators: analysis.indicators,
    url: request.url,
    method: request.method,
    userAgent: analysis.userAgent,
    headers: Object.fromEntries(request.headers.entries())
  };

  await env.DDoS_LOGS.put(
    `ddos:${analysis.timestamp}:${Math.random()}`,
    JSON.stringify(logEntry),
    { expirationTtl: 7 * 24 * 60 * 60 } // Keep for 7 days
  );
}
```

### 4.2 Advanced Rate Limiting

**Learning Goal**: Implement sophisticated rate limiting strategies.

**Rate Limiting Configuration:**

```bash
# Advanced rate limiting rules
curl -X POST "https://api.cloudflare.com/client/v4/zones/your_zone_id/firewall/rules" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Intelligent Rate Limiting",
    "action": "rate_limit",
    "filter": {
      "expression": "(http.request.uri.path contains \"/api/\")"
    },
    "ratelimit": {
      "characteristics": [
        "ip.src",
        "http.request.uri.path",
        "http.request.method"
      ],
      "period": 60,
      "requests_per_period": 100,
      "mitigation_timeout": 300,
      "counting_expression": "(http.request.method eq \"GET\")"
    }
  }'
```

**✅ Module 4 Completion Check:**
- [ ] DDoS detection system operational
- [ ] Layer 7 protection implemented
- [ ] Advanced rate limiting configured
- [ ] Traffic analysis and monitoring active

---

## 📊 Module 5: Monitoring & Response (50 minutes)

### 5.1 Security Analytics Dashboard

**Learning Goal**: Create comprehensive security monitoring.

**Security Analytics Worker:**

```javascript
// security-analytics/src/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/security-dashboard') {
      return generateSecurityDashboard(request, env);
    }

    if (url.pathname.startsWith('/api/security/')) {
      return handleSecurityAPI(request, env);
    }

    return handleRequest(request, env);
  }
};

async function generateSecurityDashboard(request, env) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Gather security metrics
  const metrics = await Promise.all([
    getSecurityMetrics(env, oneDayAgo, now, '24h'),
    getSecurityMetrics(env, oneWeekAgo, now, '7d'),
    getThreatDistribution(env, oneDayAgo, now),
    getTopAttackSources(env, oneDayAgo, now),
    getSecurityTrends(env, oneWeekAgo, now)
  ]);

  const [dayMetrics, weekMetrics, threatDist, topSources, trends] = metrics;

  return new Response(generateDashboardHTML({
    dayMetrics,
    weekMetrics,
    threatDistribution: threatDist,
    topAttackSources: topSources,
    securityTrends: trends
  }), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function getSecurityMetrics(env, startTime, endTime, period) {
  const logs = await getSecurityLogs(env, startTime, endTime);

  const metrics = {
    period,
    totalRequests: logs.length,
    blockedRequests: logs.filter(log => log.action === 'block').length,
    challengedRequests: logs.filter(log => log.action === 'challenge').length,
    rateLimitedRequests: logs.filter(log => log.action === 'rate_limit').length,
    uniqueIPs: new Set(logs.map(log => log.ip)).size,
    topCountries: getTopCountries(logs),
    averageScore: logs.length > 0 ? logs.reduce((sum, log) => sum + log.score, 0) / logs.length : 0
  };

  return metrics;
}

async function getThreatDistribution(env, startTime, endTime) {
  const logs = await getSecurityLogs(env, startTime, endTime);

  const distribution = {};
  logs.forEach(log => {
    log.indicators.forEach(indicator => {
      distribution[indicator] = (distribution[indicator] || 0) + 1;
    });
  });

  return Object.entries(distribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([threat, count]) => ({ threat, count }));
}

async function getTopAttackSources(env, startTime, endTime) {
  const logs = await getSecurityLogs(env, startTime, endTime);

  const ipCounts = {};
  logs.forEach(log => {
    if (log.action !== 'allow') {
      ipCounts[log.ip] = (ipCounts[log.ip] || 0) + 1;
    }
  });

  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));
}

function generateDashboardHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Analytics Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: system-ui; margin: 0; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 1rem; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .metric-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2rem; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; margin-top: 0.5rem; }
        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
        .chart-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .table-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ecf0f1; }
        th { background: #f8f9fa; font-weight: 600; }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-danger { color: #e74c3c; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛡️ Security Analytics Dashboard</h1>
        <p>Real-time security monitoring and threat analysis</p>
      </div>

      <div class="container">
        <!-- Key Metrics -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${data.dayMetrics.totalRequests.toLocaleString()}</div>
            <div class="metric-label">Total Requests (24h)</div>
          </div>
          <div class="metric-card">
            <div class="metric-value status-${data.dayMetrics.blockedRequests > 100 ? 'danger' : 'good'}">
              ${data.dayMetrics.blockedRequests.toLocaleString()}
            </div>
            <div class="metric-label">Blocked Requests</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.dayMetrics.uniqueIPs.toLocaleString()}</div>
            <div class="metric-label">Unique IPs</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.dayMetrics.averageScore.toFixed(1)}</div>
            <div class="metric-label">Average Security Score</div>
          </div>
        </div>

        <!-- Charts -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3>Threat Distribution</h3>
            <canvas id="threatChart" width="400" height="200"></canvas>
          </div>
          <div class="chart-card">
            <h3>Security Trends (7 days)</h3>
            <canvas id="trendsChart" width="400" height="200"></canvas>
          </div>
        </div>

        <!-- Top Attack Sources -->
        <div class="table-card">
          <h3>Top Attack Sources (24h)</h3>
          <table>
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Attack Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.topAttackSources.map(source => `
                <tr>
                  <td>${source.ip}</td>
                  <td>${source.count}</td>
                  <td><span class="status-${source.count > 50 ? 'danger' : source.count > 20 ? 'warning' : 'good'}">
                    ${source.count > 50 ? 'High' : source.count > 20 ? 'Medium' : 'Low'}
                  </span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        // Threat Distribution Chart
        const threatCtx = document.getElementById('threatChart').getContext('2d');
        new Chart(threatCtx, {
          type: 'doughnut',
          data: {
            labels: ${JSON.stringify(data.threatDistribution.map(d => d.threat))},
            datasets: [{
              data: ${JSON.stringify(data.threatDistribution.map(d => d.count))},
              backgroundColor: ['#e74c3c', '#f39c12', '#3498db', '#2ecc71', '#9b59b6']
            }]
          }
        });

        // Security Trends Chart
        const trendsCtx = document.getElementById('trendsChart').getContext('2d');
        new Chart(trendsCtx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(data.securityTrends.map(t => t.date))},
            datasets: [{
              label: 'Blocked Requests',
              data: ${JSON.stringify(data.securityTrends.map(t => t.blocked))},
              borderColor: '#e74c3c',
              fill: false
            }, {
              label: 'Challenged Requests',
              data: ${JSON.stringify(data.securityTrends.map(t => t.challenged))},
              borderColor: '#f39c12',
              fill: false
            }]
          }
        });
      </script>
    </body>
    </html>
  `;
}

async function getSecurityLogs(env, startTime, endTime) {
  const logs = [];
  const cursor = await env.SECURITY_LOGS.list({
    limit: 10000,
    prefix: 'security:'
  });

  for (const key of cursor.keys) {
    const timestamp = parseInt(key.name.split(':')[1]);
    if (timestamp >= startTime && timestamp <= endTime) {
      const log = await env.SECURITY_LOGS.get(key.name);
      if (log) {
        logs.push(JSON.parse(log));
      }
    }
  }

  return logs;
}
```

### 5.2 Incident Response Automation

**Learning Goal**: Implement automated incident response procedures.

**Incident Response Worker:**

```javascript
// incident-response/src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/incident-trigger') {
      return handleIncidentTrigger(request, env, ctx);
    }

    if (url.pathname === '/incidents') {
      return getIncidentHistory(request, env);
    }

    return handleRequest(request, env);
  }
};

async function handleIncidentTrigger(request, env, ctx) {
  const analysis = await analyzeRequest(request, env);

  // Check if this is a high-severity incident
  if (analysis.severity === 'CRITICAL') {
    await handleCriticalIncident(analysis, env, ctx);
  } else if (analysis.severity === 'HIGH') {
    await handleHighSeverityIncident(analysis, env, ctx);
  } else if (analysis.severity === 'MEDIUM') {
    await handleMediumSeverityIncident(analysis, env, ctx);
  }

  return new Response(JSON.stringify({
    incidentCreated: true,
    severity: analysis.severity,
    incidentId: analysis.incidentId
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleCriticalIncident(analysis, env, ctx) {
  const incidentId = crypto.randomUUID();

  // 1. Immediate response actions
  ctx.waitUntil([
    // Block the attacking IP
    blockAttackingIP(analysis.ip, env),

    // Escalate to security team
    notifySecurityTeam(analysis, 'CRITICAL', env),

    // Log incident
    logIncident(incidentId, analysis, 'CRITICAL', env),

    // Enable emergency mode
    enableEmergencyMode(env),

    // Create support ticket
    createSupportTicket(analysis, env)
  ]);

  console.log(`CRITICAL Incident ${incidentId}: ${analysis.ip} - ${analysis.reasons.join(', ')}`);
}

async function handleHighSeverityIncident(analysis, env, ctx) {
  const incidentId = crypto.randomUUID();

  ctx.waitUntil([
    // Challenge the IP
    challengeAttackingIP(analysis.ip, env),

    // Notify security team
    notifySecurityTeam(analysis, 'HIGH', env),

    // Log incident
    logIncident(incidentId, analysis, 'HIGH', env),

    // Increase monitoring
    increaseMonitoring(analysis.ip, env)
  ]);

  console.log(`HIGH Incident ${incidentId}: ${analysis.ip} - ${analysis.reasons.join(', ')}`);
}

async function blockAttackingIP(ip, env) {
  // Add to IP blacklist KV
  await env.IP_BLACKLIST.put(ip, JSON.stringify({
    blockedAt: Date.now(),
    reason: 'Automated incident response',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }), { expirationTtl: 24 * 60 * 60 });

  // Update WAF rules to include this IP
  await updateWAFIPBlock(ip);
}

async function updateWAFIPBlock(ip) {
  // Add IP to WAF block list via API
  const ZONE_ID = 'your_zone_id';
  const API_TOKEN = 'your_api_token';

  await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/access_rules/rules`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mode: 'block',
      configuration: {
        target: 'ip',
        value: ip
      },
      notes: 'Automated incident response block'
    })
  });
}

async function notifySecurityTeam(analysis, severity, env) {
  const notification = {
    timestamp: new Date().toISOString(),
    severity,
    incidentId: crypto.randomUUID(),
    analysis: {
      ip: analysis.ip,
      score: analysis.score,
      reasons: analysis.reasons,
      requestCount: analysis.requestCount,
      timeframe: analysis.timeframe
    },
    recommendedActions: getRecommendedActions(severity, analysis)
  };

  // Send to webhook (Slack, Teams, etc.)
  if (env.SECURITY_WEBHOOK) {
    await fetch(env.SECURITY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${severity} Security Incident Detected`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*IP Address:* ${analysis.ip}\n*Security Score:* ${analysis.score}\n*Reasons:* ${analysis.reasons.join(', ')}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Block IP' },
                url: `https://dashboard.cloudflare.com/firewall/access_rules/`
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Investigate' },
                url: `https://your-dashboard.com/incidents/${notification.incidentId}`
              }
            ]
          }
        ]
      })
    });
  }

  // Store notification for audit trail
  await env.SECURITY_NOTIFICATIONS.put(
    `notification:${Date.now()}:${notification.incidentId}`,
    JSON.stringify(notification),
    { expirationTtl: 30 * 24 * 60 * 60 } // Keep for 30 days
  );
}

function getRecommendedActions(severity, analysis) {
  const actions = [];

  if (severity === 'CRITICAL') {
    actions.push('Block IP immediately');
    actions.push('Enable emergency mode');
    actions.push('Review all recent requests from this IP');
    actions.push('Check for other affected systems');
    actions.push('Notify executive team');
  } else if (severity === 'HIGH') {
    actions.push('Challenge IP requests');
    actions.push('Increase monitoring');
    actions.push('Review attack patterns');
    actions.push('Update WAF rules if needed');
  } else if (severity === 'MEDIUM') {
    actions.push('Monitor IP closely');
    actions.push('Consider rate limiting');
    actions.push('Review security logs');
    actions.push('Update threat intelligence');
  }

  return actions;
}

async function enableEmergencyMode(env) {
  // Enable stricter security settings
  const emergencyConfig = {
    enabled: true,
    enabledAt: Date.now(),
    settings: {
      rateLimitReduction: 0.5, // Reduce rate limits by 50%
      blockHighRiskCountries: true,
      enableStrictWAF: true,
      requireMFA: true
    }
  };

  await env.EMERGENCY_MODE.put('config', JSON.stringify(emergencyConfig));

  console.log('Emergency mode enabled due to critical security incident');
}

async function logIncident(incidentId, analysis, severity, env) {
  const incident = {
    incidentId,
    timestamp: Date.now(),
    severity,
    analysis: {
      ip: analysis.ip,
      score: analysis.score,
      reasons: analysis.reasons,
      requestCount: analysis.requestCount
    },
    response: {
      action: getActionForSeverity(severity),
      automated: true
    }
  };

  await env.INCIDENT_LOGS.put(
    `incident:${incidentId}`,
    JSON.stringify(incident),
    { expirationTtl: 90 * 24 * 60 * 60 } // Keep for 90 days
  );
}

function getActionForSeverity(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'BLOCK_IP_ENABLE_EMERGENCY';
    case 'HIGH':
      return 'CHALLENGE_IP_ESCALATE';
    case 'MEDIUM':
      return 'MONITOR_ESCALATE_IF_PERSISTENT';
    default:
      return 'LOG_ONLY';
  }
}
```

**✅ Module 5 Completion Check:**
- [ ] Security analytics dashboard operational
- [ ] Real-time threat monitoring active
- [ ] Incident response automation implemented
- [ ] Security notifications and alerts working

---

## 🎯 Final Assessment

### Comprehensive Security Exercise

Create a complete security implementation that demonstrates all learned concepts:

1. **Multi-layered Security**: Implement WAF rules, bot detection, and custom security logic
2. **Access Control**: Set up Cloudflare Access with MFA
3. **DDoS Protection**: Configure advanced rate limiting and attack detection
4. **Monitoring**: Deploy comprehensive analytics and incident response

**Security Implementation Checklist:**

```bash
#!/bin/bash
# deploy-security-stack.sh

echo "🛡️ Deploying Security Stack"

# 1. Deploy WAF rules
echo "Configuring WAF rules..."
./create-waf-rules.sh

# 2. Deploy security assessment worker
echo "Deploying security worker..."
cd security-assessment
wrangler deploy --env production

# 3. Deploy access control
echo "Deploying access control..."
cd ../access-gateway
wrangler deploy --env production

# 4. Deploy DDoS protection
echo "Deploying DDoS protection..."
cd ../ddos-protection
wrangler deploy --env production

# 5. Deploy security analytics
echo "Deploying security analytics..."
cd ../security-analytics
wrangler deploy --env production

# 6. Deploy incident response
echo "Deploying incident response..."
cd ../incident-response
wrangler deploy --env production

echo "✅ Security stack deployed successfully!"
echo "Dashboard: https://security-analytics.yourdomain.com/security-dashboard"
```

### Knowledge Validation

Test your security knowledge:

1. **Threat Modeling**: Identify the top 3 threats for your application type
2. **Defense Strategy**: Design a multi-layered defense strategy
3. **Incident Response**: Create an incident response plan
4. **Compliance**: Map your security controls to compliance frameworks
5. **Metrics**: Define key security metrics and thresholds

---

## 🚀 Next Steps

Congratulations! You've completed the Security Learning Path. You now have:

✅ **Enterprise-grade security architecture** implemented
✅ **Advanced WAF and bot protection** configured
✅ **Comprehensive access control** with MFA
✅ **DDoS protection** with automated response
✅ **Security monitoring** and incident response

### Continue Your Security Journey:

1. **Performance Path** → Optimize your secure applications for performance
2. **Developer Path** → Advanced Workers and serverless security
3. **Enterprise Path** → Compliance, audit, and enterprise security management

### Advanced Security Topics:

- **Zero Trust Architecture**: Implement comprehensive zero-trust security
- **Threat Intelligence**: Integrate external threat feeds
- **Compliance Automation**: Automated compliance checking and reporting
- **Security Orchestration**: SOAR integration and automation

### Quick References:

- **Emergency Commands**: [Emergency Security Commands](../quick-reference/emergency-commands.md)
- **Security Hardening**: [Security Hardening Checklist](../quick-reference/security-hardening.md)
- **Compliance Guide**: [Enterprise Compliance Documentation](../reference/compliance-reference.md)

---

**🎓 Security Mastery Achieved!** You're ready to implement enterprise-grade security on Cloudflare's platform.