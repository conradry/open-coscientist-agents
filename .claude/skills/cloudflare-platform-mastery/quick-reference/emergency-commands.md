# Emergency Commands

> **Critical commands for Cloudflare deployment emergencies and disaster recovery**

## 🚨 Immediate Response (First 5 Minutes)

### Service Status Check
```bash
# Check Cloudflare system status
curl -s https://www.cloudflarestatus.com/api/v2/status.json

# Check worker status
wrangler deployments list

# Check Pages deployment status
wrangler pages deployment list --project-name your-project

# Test global connectivity
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com
```

### Quick Health Check
```bash
# Comprehensive health check script
#!/bin/bash
echo "🔍 Emergency Health Check - $(date)"

# 1. Authentication Check
if wrangler whoami > /dev/null 2>&1; then
    echo "✅ Wrangler authentication: OK"
else
    echo "❌ Wrangler authentication: FAILED"
    wrangler auth login
fi

# 2. Worker Status
WORKER_STATUS=$(wrangler deployments list 2>/dev/null | grep "latest" | head -1)
if [ -n "$WORKER_STATUS" ]; then
    echo "✅ Worker status: $WORKER_STATUS"
else
    echo "❌ Worker status: No deployments found"
fi

# 3. DNS Resolution
DNS_CHECK=$(dig +short your-domain.com 2>/dev/null)
if [ -n "$DNS_CHECK" ]; then
    echo "✅ DNS resolution: $DNS_CHECK"
else
    echo "❌ DNS resolution: FAILED"
fi

# 4. SSL Certificate
SSL_CHECK=$(echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ -n "$SSL_CHECK" ]; then
    echo "✅ SSL certificate: OK"
    echo "   $SSL_CHECK"
else
    echo "❌ SSL certificate: FAILED"
fi

# 5. Basic Connectivity
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com 2>/dev/null)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ HTTP connectivity: OK ($HTTP_STATUS)"
else
    echo "❌ HTTP connectivity: FAILED ($HTTP_STATUS)"
fi

echo "🏁 Health check completed at $(date)"
```

## 🔧 Worker Emergency Commands

### Emergency Worker Rollback
```bash
# List all deployments
wrangler deployments list

# Rollback to previous deployment
wrangler rollback

# Rollback to specific deployment ID
wrangler rollback --to-id deployment_id

# Force rollback to last known good version
wrangler deploy --compatibility-date 2024-01-01 --env production

# Emergency disable worker
wrangler delete worker-name --env production
```

### Worker Debugging
```bash
# Real-time log monitoring
wrangler tail --format=pretty

# Monitor specific worker
wrangler tail worker-name

# Filter by error level
wrangler tail | grep "ERROR"

# Export logs for analysis
wrangler tail --format=json > worker-logs.json

# Check worker configuration
cat wrangler.toml

# Validate configuration
wrangler validate

# Test worker locally
wrangler dev --local
```

### Emergency Worker Fix
```bash
# Deploy minimal emergency worker
cat > emergency-worker.js << 'EOF'
export default {
  async fetch(request) {
    return new Response('Emergency mode - Service temporarily unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': '300'
      }
    });
  }
};
EOF

# Deploy emergency worker
wrangler deploy --compatibility-date 2024-01-01

# Monitor deployment
wrangler tail
```

## 🌐 DNS Emergency Commands

### DNS Troubleshooting
```bash
# Check DNS from multiple sources
dig your-domain.com
dig @8.8.8.8 your-domain.com
dig @1.1.1.1 your-domain.com
dig @208.67.222.222 your-domain.com

# Check DNS propagation worldwide
for server in 8.8.8.8 1.1.1.1 208.67.222.222 9.9.9.9; do
    echo "Testing with server $server:"
    dig @$server your-domain.com +short
    echo "---"
done

# Check specific DNS record types
dig A your-domain.com
dig AAAA your-domain.com
dig CNAME your-domain.com
dig MX your-domain.com
dig TXT your-domain.com

# Check nameservers
dig NS your-domain.com

# Check SOA record
dig SOA your-domain.com

# Trace DNS path
dig +trace your-domain.com
```

### Emergency DNS Changes
```bash
# Quick DNS record change via API
ZONE_ID="your_zone_id"
API_TOKEN="your_api_token"

# Emergency IP change
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/record_id" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "your-domain.com",
    "content": "192.168.1.100",
    "ttl": 120
  }'

# Emergency failover to backup server
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/record_id" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "your-domain.com",
    "content": "backup-server-ip",
    "ttl": 60,
    "proxied": false
  }'
```

## 🔒 Security Emergency Commands

### Immediate Threat Response
```bash
# Block malicious IP via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/your_zone_id/firewall/access_rules/rules" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "mode": "block",
    "configuration": {
      "target": "ip",
      "value": "malicious_ip_address"
    },
    "notes": "Emergency block - $(date)"
  }'

# Enable under attack mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/security_level" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":"under_attack"}'

# Emergency WAF rule creation
curl -X POST "https://api.cloudflare.com/client/v4/zones/your_zone_id/firewall/rules" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Emergency block - $(date)",
    "action": "block",
    "filter": {
      "expression": "(ip.src eq malicious_ip_address)"
    }
  }'
```

### SSL/TLS Emergency
```bash
# Force HTTPS only
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/ssl" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":"strict"}'

# Enable HSTS
curl -X POST "https://api.cloudflare.com/client/v4/zones/your_zone_id/security/hsts" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "enabled": true,
    "max_age": 31536000,
    "include_subdomains": true,
    "preload": true
  }'

# Disable vulnerable TLS versions
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/min_tls_version" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{"value":"1.2"}'
```

## 📊 Pages Emergency Commands

### Pages Deployment Issues
```bash
# List Pages projects
wrangler pages project list

# Check deployment status
wrangler pages deployment list --project-name your-project

# Rollback to previous deployment
wrangler pages deployment rollback your-project deployment_id

# Emergency redeployment from dist
wrangler pages deploy dist --project-name your-project --compatibility-date 2024-01-01

# Delete broken deployment
wrangler pages deployment delete your-project deployment_id

# Check build logs
wrangler pages deployment create your-project --commit-hash commit_hash --branch branch_name
```

### Pages Configuration Emergency
```bash
# Emergency redirect setup
cat > _redirects << 'EOF'
/* /index.html 200
/api/* https://backup-api.example.com/:splat 302
/admin/* https://maintenance.example.com/ 503
EOF

# Emergency headers setup
cat > _headers << 'EOF'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
EOF

# Deploy emergency configuration
wrangler pages deploy . --project-name your-project
```

## 🗄️ Database Emergency Commands

### D1 Database Issues
```bash
# List D1 databases
wrangler d1 list

# Check database backup
wrangler d1 backup create database_name

# Emergency data restore
wrangler d1 backup restore database_name backup_id

# Check database migrations
wrangler d1 migrations list database_name

# Emergency rollback migration
wrangler d1 migrations rollback database_name migration_id

# Database health check
wrangler d1 execute database_name --command "SELECT COUNT(*) as total FROM users"
```

### KV Storage Emergency
```bash
# List KV namespaces
wrangler kv:namespace list

# Emergency backup KV data
wrangler kv:namespace list | grep "binding" | cut -d'"' -f8 | while read namespace; do
    echo "Backing up namespace: $namespace"
    wrangler kv:key list --namespace-id=$namespace --prefix="" > kv_backup_$namespace.json
done

# Emergency KV data restore (from backup)
wrangler kv:key upload --namespace-id=namespace_id backup_file.json

# Check KV health
wrangler kv:key get --namespace-id=namespace_id health_check
```

## 📈 Monitoring Emergency Commands

### Real-time Monitoring
```bash
# Enable emergency logging
wrangler tail --format=json > emergency_logs.json &

# Monitor specific error patterns
wrangler tail | grep -E "(ERROR|CRITICAL|FATAL)"

# Check response times
while true; do
    echo "$(date): $(curl -w '%{time_total}' -o /dev/null -s https://your-domain.com)"
    sleep 10
done

# Monitor global response times
for location in "us-east" "us-west" "eu-west" "asia-southeast"; do
    echo "Testing from $location:"
    curl -H "CF-IPCountry: US" -w '%{time_total}\n' -o /dev/null -s https://your-domain.com
done
```

### Emergency Alert Setup
```bash
# Create emergency monitoring script
cat > emergency_monitor.sh << 'EOF'
#!/bin/bash
ALERT_EMAIL="admin@yourdomain.com"
DOMAIN="your-domain.com"

while true; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" https://$DOMAIN)

    if [ "$HTTP_STATUS" != "200" ] || [ $(echo "$RESPONSE_TIME > 5.0" | bc -l) -eq 1 ]; then
        echo "🚨 EMERGENCY: $DOMAIN - Status: $HTTP_STATUS, Time: ${RESPONSE_TIME}s" | \
        mail -s "Cloudflare Emergency Alert" $ALERT_EMAIL
    fi

    sleep 30
done
EOF

chmod +x emergency_monitor.sh
./emergency_monitor.sh &
```

## 🔐 Access Control Emergency

### Cloudflare Access Emergency
```bash
# List Access applications
curl -X GET "https://api.cloudflare.com/client/v4/accounts/your_account_id/access/apps" \
  -H "Authorization: Bearer your_api_token"

# Emergency disable Access
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/access/apps/app_id" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "paused": true
  }'

# Emergency create bypass policy
curl -X POST "https://api.cloudflare.com/client/v4/accounts/your_account_id/access/apps/app_id/policies" \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Emergency Admin Bypass",
    "decision": "allow",
    "include": [
      {
        "email": {
          "email": "admin@yourdomain.com"
        }
      }
    ]
  }'
```

## 📋 Emergency Checklist

### Phase 1: Immediate Assessment (0-5 minutes)
```bash
# Run this script immediately
#!/bin/bash
echo "🚨 EMERGENCY RESPONSE - Phase 1: Assessment"

# 1. Check service status
echo "1. Service Status:"
curl -s https://www.cloudflarestatus.com/api/v2/status.json | jq -r '.status.description'

# 2. Check your application
echo "2. Application Status:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com)
echo "   HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" != "200" ]; then
    echo "   🚨 APPLICATION IS DOWN!"
fi

# 3. Check worker status
echo "3. Worker Status:"
wrangler deployments list | tail -5

# 4. Check DNS
echo "4. DNS Status:"
DNS_RESULT=$(dig +short your-domain.com)
echo "   DNS Resolution: $DNS_RESULT"

# 5. Check SSL
echo "5. SSL Status:"
SSL_RESULT=$(echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates)
echo "   SSL Certificate: $SSL_RESULT"

echo "🏁 Assessment completed at $(date)"
```

### Phase 2: Stabilization (5-15 minutes)
```bash
# Stabilization commands based on assessment
if [ "$HTTP_STATUS" != "200" ]; then
    echo "🛠️  Deploying emergency worker..."
    wrangler deploy emergency-worker.js --compatibility-date 2024-01-01
fi

# Enable enhanced security
echo "🔒 Enabling emergency security..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/your_zone_id/settings/security_level" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value":"under_attack"}'

# Start emergency monitoring
echo "📊 Starting emergency monitoring..."
wrangler tail --format=pretty > emergency_$(date +%s).log &
```

### Phase 3: Recovery (15+ minutes)
```bash
# Recovery checklist
echo "🔄 Recovery Checklist:"
echo "□ Application responding normally"
echo "□ All tests passing"
echo "□ Security review completed"
echo "□ Post-mortem documentation started"
echo "□ Monitoring restored to normal levels"
echo "□ Stakeholders notified"
```

## 🆘 External Support

### Cloudflare Support
```bash
# Check service status
curl https://www.cloudflarestatus.com

# Support contact information
echo "Cloudflare Support:"
echo "- Status Page: https://www.cloudflarestatus.com"
echo "- Support: https://support.cloudflare.com"
echo "- Twitter: @CloudflareSys"
echo "- Discord: https://discord.gg/cloudflaredev"
```

### Community Resources
```bash
# Get help from community
echo "Community Resources:"
echo "- Discord: https://discord.gg/cloudflaredev"
echo "- Forums: https://community.cloudflare.com"
echo "- Stack Overflow: [cloudflare-workers]"
echo "- GitHub Issues: https://github.com/cloudflare/workers-sdk/issues"
```

## 📞 Emergency Contacts Script

```bash
# Create emergency notification script
cat > emergency_notify.sh << 'EOF'
#!/bin/bash

# Configuration
SLACK_WEBHOOK="your_slack_webhook_url"
EMAIL_RECIPIENTS="admin@yourdomain.com,ops@yourdomain.com"
SMS_API_KEY="your_sms_api_key"
SMS_NUMBERS="+1234567890,+0987654321"

# Message template
MESSAGE="🚨 Cloudflare Emergency Alert for $(hostname)

Time: $(date)
Issue: $1
Domain: your-domain.com
Status: $2

Immediate action required. Check emergency dashboard."

# Send to Slack
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$MESSAGE\"}" \
        $SLACK_WEBHOOK
fi

# Send email
if [ -n "$EMAIL_RECIPIENTS" ]; then
    echo "$MESSAGE" | mail -s "🚨 CLOUDFLARE EMERGENCY" $EMAIL_RECIPIENTS
fi

# Send SMS (example with Twilio)
if [ -n "$SMS_API_KEY" ] && [ -n "$SMS_NUMBERS" ]; then
    for number in $SMS_NUMBERS; do
        curl -X POST "https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json" \
            --data-urlencode "To=$number" \
            --data-urlencode "From=+1555123456" \
            --data-urlencode "Body=$MESSAGE" \
            -u "YOUR_SID:$SMS_API_KEY"
    done
fi
EOF

chmod +x emergency_notify.sh
```

**Usage:**
```bash
# Send emergency notification
./emergency_notify.sh "Worker deployment failed" "Service degraded"

# Automatic monitoring with alerts
while true; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com)
    if [ "$HTTP_STATUS" != "200" ]; then
        ./emergency_notify.sh "Service down - HTTP $HTTP_STATUS" "Critical"
        break
    fi
    sleep 60
done
```

---

**Remember**: During emergencies, stay calm, follow the checklist methodically, and communicate clearly with your team. Document everything for post-incident review.