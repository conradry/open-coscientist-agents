#!/usr/bin/env node

/**
 * Cloudflare Global Performance Testing Framework
 * Tests performance across multiple regions and edge locations
 */

const { performance } = require('perf_hooks');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const PERFORMANCE_CONFIG = {
    // Test targets
    targets: [
        {
            name: 'Homepage',
            url: 'https://example.com',
            method: 'GET',
            expectedStatus: 200,
            critical: true
        },
        {
            name: 'API Health Check',
            url: 'https://api.example.com/health',
            method: 'GET',
            expectedStatus: 200,
            critical: true
        },
        {
            name: 'Static Assets',
            url: 'https://cdn.example.com/styles/main.css',
            method: 'GET',
            expectedStatus: 200,
            critical: false
        }
    ],

    // Global test locations (Cloudflare edge locations)
    locations: [
        { name: 'US East', code: 'us-east', endpoints: ['https://1.1.1.1', 'https://1.0.0.1'] },
        { name: 'US West', code: 'us-west', endpoints: ['https://104.16.0.1', 'https://104.16.1.1'] },
        { name: 'Europe', code: 'eu', endpoints: ['https://104.16.132.229'] },
        { name: 'Asia', code: 'asia', endpoints: ['https://104.16.108.1'] },
        { name: 'Australia', code: 'au', endpoints: ['https://104.16.156.1'] },
        { name: 'South America', code: 'sa', endpoints: ['https://104.16.48.1'] }
    ],

    // Performance thresholds (in milliseconds)
    thresholds: {
        ttfb: 600,          // Time to First Byte
        domLoad: 2000,       // DOM Load Time
        windowLoad: 3000,    // Window Load Time
        connectionTime: 200, // Connection Time
        sslTime: 150,       // SSL Handshake Time
        downloadTime: 500,   // Download Time
        totalResponseTime: 1000
    },

    // Test configuration
    test: {
        concurrentRequests: 5,
        maxRetries: 3,
        requestTimeout: 30000,
        testDuration: 60000, // 1 minute
        interval: 5000,      // 5 seconds between tests
        metricsCollection: true,
        generateReport: true
    },

    // Monitoring and alerting
    alerting: {
        enabled: true,
        thresholds: {
            errorRate: 5,         // percentage
            avgResponseTime: 2000, // milliseconds
            availability: 99.5     // percentage
        },
        notifications: {
            slack: false,
            email: false,
            webhook: false
        }
    }
};

// Performance test class
class PerformanceTest {
    constructor(config = {}) {
        this.config = { ...PERFORMANCE_CONFIG, ...config };
        this.results = [];
        this.metrics = new Map();
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Run comprehensive performance tests
     */
    async runTests() {
        console.log('🚀 Starting global performance tests...');
        console.log(`📍 Testing ${this.config.targets.length} endpoints across ${this.config.locations.length} regions`);

        this.startTime = Date.now();

        try {
            // Initialize metrics collection
            this.initializeMetrics();

            // Run tests for each target
            for (const target of this.config.targets) {
                console.log(`\n🎯 Testing target: ${target.name}`);
                await this.testTarget(target);
            }

            // Analyze results
            this.analyzeResults();

            // Generate report
            if (this.config.test.generateReport) {
                this.generateReport();
            }

            this.endTime = Date.now();

            console.log('\n✅ Performance tests completed');
            console.log(`⏱️ Total test duration: ${this.endTime - this.startTime}ms`);

            return this.getResults();

        } catch (error) {
            console.error('❌ Performance test failed:', error);
            throw error;
        }
    }

    /**
     * Test a single target across all locations
     */
    async testTarget(target) {
        const targetResults = {
            target: target.name,
            url: target.url,
            locations: {},
            summary: {
                avgResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                successRate: 0,
                totalRequests: 0,
                failedRequests: 0,
                errors: []
            }
        };

        // Test from each location
        for (const location of this.config.locations) {
            console.log(`  📍 Testing from ${location.name}...`);

            const locationResults = await this.testFromLocation(target, location);
            targetResults.locations[location.code] = locationResults;

            // Update summary
            targetResults.summary.totalRequests += locationResults.totalRequests;
            targetResults.summary.failedRequests += locationResults.failedRequests;
            targetResults.summary.avgResponseTime += locationResults.avgResponseTime * locationResults.totalRequests;
            targetResults.summary.minResponseTime = Math.min(targetResults.summary.minResponseTime, locationResults.minResponseTime);
            targetResults.summary.maxResponseTime = Math.max(targetResults.summary.maxResponseTime, locationResults.maxResponseTime);
            targetResults.summary.errors.push(...locationResults.errors);
        }

        // Calculate summary metrics
        if (targetResults.summary.totalRequests > 0) {
            targetResults.summary.avgResponseTime = targetResults.summary.avgResponseTime / targetResults.summary.totalRequests;
            targetResults.summary.successRate = ((targetResults.summary.totalRequests - targetResults.summary.failedRequests) / targetResults.summary.totalRequests) * 100;
        }

        this.results.push(targetResults);

        // Check against thresholds
        this.checkThresholds(targetResults);
    }

    /**
     * Test target from a specific location
     */
    async testFromLocation(target, location) {
        const locationResults = {
            location: location.name,
            requests: [],
            summary: {
                avgResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                successRate: 0,
                totalRequests: 0,
                failedRequests: 0,
                errors: [],
                metrics: {
                    ttfb: [],
                    connectionTime: [],
                    sslTime: [],
                    downloadTime: []
                }
            }
        };

        // Run concurrent requests
        const promises = [];
        for (let i = 0; i < this.config.test.concurrentRequests; i++) {
            promises.push(this.makeRequest(target, location));
        }

        try {
            const requestResults = await Promise.allSettled(promises);

            // Process results
            requestResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    locationResults.requests.push(result.value);

                    // Update metrics
                    const request = result.value;
                    locationResults.summary.totalRequests++;
                    locationResults.summary.avgResponseTime += request.responseTime;
                    locationResults.summary.minResponseTime = Math.min(locationResults.summary.minResponseTime, request.responseTime);
                    locationResults.summary.maxResponseTime = Math.max(locationResults.summary.maxResponseTime, request.responseTime);

                    // Collect detailed metrics
                    if (request.metrics) {
                        Object.keys(request.metrics).forEach(metric => {
                            if (locationResults.summary.metrics[metric]) {
                                locationResults.summary.metrics[metric].push(request.metrics[metric]);
                            }
                        });
                    }

                    if (!request.success) {
                        locationResults.summary.failedRequests++;
                        locationResults.summary.errors.push({
                            type: 'http_error',
                            message: request.error,
                            statusCode: request.statusCode
                        });
                    }
                } else {
                    locationResults.summary.totalRequests++;
                    locationResults.summary.failedRequests++;
                    locationResults.summary.errors.push({
                        type: 'request_error',
                        message: result.reason.message,
                        index
                    });
                }
            });

            // Calculate averages
            if (locationResults.summary.totalRequests > 0) {
                locationResults.summary.avgResponseTime = locationResults.summary.avgResponseTime / locationResults.summary.totalRequests;
                locationResults.summary.successRate = ((locationResults.summary.totalRequests - locationResults.summary.failedRequests) / locationResults.summary.totalRequests) * 100;

                // Calculate metric averages
                Object.keys(locationResults.summary.metrics).forEach(metric => {
                    const values = locationResults.summary.metrics[metric];
                    if (values.length > 0) {
                        locationResults.summary.metrics[metric] = {
                            avg: values.reduce((sum, val) => sum + val, 0) / values.length,
                            min: Math.min(...values),
                            max: Math.max(...values)
                        };
                    }
                });
            }

        } catch (error) {
            locationResults.summary.errors.push({
                type: 'location_error',
                message: error.message
            });
        }

        return locationResults;
    }

    /**
     * Make HTTP request with detailed metrics collection
     */
    async makeRequest(target, location) {
        const requestStart = performance.now();
        let connectionStart = null;
        let sslStart = null;
        let downloadStart = null;

        try {
            const url = new URL(target.url);
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: target.method || 'GET',
                headers: {
                    'User-Agent': 'Cloudflare-Performance-Test/1.0',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: this.config.test.requestTimeout
            };

            const client = url.protocol === 'https:' ? https : http;

            return new Promise((resolve, reject) => {
                const req = client.request(options, (res) => {
                    const timings = {
                        connectionTime: 0,
                        sslTime: 0,
                        downloadTime: 0,
                        ttfb: 0
                    };

                    // Track timing
                    req.on('socket', (socket) => {
                        connectionStart = performance.now();
                        socket.on('connect', () => {
                            timings.connectionTime = performance.now() - connectionStart;

                            if (url.protocol === 'https:') {
                                sslStart = performance.now();
                                socket.on('secureConnect', () => {
                                    timings.sslTime = performance.now() - sslStart;
                                });
                            }
                        });
                    });

                    res.on('readable', () => {
                        if (!downloadStart) {
                            downloadStart = performance.now();
                            timings.ttfb = downloadStart - requestStart;
                        }
                    });

                    let data = '';
                    res.on('data', chunk => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        const requestEnd = performance.now();
                        const responseTime = requestEnd - requestStart;

                        if (downloadStart) {
                            timings.downloadTime = requestEnd - downloadStart;
                        }

                        resolve({
                            success: res.statusCode === (target.expectedStatus || 200),
                            statusCode: res.statusCode,
                            responseTime,
                            responseSize: data.length,
                            headers: res.headers,
                            location: location.code,
                            metrics: timings,
                            timestamp: Date.now()
                        });
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                req.end();
            });

        } catch (error) {
            const requestEnd = performance.now();
            return {
                success: false,
                error: error.message,
                responseTime: requestEnd - requestStart,
                location: location.code,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Initialize metrics collection
     */
    initializeMetrics() {
        this.metrics.set('global', {
            startTime: Date.now(),
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            errors: []
        });

        // Initialize metrics for each location
        this.config.locations.forEach(location => {
            this.metrics.set(location.code, {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                successRate: 0
            });
        });
    }

    /**
     * Analyze test results
     */
    analyzeResults() {
        console.log('\n📊 Analyzing performance results...');

        let totalRequests = 0;
        let successfulRequests = 0;
        let totalResponseTime = 0;
        let allResponseTimes = [];

        this.results.forEach(targetResult => {
            Object.values(targetResult.locations).forEach(locationResult => {
                totalRequests += locationResult.summary.totalRequests;
                successfulRequests += locationResult.summary.totalRequests - locationResult.summary.failedRequests;
                totalResponseTime += locationResult.summary.avgResponseTime * locationResult.summary.totalRequests;

                // Collect all response times for percentile calculation
                locationResult.requests.forEach(request => {
                    if (request.success) {
                        allResponseTimes.push(request.responseTime);
                    }
                });
            });
        });

        // Calculate global metrics
        const globalMetrics = {
            totalRequests,
            successfulRequests,
            failedRequests: totalRequests - successfulRequests,
            successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
            avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
            availability: 100 - ((totalRequests - successfulRequests) / totalRequests * 100)
        };

        // Calculate percentiles
        if (allResponseTimes.length > 0) {
            allResponseTimes.sort((a, b) => a - b);
            globalMetrics.p50 = allResponseTimes[Math.floor(allResponseTimes.length * 0.5)];
            globalMetrics.p75 = allResponseTimes[Math.floor(allResponseTimes.length * 0.75)];
            globalMetrics.p90 = allResponseTimes[Math.floor(allResponseTimes.length * 0.9)];
            globalMetrics.p95 = allResponseTimes[Math.floor(allResponseTimes.length * 0.95)];
            globalMetrics.p99 = allResponseTimes[Math.floor(allResponseTimes.length * 0.99)];
        }

        this.metrics.set('global', { ...this.metrics.get('global'), ...globalMetrics });

        console.log(`📈 Global Performance Metrics:`);
        console.log(`  Total Requests: ${globalMetrics.totalRequests}`);
        console.log(`  Success Rate: ${globalMetrics.successRate.toFixed(2)}%`);
        console.log(`  Availability: ${globalMetrics.availability.toFixed(2)}%`);
        console.log(`  Avg Response Time: ${globalMetrics.avgResponseTime.toFixed(2)}ms`);
        if (globalMetrics.p95) {
            console.log(`  95th Percentile: ${globalMetrics.p95.toFixed(2)}ms`);
        }
    }

    /**
     * Check performance against thresholds
     */
    checkThresholds(targetResults) {
        const thresholds = this.config.thresholds;
        const alerts = [];

        // Check response times
        if (targetResults.summary.avgResponseTime > thresholds.totalResponseTime) {
            alerts.push({
                type: 'response_time',
                severity: 'warning',
                message: `Average response time (${targetResults.summary.avgResponseTime.toFixed(2)}ms) exceeds threshold (${thresholds.totalResponseTime}ms)`
            });
        }

        // Check availability
        if (targetResults.summary.successRate < 95) {
            alerts.push({
                type: 'availability',
                severity: 'critical',
                message: `Success rate (${targetResults.summary.successRate.toFixed(2)}%) below 95%`
            });
        }

        // Check location-specific issues
        Object.entries(targetResults.locations).forEach(([locationCode, locationResult]) => {
            if (locationResult.summary.successRate < 90) {
                alerts.push({
                    type: 'location_issue',
                    severity: 'warning',
                    location: locationCode,
                    message: `Low success rate (${locationResult.summary.successRate.toFixed(2)}%) from ${locationResult.location}`
                });
            }
        });

        // Store alerts
        targetResults.alerts = alerts;

        // Print alerts
        alerts.forEach(alert => {
            const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
            console.log(`${emoji} ${alert.message}`);
        });
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.metrics.get('global'),
            targets: this.results,
            configuration: this.config,
            recommendations: this.generateRecommendations()
        };

        // Save report to file
        const fs = require('fs');
        const reportPath = `./performance-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n📋 Performance report saved to: ${reportPath}`);

        // Generate summary report
        this.generateSummaryReport(report);
    }

    /**
     * Generate human-readable summary report
     */
    generateSummaryReport(report) {
        console.log('\n📄 Performance Test Summary Report');
        console.log('='.repeat(50));

        // Overall performance
        console.log('\n🎯 Overall Performance:');
        console.log(`  Success Rate: ${report.summary.successRate.toFixed(2)}%`);
        console.log(`  Availability: ${report.summary.availability.toFixed(2)}%`);
        console.log(`  Avg Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms`);

        if (report.summary.p95) {
            console.log(`  95th Percentile: ${report.summary.p95.toFixed(2)}ms`);
        }

        // Target performance
        console.log('\n📊 Target Performance:');
        report.targets.forEach(target => {
            const status = target.summary.successRate >= 99 ? '✅' :
                          target.summary.successRate >= 95 ? '⚠️' : '❌';
            console.log(`  ${status} ${target.target}: ${target.summary.avgResponseTime.toFixed(2)}ms (${target.summary.successRate.toFixed(2)}% success)`);
        });

        // Geographic performance
        console.log('\n🌍 Geographic Performance:');
        const locationPerformance = new Map();

        report.targets.forEach(target => {
            Object.entries(target.locations).forEach(([locationCode, locationResult]) => {
                if (!locationPerformance.has(locationCode)) {
                    locationPerformance.set(locationCode, {
                        name: locationResult.location,
                        totalRequests: 0,
                        avgResponseTime: 0,
                        successRate: 100
                    });
                }

                const location = locationPerformance.get(locationCode);
                location.totalRequests += locationResult.summary.totalRequests;
                location.avgResponseTime += locationResult.summary.avgResponseTime * locationResult.summary.totalRequests;
                location.successRate = Math.min(location.successRate, locationResult.summary.successRate);
            });
        });

        locationPerformance.forEach((performance, locationCode) => {
            if (performance.totalRequests > 0) {
                performance.avgResponseTime = performance.avgResponseTime / performance.totalRequests;
                const status = performance.successRate >= 99 ? '✅' :
                              performance.successRate >= 95 ? '⚠️' : '❌';
                console.log(`  ${status} ${performance.name}: ${performance.avgResponseTime.toFixed(2)}ms (${performance.successRate.toFixed(2)}% success)`);
            }
        });

        // Recommendations
        if (report.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            report.recommendations.forEach(rec => {
                console.log(`  • ${rec}`);
            });
        }
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const summary = this.metrics.get('global');

        // Response time recommendations
        if (summary.avgResponseTime > this.config.thresholds.totalResponseTime) {
            recommendations.push('Consider optimizing server response time or enabling caching');
        }

        // Availability recommendations
        if (summary.availability < this.config.alerting.thresholds.availability) {
            recommendations.push('Investigate availability issues and implement better error handling');
        }

        // Error rate recommendations
        if (summary.failedRequests > 0) {
            recommendations.push('Review and fix failed requests - check error logs for details');
        }

        // Geographic performance recommendations
        const slowLocations = [];
        this.results.forEach(target => {
            Object.entries(target.locations).forEach(([locationCode, locationResult]) => {
                if (locationResult.summary.avgResponseTime > this.config.thresholds.totalResponseTime * 1.5) {
                    slowLocations.push(locationResult.location);
                }
            });
        });

        if (slowLocations.length > 0) {
            recommendations.push(`Consider edge optimization for slower regions: ${slowLocations.join(', ')}`);
        }

        return recommendations;
    }

    /**
     * Get test results
     */
    getResults() {
        return {
            config: this.config,
            results: this.results,
            metrics: Object.fromEntries(this.metrics),
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
        } else if (args[i] === '--locations') {
            try {
                config.locations = JSON.parse(args[i + 1]);
            } catch (e) {
                console.error('Invalid locations JSON format');
                process.exit(1);
            }
        } else if (args[i] === '--output') {
            config.outputFile = args[i + 1];
        }
    }

    // Run performance tests
    const test = new PerformanceTest(config);

    test.runTests()
        .then(results => {
            if (config.outputFile) {
                const fs = require('fs');
                fs.writeFileSync(config.outputFile, JSON.stringify(results, null, 2));
                console.log(`\n📁 Results saved to: ${config.outputFile}`);
            }

            // Exit with appropriate code based on performance
            const summary = results.metrics.global;
            if (summary.successRate < 95) {
                process.exit(1); // Critical performance issues
            } else if (summary.successRate < 99) {
                process.exit(2); // Performance warnings
            } else {
                process.exit(0); // Good performance
            }
        })
        .catch(error => {
            console.error('Performance test failed:', error);
            process.exit(1);
        });
}

module.exports = PerformanceTest;