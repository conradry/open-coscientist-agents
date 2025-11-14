#!/usr/bin/env node

/**
 * Cloudflare Real-Time Performance and Error Monitoring Tool
 * Real-time monitoring with alerts and dashboard generation
 */

const { performance } = require('perf_hooks');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Real-time monitoring configuration
const METRICS_CONFIG = {
    // Monitoring targets
    targets: [
        {
            name: 'Main Application',
            url: 'https://example.com',
            type: 'web',
            interval: 30000, // 30 seconds
            critical: true,
            healthEndpoints: ['/', '/health', '/api/health']
        },
        {
            name: 'API Service',
            url: 'https://api.example.com',
            type: 'api',
            interval: 15000, // 15 seconds
            critical: true,
            healthEndpoints: ['/health', '/status']
        },
        {
            name: 'CDN Assets',
            url: 'https://cdn.example.com',
            type: 'cdn',
            interval: 60000, // 1 minute
            critical: false,
            healthEndpoints: ['/styles/main.css']
        }
    ],

    // Metrics collection
    collection: {
        responseTime: true,
        statusCodes: true,
        headers: true,
        bodySize: true,
        sslInfo: true,
        dnsTime: true,
        connectionTime: true,
        firstByteTime: true,
        downloadTime: true
    },

    // Alert thresholds
    alerts: {
        responseTime: {
            warning: 2000, // 2 seconds
            critical: 5000  // 5 seconds
        },
        errorRate: {
            warning: 5,  // 5%
            critical: 10 // 10%
        },
        availability: {
            warning: 99,  // 99%
            critical: 95  // 95%
        },
        consecutiveFailures: {
            warning: 3,
            critical: 5
        }
    },

    // Notification channels
    notifications: {
        webhook: {
            enabled: false,
            url: '',
            timeout: 5000
        },
        slack: {
            enabled: false,
            webhook: '',
            channel: '#alerts'
        },
        email: {
            enabled: false,
            smtp: {
                host: '',
                port: 587,
                secure: false,
                auth: {
                    user: '',
                    pass: ''
                }
            },
            from: '',
            to: []
        }
    },

    // Dashboard configuration
    dashboard: {
        enabled: true,
        port: 3001,
        autoRefresh: 5000, // 5 seconds
        historyRetention: 86400000, // 24 hours
        exportFormat: 'json', // json, csv, prometheus
        realTimeUpdates: true
    },

    // Data storage
    storage: {
        inMemory: true,
        file: true,
        filePath: './metrics-data.json',
        compression: true,
        rotationSize: 100 * 1024 * 1024 // 100MB
    },

    // Performance monitoring
    performance: {
        collectSystemMetrics: true,
        collectProcessMetrics: true,
        collectMemoryMetrics: true,
        collectCpuMetrics: true,
        systemCheckInterval: 60000 // 1 minute
    }
};

// Metrics Collector class
class MetricsCollector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { ...METRICS_CONFIG, ...config };
        this.isRunning = false;
        this.targets = new Map();
        this.metricsData = new Map();
        this.alertStates = new Map();
        this.startTime = Date.now();
        this.totalRequests = 0;
        this.totalErrors = 0;

        // Initialize targets
        this.initializeTargets();

        // Setup dashboard if enabled
        if (this.config.dashboard.enabled) {
            this.setupDashboard();
        }
    }

    /**
     * Initialize monitoring targets
     */
    initializeTargets() {
        this.config.targets.forEach(target => {
            this.targets.set(target.name, {
                ...target,
                lastCheck: null,
                consecutiveFailures: 0,
                metrics: {
                    responseTime: [],
                    statusCodes: new Map(),
                    errors: [],
                    availability: 100,
                    uptime: 100
                }
            });
        });
    }

    /**
     * Start monitoring
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Monitoring is already running');
            return;
        }

        console.log('🚀 Starting real-time monitoring...');
        this.isRunning = true;
        this.startTime = Date.now();

        // Start monitoring each target
        this.targets.forEach((target, name) => {
            this.startTargetMonitoring(name);
        });

        // Start system performance monitoring
        if (this.config.performance.collectSystemMetrics) {
            this.startSystemMonitoring();
        }

        // Start data cleanup
        this.startDataCleanup();

        console.log(`✅ Monitoring started for ${this.targets.size} targets`);
        this.emit('started');
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Monitoring is not running');
            return;
        }

        console.log('🛑 Stopping monitoring...');
        this.isRunning = false;

        // Clear all intervals
        if (this.monitorIntervals) {
            this.monitorIntervals.forEach(interval => clearInterval(interval));
        }

        if (this.systemInterval) {
            clearInterval(this.systemInterval);
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Save final metrics
        this.saveMetrics();

        console.log('✅ Monitoring stopped');
        this.emit('stopped');
    }

    /**
     * Start monitoring a specific target
     */
    startTargetMonitoring(targetName) {
        const target = this.targets.get(targetName);
        if (!target) {
            console.error(`❌ Target not found: ${targetName}`);
            return;
        }

        console.log(`📡 Starting monitoring for: ${targetName}`);

        // Initial check
        this.checkTarget(targetName);

        // Set up interval monitoring
        const interval = setInterval(() => {
            if (this.isRunning) {
                this.checkTarget(targetName);
            }
        }, target.interval);

        if (!this.monitorIntervals) {
            this.monitorIntervals = new Map();
        }
        this.monitorIntervals.set(targetName, interval);
    }

    /**
     * Check a single target
     */
    async checkTarget(targetName) {
        const target = this.targets.get(targetName);
        if (!target) return;

        const checkStart = performance.now();
        let metrics = {
            timestamp: Date.now(),
            responseTime: 0,
            statusCode: 0,
            success: false,
            error: null,
            bodySize: 0,
            headers: {},
            sslInfo: null,
            dnsTime: 0,
            connectionTime: 0,
            firstByteTime: 0,
            downloadTime: 0
        };

        try {
            // Perform health check
            const results = await this.performHealthCheck(target);
            metrics = { ...metrics, ...results };

            const checkEnd = performance.now();
            metrics.responseTime = checkEnd - checkStart;

            // Update target metrics
            this.updateTargetMetrics(targetName, metrics);

            // Check for alerts
            this.checkAlerts(targetName, metrics);

            // Emit metrics event
            this.emit('metrics', {
                target: targetName,
                metrics
            });

        } catch (error) {
            metrics.success = false;
            metrics.error = error.message;
            metrics.statusCode = 0;

            const checkEnd = performance.now();
            metrics.responseTime = checkEnd - checkStart;

            // Update error metrics
            this.updateTargetMetrics(targetName, metrics);

            // Check for error alerts
            this.checkErrorAlerts(targetName, metrics);

            // Emit error event
            this.emit('error', {
                target: targetName,
                error: error.message,
                metrics
            });

            console.error(`❌ Target ${targetName} check failed:`, error.message);
        }

        // Update global counters
        this.totalRequests++;
        if (!metrics.success) {
            this.totalErrors++;
        }

        target.lastCheck = Date.now();
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck(target) {
        const results = {
            statusCode: 0,
            headers: {},
            bodySize: 0,
            sslInfo: null,
            dnsTime: 0,
            connectionTime: 0,
            firstByteTime: 0,
            downloadTime: 0
        };

        // Check primary endpoint and health endpoints
        const endpointsToCheck = target.healthEndpoints.length > 0 ?
            target.healthEndpoints : ['/'];

        let allHealthy = true;
        let fastestResponse = Infinity;

        for (const endpoint of endpointsToCheck) {
            try {
                const url = target.url + endpoint;
                const endpointResult = await this.makeDetailedRequest(url);

                // Use fastest response for metrics
                if (endpointResult.responseTime < fastestResponse) {
                    fastestResponse = endpointResult.responseTime;
                    results.statusCode = endpointResult.statusCode;
                    results.headers = endpointResult.headers;
                    results.bodySize = endpointResult.bodySize;
                    results.sslInfo = endpointResult.sslInfo;
                    results.dnsTime = endpointResult.dnsTime;
                    results.connectionTime = endpointResult.connectionTime;
                    results.firstByteTime = endpointResult.firstByteTime;
                    results.downloadTime = endpointResult.downloadTime;
                }

                // Check if endpoint is healthy
                if (endpointResult.statusCode >= 400) {
                    allHealthy = false;
                }

            } catch (error) {
                allHealthy = false;
                console.warn(`⚠️ Health check failed for ${endpoint}:`, error.message);
            }
        }

        return {
            success: allHealthy && results.statusCode < 400,
            statusCode: results.statusCode,
            headers: results.headers,
            bodySize: results.bodySize,
            sslInfo: results.sslInfo,
            dnsTime: results.dnsTime,
            connectionTime: results.connectionTime,
            firstByteTime: results.firstByteTime,
            downloadTime: results.downloadTime
        };
    }

    /**
     * Make detailed HTTP request with timing
     */
    async makeDetailedRequest(url) {
        const urlObj = new URL(url);
        const timing = {
            dnsStart: 0,
            dnsEnd: 0,
            connectStart: 0,
            connectEnd: 0,
            firstByteStart: 0,
            firstByteEnd: 0,
            downloadStart: 0,
            downloadEnd: 0
        };

        return new Promise((resolve, reject) => {
            const client = urlObj.protocol === 'https:' ? https : http;

            timing.dnsStart = performance.now();

            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Cloudflare-Metrics/1.0',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: 10000
            }, (res) => {
                timing.connectEnd = performance.now();
                timing.firstByteStart = performance.now();

                let data = '';
                let bodySize = 0;

                res.on('data', chunk => {
                    data += chunk;
                    bodySize += Buffer.byteLength(chunk);
                    if (timing.downloadStart === 0) {
                        timing.downloadStart = performance.now();
                    }
                });

                res.on('end', () => {
                    timing.downloadEnd = performance.now();

                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        bodySize,
                        responseTime: timing.downloadEnd - timing.dnsStart,
                        dnsTime: timing.connectEnd - timing.dnsStart,
                        connectionTime: timing.connectEnd - timing.connectStart,
                        firstByteTime: timing.firstByteEnd - timing.firstByteStart,
                        downloadTime: timing.downloadEnd - timing.downloadStart,
                        sslInfo: res.socket.getPeerCertificate ? {
                            subject: res.socket.getPeerCertificate().subject,
                            issuer: res.socket.getPeerCertificate().issuer,
                            valid_from: res.socket.getPeerCertificate().valid_from,
                            valid_to: res.socket.getPeerCertificate().valid_to
                        } : null
                    });
                });

                res.on('error', reject);
            });

            req.on('socket', (socket) => {
                timing.connectStart = performance.now();
                socket.on('lookup', () => {
                    timing.dnsEnd = performance.now();
                });
                socket.on('connect', () => {
                    timing.connectEnd = performance.now();
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    /**
     * Update target metrics
     */
    updateTargetMetrics(targetName, metrics) {
        const target = this.targets.get(targetName);
        if (!target) return;

        // Update response time history
        target.metrics.responseTime.push({
            timestamp: metrics.timestamp,
            value: metrics.responseTime,
            success: metrics.success
        });

        // Keep only last 1000 data points
        if (target.metrics.responseTime.length > 1000) {
            target.metrics.responseTime = target.metrics.responseTime.slice(-1000);
        }

        // Update status codes
        const statusCodeKey = metrics.statusCode.toString();
        const currentCount = target.metrics.statusCodes.get(statusCodeKey) || 0;
        target.metrics.statusCodes.set(statusCodeKey, currentCount + 1);

        // Update consecutive failures
        if (metrics.success) {
            target.consecutiveFailures = 0;
        } else {
            target.consecutiveFailures++;
        }

        // Calculate availability
        const recentChecks = target.metrics.responseTime.slice(-20); // Last 20 checks
        const successfulChecks = recentChecks.filter(check => check.success).length;
        target.metrics.availability = recentChecks.length > 0 ?
            (successfulChecks / recentChecks.length) * 100 : 0;

        // Store metrics data
        if (!this.metricsData.has(targetName)) {
            this.metricsData.set(targetName, []);
        }

        const targetData = this.metricsData.get(targetName);
        targetData.push(metrics);

        // Keep only recent data points based on retention period
        const cutoffTime = Date.now() - this.config.dashboard.historyRetention;
        const filteredData = targetData.filter(data => data.timestamp > cutoffTime);
        this.metricsData.set(targetName, filteredData);

        // Periodically save to file
        if (this.config.storage.file && Math.random() < 0.1) { // 10% chance
            this.saveMetrics();
        }
    }

    /**
     * Check for alerts
     */
    checkAlerts(targetName, metrics) {
        const target = this.targets.get(targetName);
        if (!target || !metrics.success) return;

        const alerts = [];

        // Response time alerts
        if (metrics.responseTime > this.config.alerts.responseTime.critical) {
            alerts.push({
                type: 'response_time',
                severity: 'critical',
                message: `Response time ${metrics.responseTime.toFixed(2)}ms exceeds critical threshold ${this.config.alerts.responseTime.critical}ms`,
                value: metrics.responseTime,
                threshold: this.config.alerts.responseTime.critical
            });
        } else if (metrics.responseTime > this.config.alerts.responseTime.warning) {
            alerts.push({
                type: 'response_time',
                severity: 'warning',
                message: `Response time ${metrics.responseTime.toFixed(2)}ms exceeds warning threshold ${this.config.alerts.responseTime.warning}ms`,
                value: metrics.responseTime,
                threshold: this.config.alerts.responseTime.warning
            });
        }

        // Availability alerts
        if (target.metrics.availability < this.config.alerts.availability.critical) {
            alerts.push({
                type: 'availability',
                severity: 'critical',
                message: `Availability ${target.metrics.availability.toFixed(2)}% below critical threshold ${this.config.alerts.availability.critical}%`,
                value: target.metrics.availability,
                threshold: this.config.alerts.availability.critical
            });
        } else if (target.metrics.availability < this.config.alerts.availability.warning) {
            alerts.push({
                type: 'availability',
                severity: 'warning',
                message: `Availability ${target.metrics.availability.toFixed(2)}% below warning threshold ${this.config.alerts.availability.warning}%`,
                value: target.metrics.availability,
                threshold: this.config.alerts.availability.warning
            });
        }

        // Send alerts
        alerts.forEach(alert => {
            this.sendAlert(targetName, alert);
        });
    }

    /**
     * Check for error alerts
     */
    checkErrorAlerts(targetName, metrics) {
        const target = this.targets.get(targetName);
        if (!target) return;

        const alerts = [];

        // Consecutive failures alert
        if (target.consecutiveFailures >= this.config.alerts.consecutiveFailures.critical) {
            alerts.push({
                type: 'consecutive_failures',
                severity: 'critical',
                message: `${target.consecutiveFailures} consecutive failures detected`,
                value: target.consecutiveFailures,
                threshold: this.config.alerts.consecutiveFailures.critical
            });
        } else if (target.consecutiveFailures >= this.config.alerts.consecutiveFailures.warning) {
            alerts.push({
                type: 'consecutive_failures',
                severity: 'warning',
                message: `${target.consecutiveFailures} consecutive failures detected`,
                value: target.consecutiveFailures,
                threshold: this.config.alerts.consecutiveFailures.warning
            });
        }

        // Send alerts
        alerts.forEach(alert => {
            this.sendAlert(targetName, alert);
        });
    }

    /**
     * Send alert through configured channels
     */
    async sendAlert(targetName, alert) {
        const alertKey = `${targetName}-${alert.type}-${alert.severity}`;

        // Check if we already sent this alert recently
        const lastAlert = this.alertStates.get(alertKey);
        if (lastAlert && (Date.now() - lastAlert) < 300000) { // 5 minutes cooldown
            return;
        }

        this.alertStates.set(alertKey, Date.now());

        const alertData = {
            timestamp: new Date().toISOString(),
            target: targetName,
            ...alert,
            url: this.targets.get(targetName).url
        };

        console.log(`🚨 [${alert.severity.toUpperCase()}] ${targetName}: ${alert.message}`);

        // Send webhook notification
        if (this.config.notifications.webhook.enabled) {
            await this.sendWebhookAlert(alertData);
        }

        // Send Slack notification
        if (this.config.notifications.slack.enabled) {
            await this.sendSlackAlert(alertData);
        }

        // Send email notification
        if (this.config.notifications.email.enabled) {
            await this.sendEmailAlert(alertData);
        }

        // Emit alert event
        this.emit('alert', alertData);
    }

    /**
     * Send webhook alert
     */
    async sendWebhookAlert(alert) {
        try {
            const url = this.config.notifications.webhook.url;
            const payload = JSON.stringify(alert);

            const response = await this.makeHttpRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, payload);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`✅ Webhook alert sent successfully`);
            } else {
                console.warn(`⚠️ Webhook alert failed with status ${response.statusCode}`);
            }
        } catch (error) {
            console.error(`❌ Failed to send webhook alert:`, error.message);
        }
    }

    /**
     * Send Slack alert
     */
    async sendSlackAlert(alert) {
        try {
            const webhook = this.config.notifications.slack.webhook;
            const payload = JSON.stringify({
                channel: this.config.notifications.slack.channel,
                username: 'Cloudflare Monitor',
                icon_emoji: alert.severity === 'critical' : ':warning:' : ':information_source:',
                text: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.target}`,
                attachments: [{
                    color: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
                    fields: [
                        { title: 'Target', value: alert.target, short: true },
                        { title: 'Type', value: alert.type, short: true },
                        { title: 'Message', value: alert.message, short: false },
                        { title: 'URL', value: alert.url, short: false }
                    ],
                    ts: Math.floor(Date.now() / 1000)
                }]
            });

            const response = await this.makeHttpRequest(webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, payload);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`✅ Slack alert sent successfully`);
            } else {
                console.warn(`⚠️ Slack alert failed with status ${response.statusCode}`);
            }
        } catch (error) {
            console.error(`❌ Failed to send Slack alert:`, error.message);
        }
    }

    /**
     * Send email alert
     */
    async sendEmailAlert(alert) {
        // This would typically use a library like nodemailer
        // For now, just log the email alert
        console.log(`📧 Email alert would be sent: ${alert.message}`);
    }

    /**
     * Make HTTP request utility
     */
    async makeHttpRequest(url, options = {}, body = null) {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: this.config.notifications.webhook.timeout
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                }));
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }

    /**
     * Setup real-time dashboard
     */
    setupDashboard() {
        const express = require('express');
        const app = express();
        const server = require('http').createServer(app);
        const wss = new WebSocket.Server({ server });

        app.use(express.json());
        app.use(express.static(path.join(__dirname, 'public')));

        // API endpoint for current metrics
        app.get('/api/metrics', (req, res) => {
            const metrics = this.getCurrentMetrics();
            res.json(metrics);
        });

        // API endpoint for target-specific metrics
        app.get('/api/metrics/:target', (req, res) => {
            const targetName = req.params.target;
            const target = this.targets.get(targetName);

            if (!target) {
                return res.status(404).json({ error: 'Target not found' });
            }

            const targetData = this.metricsData.get(targetName) || [];
            res.json({
                target: targetName,
                config: target,
                metrics: targetData,
                summary: this.getTargetSummary(targetName)
            });
        });

        // API endpoint for alerts
        app.get('/api/alerts', (req, res) => {
            const alerts = this.getRecentAlerts();
            res.json(alerts);
        });

        // WebSocket connection for real-time updates
        wss.on('connection', (ws) => {
            console.log('📡 Dashboard client connected');

            // Send initial data
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.getCurrentMetrics()
            }));

            // Set up real-time updates
            const metricsHandler = (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'metrics',
                        data
                    }));
                }
            };

            const alertHandler = (alert) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'alert',
                        data: alert
                    }));
                }
            };

            this.on('metrics', metricsHandler);
            this.on('alert', alertHandler);

            ws.on('close', () => {
                console.log('📡 Dashboard client disconnected');
                this.removeListener('metrics', metricsHandler);
                this.removeListener('alert', alertHandler);
            });
        });

        // Start server
        server.listen(this.config.dashboard.port, () => {
            console.log(`📊 Dashboard running on port ${this.config.dashboard.port}`);
            console.log(`🌐 Open http://localhost:${this.config.dashboard.port} to view metrics`);
        });
    }

    /**
     * Get current metrics for all targets
     */
    getCurrentMetrics() {
        const metrics = {
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
            totalRequests: this.totalRequests,
            totalErrors: this.totalErrors,
            errorRate: this.totalRequests > 0 ? (this.totalErrors / this.totalRequests) * 100 : 0,
            targets: {}
        };

        this.targets.forEach((target, name) => {
            metrics.targets[name] = {
                ...target,
                summary: this.getTargetSummary(name)
            };
        });

        return metrics;
    }

    /**
     * Get target summary
     */
    getTargetSummary(targetName) {
        const target = this.targets.get(targetName);
        if (!target) return null;

        const responseTimes = target.metrics.responseTime.map(rt => rt.value);
        const recentChecks = target.metrics.responseTime.slice(-20);
        const successfulChecks = recentChecks.filter(check => check.success).length;

        return {
            lastCheck: target.lastCheck,
            consecutiveFailures: target.consecutiveFailures,
            availability: recentChecks.length > 0 ? (successfulChecks / recentChecks.length) * 100 : 0,
            avgResponseTime: responseTimes.length > 0 ?
                responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
            minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
            maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
            statusCodes: Object.fromEntries(target.metrics.statusCodes),
            uptime: 100 - (target.consecutiveFailures > 0 ? (target.consecutiveFailures / 20) * 100 : 0)
        };
    }

    /**
     * Start system performance monitoring
     */
    startSystemMonitoring() {
        this.systemInterval = setInterval(() => {
            if (this.isRunning) {
                const systemMetrics = this.collectSystemMetrics();
                this.emit('system-metrics', systemMetrics);
            }
        }, this.config.performance.systemCheckInterval);
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        const usage = process.cpuUsage();
        const memUsage = process.memoryUsage();

        return {
            timestamp: Date.now(),
            cpu: {
                user: usage.user,
                system: usage.system
            },
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            uptime: process.uptime()
        };
    }

    /**
     * Start data cleanup
     */
    startDataCleanup() {
        this.cleanupInterval = setInterval(() => {
            if (this.isRunning) {
                this.cleanupOldData();
            }
        }, 3600000); // Run cleanup every hour
    }

    /**
     * Clean up old data based on retention policy
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - this.config.dashboard.historyRetention;

        this.metricsData.forEach((data, targetName) => {
            const filteredData = data.filter(item => item.timestamp > cutoffTime);
            this.metricsData.set(targetName, filteredData);
        });

        // Clean up old alert states
        const alertCutoffTime = Date.now() - 3600000; // 1 hour
        for (const [key, timestamp] of this.alertStates.entries()) {
            if (timestamp < alertCutoffTime) {
                this.alertStates.delete(key);
            }
        }
    }

    /**
     * Get recent alerts
     */
    getRecentAlerts() {
        const alerts = [];
        const now = Date.now();
        const recentPeriod = 3600000; // Last hour

        // This would need to be implemented to track alert history
        // For now, return current alert states
        for (const [key, timestamp] of this.alertStates.entries()) {
            if (now - timestamp < recentPeriod) {
                const [targetName, type, severity] = key.split('-');
                alerts.push({
                    target: targetName,
                    type,
                    severity,
                    timestamp
                });
            }
        }

        return alerts.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Save metrics to file
     */
    saveMetrics() {
        if (!this.config.storage.file) return;

        try {
            const data = {
                timestamp: Date.now(),
                config: this.config,
                targets: Array.from(this.targets.entries()).map(([name, target]) => ({
                    name,
                    ...target
                })),
                metrics: Object.fromEntries(this.metricsData),
                alertStates: Object.fromEntries(this.alertStates)
            };

            let filePath = this.config.storage.filePath;
            if (this.config.storage.compression) {
                filePath += '.gz';
                // Would need to implement compression
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Failed to save metrics:', error);
        }
    }

    /**
     * Load metrics from file
     */
    loadMetrics() {
        if (!this.config.storage.file) return;

        try {
            let filePath = this.config.storage.filePath;
            if (fs.existsSync(filePath + '.gz')) {
                filePath += '.gz';
                // Would need to implement decompression
            }

            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                // Restore metrics data
                if (data.metrics) {
                    this.metricsData = new Map(Object.entries(data.metrics));
                }

                // Restore alert states
                if (data.alertStates) {
                    this.alertStates = new Map(Object.entries(data.alertStates));
                }

                console.log('✅ Metrics loaded from file');
            }
        } catch (error) {
            console.error('❌ Failed to load metrics:', error);
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    let config = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        if (args[i] === '--config') {
            try {
                config = JSON.parse(args[i + 1]);
            } catch (e) {
                console.error('Invalid config JSON format');
                process.exit(1);
            }
        } else if (args[i] === '--targets') {
            try {
                config.targets = JSON.parse(args[i + 1]);
            } catch (e) {
                console.error('Invalid targets JSON format');
                process.exit(1);
            }
        } else if (args[i] === '--dashboard-port') {
            if (!config.dashboard) config.dashboard = {};
            config.dashboard.port = parseInt(args[i + 1]);
        } else if (args[i] === '--slack-webhook') {
            if (!config.notifications) config.notifications = {};
            if (!config.notifications.slack) config.notifications.slack = {};
            config.notifications.slack.enabled = true;
            config.notifications.slack.webhook = args[i + 1];
        }
    }

    // Create and start monitoring
    const monitor = new MetricsCollector(config);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down monitoring...');
        monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down monitoring...');
        monitor.stop();
        process.exit(0);
    });

    // Start monitoring
    monitor.start()
        .then(() => {
            console.log('🎯 Monitoring active. Press Ctrl+C to stop.');
        })
        .catch(error => {
            console.error('❌ Failed to start monitoring:', error);
            process.exit(1);
        });
}

module.exports = MetricsCollector;