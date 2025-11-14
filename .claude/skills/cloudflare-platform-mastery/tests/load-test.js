#!/usr/bin/env node

/**
 * Cloudflare Load Testing and Stress Testing Framework
 * Comprehensive performance testing under various load conditions
 */

const { performance } = require('perf_hooks');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { EventEmitter } = require('events');
const cluster = require('cluster');
const os = require('os');

// Load testing configuration
const LOAD_TEST_CONFIG = {
    // Test targets
    targets: [
        {
            name: 'API Endpoint',
            url: 'https://api.example.com/health',
            method: 'GET',
            headers: {},
            body: null,
            weight: 1,
            critical: true
        },
        {
            name: 'Data API',
            url: 'https://api.example.com/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'test' }),
            weight: 1,
            critical: false
        }
    ],

    // Load testing scenarios
    scenarios: [
        {
            name: 'Baseline Test',
            description: 'Light load baseline',
            duration: 60000, // 1 minute
            rampUp: 10000,   // 10 seconds
            concurrentUsers: 10,
            thinkTime: 1000, // 1 second between requests
            requestsPerSecond: 5
        },
        {
            name: 'Moderate Load',
            description: 'Moderate user load',
            duration: 120000, // 2 minutes
            rampUp: 30000,   // 30 seconds
            concurrentUsers: 50,
            thinkTime: 500,
            requestsPerSecond: 25
        },
        {
            name: 'High Load',
            description: 'High load stress test',
            duration: 180000, // 3 minutes
            rampUp: 60000,   // 1 minute
            concurrentUsers: 200,
            thinkTime: 200,
            requestsPerSecond: 100
        },
        {
            name: 'Peak Load',
            description: 'Maximum capacity test',
            duration: 300000, // 5 minutes
            rampUp: 120000,  // 2 minutes
            concurrentUsers: 500,
            thinkTime: 100,
            requestsPerSecond: 250
        },
        {
            name: 'Spike Test',
            description: 'Sudden traffic spike',
            duration: 60000,  // 1 minute
            rampUp: 1000,    // Immediate spike
            concurrentUsers: 1000,
            thinkTime: 50,
            requestsPerSecond: 500
        }
    ],

    // Performance thresholds
    thresholds: {
        responseTime: {
            p50: 500,   // 50th percentile
            p90: 1000,  // 90th percentile
            p95: 2000,  // 95th percentile
            p99: 5000   // 99th percentile
        },
        errorRate: {
            warning: 5,  // 5%
            critical: 10 // 10%
        },
        throughput: {
            minimum: 100  // requests per second
        },
        availability: {
            minimum: 99.5 // percentage
        }
    },

    // Test configuration
    test: {
        timeout: 30000, // 30 seconds per request
        retries: 3,
        keepAlive: true,
        compression: true,
        followRedirects: true,
        maxRedirects: 5
    },

    // Resource limits
    limits: {
        maxMemoryUsage: 512 * 1024 * 1024, // 512MB
        maxCpuUsage: 80,                   // percentage
        maxOpenFiles: 1000
    },

    // Monitoring and alerting
    monitoring: {
        enabled: true,
        collectMetrics: true,
        realTimeUpdates: true,
        updateInterval: 5000 // 5 seconds
    },

    // Worker configuration for multi-process testing
    workers: {
        enabled: true,
        count: os.cpus().length,
        distribution: 'round-robin'
    }
};

// Virtual User class
class VirtualUser {
    constructor(id, targets, config = {}) {
        this.id = id;
        this.targets = targets;
        this.config = config;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: [],
            startTime: null,
            endTime: null
        };
        this.isActive = false;
        this.thinkTime = config.thinkTime || 1000;
    }

    /**
     * Start the virtual user
     */
    async start(duration, rampUp = 0) {
        if (rampUp > 0) {
            await this.delay(rampUp);
        }

        this.isActive = true;
        this.metrics.startTime = Date.now();

        console.log(`👤 Virtual User ${this.id} started`);

        while (this.isActive && (Date.now() - this.metrics.startTime) < duration) {
            try {
                await this.executeRequest();
                await this.think();
            } catch (error) {
                this.handleError(error);
            }
        }

        this.stop();
    }

    /**
     * Stop the virtual user
     */
    stop() {
        this.isActive = false;
        this.metrics.endTime = Date.now();
        console.log(`👤 Virtual User ${this.id} stopped`);
    }

    /**
     * Execute a request
     */
    async executeRequest() {
        // Select target based on weights
        const target = this.selectTarget();
        const startTime = performance.now();

        try {
            const response = await this.makeRequest(target);
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            this.recordSuccess(response, responseTime);
        } catch (error) {
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            this.recordError(error, responseTime);
        }
    }

    /**
     * Make HTTP request
     */
    async makeRequest(target) {
        const urlObj = new URL(target.url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: target.method || 'GET',
            headers: {
                'User-Agent': `LoadTester-VirtualUser-${this.id}`,
                'Accept': '*/*',
                'Connection': this.config.keepAlive ? 'keep-alive' : 'close',
                'Accept-Encoding': 'gzip, deflate, br',
                ...target.headers
            },
            timeout: this.config.timeout || 30000
        };

        if (target.body) {
            options.headers['Content-Length'] = Buffer.byteLength(target.body);
        }

        const client = urlObj.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        responseTime: 0 // Will be set by caller
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

            if (target.body) {
                req.write(target.body);
            }

            req.end();
        });
    }

    /**
     * Select target based on weights
     */
    selectTarget() {
        const totalWeight = this.targets.reduce((sum, target) => sum + target.weight, 0);
        let random = Math.random() * totalWeight;

        for (const target of this.targets) {
            random -= target.weight;
            if (random <= 0) {
                return target;
            }
        }

        return this.targets[0];
    }

    /**
     * Record successful request
     */
    recordSuccess(response, responseTime) {
        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        this.metrics.responseTimes.push(responseTime);

        // Record response time
        response.responseTime = responseTime;

        return response;
    }

    /**
     * Record error
     */
    recordError(error, responseTime) {
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        this.metrics.responseTimes.push(responseTime);
        this.metrics.errors.push({
            timestamp: Date.now(),
            error: error.message,
            responseTime
        });
    }

    /**
     * Think time between requests
     */
    async think() {
        if (this.thinkTime > 0) {
            await this.delay(this.thinkTime + Math.random() * 1000); // Add some randomness
        }
    }

    /**
     * Handle errors
     */
    handleError(error) {
        this.recordError(error, 0);
        console.error(`❌ Virtual User ${this.id} error:`, error.message);
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get metrics
     */
    getMetrics() {
        const responseTimes = this.metrics.responseTimes;
        const sortedTimes = [...responseTimes].sort((a, b) => a - b);

        return {
            ...this.metrics,
            avgResponseTime: responseTimes.length > 0 ?
                responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
            minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
            maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
            p50: this.getPercentile(sortedTimes, 50),
            p90: this.getPercentile(sortedTimes, 90),
            p95: this.getPercentile(sortedTimes, 95),
            p99: this.getPercentile(sortedTimes, 99),
            successRate: this.metrics.totalRequests > 0 ?
                (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0,
            errorRate: this.metrics.totalRequests > 0 ?
                (this.metrics.failedRequests / this.metrics.totalRequests) * 100 : 0
        };
    }

    /**
     * Calculate percentile
     */
    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }
}

// Load Tester class
class LoadTester extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { ...LOAD_TEST_CONFIG, ...config };
        this.virtualUsers = [];
        this.scenarioResults = [];
        this.isRunning = false;
        this.startTime = null;
        this.endTime = null;
        this.currentMetrics = {
            activeUsers: 0,
            requestsPerSecond: 0,
            avgResponseTime: 0,
            errorRate: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        };
    }

    /**
     * Run load test scenarios
     */
    async runScenarios(scenarios = null) {
        const scenariosToRun = scenarios || this.config.scenarios;

        if (!scenariosToRun || scenariosToRun.length === 0) {
            throw new Error('No scenarios specified for load testing');
        }

        console.log('🚀 Starting load testing scenarios...');
        console.log(`📋 Will run ${scenariosToRun.length} scenarios`);

        this.startTime = Date.now();
        this.isRunning = true;

        try {
            for (let i = 0; i < scenariosToRun.length; i++) {
                const scenario = scenariosToRun[i];
                console.log(`\n🎯 Running scenario ${i + 1}/${scenariosToRun.length}: ${scenario.name}`);
                console.log(`📝 ${scenario.description}`);

                const scenarioResult = await this.runScenario(scenario);
                this.scenarioResults.push(scenarioResult);

                // Check thresholds and emit alerts
                this.checkThresholds(scenarioResult);

                // Brief pause between scenarios
                if (i < scenariosToRun.length - 1) {
                    console.log('⏳ Waiting before next scenario...');
                    await this.delay(10000);
                }
            }

            this.endTime = Date.now();
            this.isRunning = false;

            // Generate comprehensive report
            const report = this.generateReport();
            this.generateSummaryReport(report);

            console.log('\n✅ All load testing scenarios completed');
            console.log(`⏱️ Total test duration: ${this.endTime - this.startTime}ms`);

            return report;

        } catch (error) {
            this.isRunning = false;
            console.error('❌ Load testing failed:', error);
            throw error;
        }
    }

    /**
     * Run a single scenario
     */
    async runScenario(scenario) {
        console.log(`👥 Starting ${scenario.concurrentUsers} virtual users...`);

        const scenarioResult = {
            name: scenario.name,
            description: scenario.description,
            startTime: Date.now(),
            endTime: null,
            duration: scenario.duration,
            concurrentUsers: scenario.concurrentUsers,
            requestsPerSecond: scenario.requestsPerSecond,
            virtualUsers: [],
            summary: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                avgResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                p50: 0,
                p90: 0,
                p95: 0,
                p99: 0,
                errorRate: 0,
                throughput: 0,
                errors: []
            },
            realTimeMetrics: []
        };

        // Create virtual users
        const rampUpDelay = scenario.rampUp / scenario.concurrentUsers;
        const virtualUsers = [];

        for (let i = 0; i < scenario.concurrentUsers; i++) {
            const user = new VirtualUser(i + 1, this.config.targets, {
                timeout: this.config.test.timeout,
                keepAlive: this.config.test.keepAlive,
                thinkTime: scenario.thinkTime
            });

            virtualUsers.push(user);
            scenarioResult.virtualUsers.push(user);

            // Start user with ramp-up delay
            this.startVirtualUser(user, scenario.duration, i * rampUpDelay);
        }

        // Monitor scenario progress
        if (this.config.monitoring.enabled && this.config.monitoring.realTimeUpdates) {
            this.monitorScenario(scenarioResult);
        }

        // Wait for scenario to complete
        await this.delay(scenario.duration + scenario.rampUp + 5000);

        // Stop all virtual users
        virtualUsers.forEach(user => user.stop());

        // Calculate scenario summary
        this.calculateScenarioSummary(scenarioResult);

        scenarioResult.endTime = Date.now();

        console.log(`✅ Scenario "${scenario.name}" completed`);
        console.log(`📊 Total requests: ${scenarioResult.summary.totalRequests}`);
        console.log(`📈 Average response time: ${scenarioResult.summary.avgResponseTime.toFixed(2)}ms`);
        console.log(`✅ Success rate: ${(100 - scenarioResult.summary.errorRate).toFixed(2)}%`);

        return scenarioResult;
    }

    /**
     * Start a virtual user
     */
    async startVirtualUser(user, duration, rampUpDelay) {
        // Don't await - let users run in parallel
        user.start(duration, rampUpDelay).catch(error => {
            console.error(`Virtual User ${user.id} failed:`, error);
        });
    }

    /**
     * Monitor scenario progress
     */
    monitorScenario(scenarioResult) {
        const monitorInterval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(monitorInterval);
                return;
            }

            // Collect current metrics
            const metrics = this.collectCurrentMetrics(scenarioResult);
            scenarioResult.realTimeMetrics.push({
                timestamp: Date.now(),
                ...metrics
            });

            // Emit progress update
            this.emit('progress', metrics);

            // Check for critical issues
            if (metrics.errorRate > this.config.thresholds.errorRate.critical) {
                console.warn(`🚨 Critical error rate: ${metrics.errorRate.toFixed(2)}%`);
                this.emit('critical-error', metrics);
            }

        }, this.config.monitoring.updateInterval);

        // Clean up on scenario completion
        setTimeout(() => {
            clearInterval(monitorInterval);
        }, scenarioResult.duration + scenarioResult.rampUp + 10000);
    }

    /**
     * Collect current metrics
     */
    collectCurrentMetrics(scenarioResult) {
        const allMetrics = scenarioResult.virtualUsers.map(user => user.getMetrics());

        const totalRequests = allMetrics.reduce((sum, metrics) => sum + metrics.totalRequests, 0);
        const successfulRequests = allMetrics.reduce((sum, metrics) => sum + metrics.successfulRequests, 0);
        const failedRequests = allMetrics.reduce((sum, metrics) => sum + metrics.failedRequests, 0);
        const allResponseTimes = allMetrics.flatMap(metrics => metrics.responseTimes);

        return {
            activeUsers: scenarioResult.virtualUsers.filter(user => user.isActive).length,
            totalRequests,
            successfulRequests,
            failedRequests,
            avgResponseTime: allResponseTimes.length > 0 ?
                allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length : 0,
            errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
            throughput: successfulRequests / ((Date.now() - scenarioResult.startTime) / 1000), // requests per second
            timestamp: Date.now()
        };
    }

    /**
     * Calculate scenario summary
     */
    calculateScenarioSummary(scenarioResult) {
        const allUserMetrics = scenarioResult.virtualUsers.map(user => user.getMetrics());
        const allResponseTimes = allUserMetrics.flatMap(metrics => metrics.responseTimes);
        const allErrors = allUserMetrics.flatMap(metrics => metrics.errors);

        scenarioResult.summary = {
            totalRequests: allUserMetrics.reduce((sum, metrics) => sum + metrics.totalRequests, 0),
            successfulRequests: allUserMetrics.reduce((sum, metrics) => sum + metrics.successfulRequests, 0),
            failedRequests: allUserMetrics.reduce((sum, metrics) => sum + metrics.failedRequests, 0),
            avgResponseTime: allResponseTimes.length > 0 ?
                allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length : 0,
            minResponseTime: allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0,
            maxResponseTime: allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0,
            p50: this.getPercentile(allResponseTimes, 50),
            p90: this.getPercentile(allResponseTimes, 90),
            p95: this.getPercentile(allResponseTimes, 95),
            p99: this.getPercentile(allResponseTimes, 99),
            errorRate: scenarioResult.summary.totalRequests > 0 ?
                (scenarioResult.summary.failedRequests / scenarioResult.summary.totalRequests) * 100 : 0,
            throughput: scenarioResult.summary.successfulRequests / (scenarioResult.duration / 1000),
            errors: allErrors
        };
    }

    /**
     * Check performance thresholds
     */
    checkThresholds(scenarioResult) {
        const thresholds = this.config.thresholds;
        const summary = scenarioResult.summary;

        // Response time thresholds
        if (summary.p95 > thresholds.responseTime.p95) {
            console.warn(`⚠️ P95 response time exceeds threshold: ${summary.p95.toFixed(2)}ms > ${thresholds.responseTime.p95}ms`);
        }

        if (summary.p99 > thresholds.responseTime.p99) {
            console.warn(`⚠️ P99 response time exceeds threshold: ${summary.p99.toFixed(2)}ms > ${thresholds.responseTime.p99}ms`);
        }

        // Error rate thresholds
        if (summary.errorRate > thresholds.errorRate.warning) {
            console.warn(`⚠️ Error rate exceeds warning threshold: ${summary.errorRate.toFixed(2)}% > ${thresholds.errorRate.warning}%`);
        }

        if (summary.errorRate > thresholds.errorRate.critical) {
            console.error(`🚨 Error rate exceeds critical threshold: ${summary.errorRate.toFixed(2)}% > ${thresholds.errorRate.critical}%`);
        }

        // Throughput threshold
        if (summary.throughput < thresholds.throughput.minimum) {
            console.warn(`⚠️ Throughput below minimum: ${summary.throughput.toFixed(2)} RPS < ${thresholds.throughput.minimum} RPS`);
        }

        // Availability threshold
        const availability = 100 - summary.errorRate;
        if (availability < thresholds.availability.minimum) {
            console.warn(`⚠️ Availability below threshold: ${availability.toFixed(2)}% < ${thresholds.availability.minimum}%`);
        }
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            config: this.config,
            scenarios: this.scenarioResults,
            summary: this.generateOverallSummary(),
            recommendations: this.generateRecommendations()
        };

        // Save report to file
        const fs = require('fs');
        const reportPath = `./load-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n📋 Load test report saved to: ${reportPath}`);

        return report;
    }

    /**
     * Generate overall summary
     */
    generateOverallSummary() {
        const allScenarios = this.scenarioResults;

        return {
            totalScenarios: allScenarios.length,
            totalDuration: allScenarios.reduce((sum, scenario) => sum + scenario.duration, 0),
            totalRequests: allScenarios.reduce((sum, scenario) => sum + scenario.summary.totalRequests, 0),
            totalSuccessfulRequests: allScenarios.reduce((sum, scenario) => sum + scenario.summary.successfulRequests, 0),
            totalFailedRequests: allScenarios.reduce((sum, scenario) => sum + scenario.summary.failedRequests, 0),
            overallErrorRate: 0,
            overallThroughput: 0,
            avgResponseTime: 0,
            performanceTrend: this.calculatePerformanceTrend()
        };
    }

    /**
     * Calculate performance trend
     */
    calculatePerformanceTrend() {
        if (this.scenarioResults.length < 2) {
            return 'insufficient_data';
        }

        const firstScenario = this.scenarioResults[0];
        const lastScenario = this.scenarioResults[this.scenarioResults.length - 1];

        const firstThroughput = firstScenario.summary.throughput;
        const lastThroughput = lastScenario.summary.throughput;
        const firstResponseTime = firstScenario.summary.avgResponseTime;
        const lastResponseTime = lastScenario.summary.avgResponseTime;

        const throughputChange = ((lastThroughput - firstThroughput) / firstThroughput) * 100;
        const responseTimeChange = ((lastResponseTime - firstResponseTime) / firstResponseTime) * 100;

        if (throughputChange > -10 && responseTimeChange < 20) {
            return 'stable';
        } else if (throughputChange < -20 || responseTimeChange > 50) {
            return 'degrading';
        } else {
            return 'variable';
        }
    }

    /**
     * Generate summary report
     */
    generateSummaryReport(report) {
        console.log('\n📄 Load Testing Summary Report');
        console.log('='.repeat(50));

        // Overall statistics
        console.log('\n📊 Overall Statistics:');
        console.log(`  Total Scenarios: ${report.summary.totalScenarios}`);
        console.log(`  Total Duration: ${(report.summary.totalDuration / 1000).toFixed(1)} seconds`);
        console.log(`  Total Requests: ${report.summary.totalRequests.toLocaleString()}`);
        console.log(`  Successful Requests: ${report.summary.totalSuccessfulRequests.toLocaleString()}`);
        console.log(`  Failed Requests: ${report.summary.totalFailedRequests.toLocaleString()}`);

        const overallErrorRate = report.summary.totalRequests > 0 ?
            (report.summary.totalFailedRequests / report.summary.totalRequests) * 100 : 0;
        console.log(`  Overall Error Rate: ${overallErrorRate.toFixed(2)}%`);

        // Scenario performance
        console.log('\n🎯 Scenario Performance:');
        report.scenarios.forEach((scenario, index) => {
            const status = scenario.summary.errorRate < 5 ? '✅' :
                          scenario.summary.errorRate < 10 ? '⚠️' : '❌';
            console.log(`  ${status} ${index + 1}. ${scenario.name}:`);
            console.log(`    Requests: ${scenario.summary.totalRequests.toLocaleString()}`);
            console.log(`    Response Time: ${scenario.summary.avgResponseTime.toFixed(2)}ms avg (${scenario.summary.p95.toFixed(2)}ms p95)`);
            console.log(`    Throughput: ${scenario.summary.throughput.toFixed(2)} RPS`);
            console.log(`    Error Rate: ${scenario.summary.errorRate.toFixed(2)}%`);
        });

        // Performance trend
        console.log(`\n📈 Performance Trend: ${report.summary.performanceTrend}`);

        // Recommendations
        if (report.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            report.recommendations.forEach(rec => {
                console.log(`  • ${rec}`);
            });
        }
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const overallErrorRate = this.summary.totalRequests > 0 ?
            (this.summary.totalFailedRequests / this.summary.totalRequests) * 100 : 0;

        // Error rate recommendations
        if (overallErrorRate > this.config.thresholds.errorRate.critical) {
            recommendations.push('Critical error rate detected - immediate investigation required');
        } else if (overallErrorRate > this.config.thresholds.errorRate.warning) {
            recommendations.push('Error rate above acceptable threshold - investigate root causes');
        }

        // Response time recommendations
        const slowScenarios = this.scenarioResults.filter(scenario =>
            scenario.summary.p95 > this.config.thresholds.responseTime.p95
        );

        if (slowScenarios.length > 0) {
            recommendations.push('High response times detected - consider optimization or scaling');
        }

        // Throughput recommendations
        const lowThroughputScenarios = this.scenarioResults.filter(scenario =>
            scenario.summary.throughput < this.config.thresholds.throughput.minimum
        );

        if (lowThroughputScenarios.length > 0) {
            recommendations.push('Low throughput detected - check for bottlenecks or resource constraints');
        }

        // Scaling recommendations
        const maxConcurrentUsers = Math.max(...this.scenarioResults.map(s => s.concurrentUsers));
        const maxSuccessfulScenarios = this.scenarioResults.filter(s => s.summary.errorRate < 5);

        if (maxSuccessfulScenarios.length < this.scenarioResults.length) {
            const failingAtLoad = this.scenarioResults.find(s => s.summary.errorRate > 5);
            if (failingAtLoad) {
                recommendations.push(`System becomes unstable at ${failingAtLoad.concurrentUsers} concurrent users - consider scaling or optimization`);
            }
        }

        // Performance trend recommendations
        const trend = this.calculatePerformanceTrend();
        if (trend === 'degrading') {
            recommendations.push('Performance degrades under load - investigate resource leaks or bottlenecks');
        }

        return recommendations;
    }

    /**
     * Utility functions
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
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
        } else if (args[i] === '--scenarios') {
            try {
                config.scenarios = JSON.parse(args[i + 1]);
            } catch (e) {
                console.error('Invalid scenarios JSON format');
                process.exit(1);
            }
        } else if (args[i] === '--output') {
            config.outputFile = args[i + 1];
        } else if (args[i] === '--scenario') {
            // Run single scenario by name
            const scenarioName = args[i + 1];
            const scenario = LOAD_TEST_CONFIG.scenarios.find(s => s.name === scenarioName);
            if (scenario) {
                config.scenarios = [scenario];
            }
        }
    }

    // Run load tests
    const tester = new LoadTester(config);

    // Set up event listeners
    tester.on('progress', (metrics) => {
        console.log(`📊 Active: ${metrics.activeUsers}, RPS: ${metrics.throughput.toFixed(1)}, Errors: ${metrics.errorRate.toFixed(1)}%`);
    });

    tester.on('critical-error', (metrics) => {
        console.error(`🚨 Critical error rate: ${metrics.errorRate.toFixed(2)}%`);
    });

    tester.runScenarios()
        .then(results => {
            if (config.outputFile) {
                const fs = require('fs');
                fs.writeFileSync(config.outputFile, JSON.stringify(results, null, 2));
                console.log(`\n📁 Results saved to: ${config.outputFile}`);
            }

            // Exit with appropriate code based on performance
            const overallErrorRate = results.summary.totalRequests > 0 ?
                (results.summary.totalFailedRequests / results.summary.totalRequests) * 100 : 0;

            if (overallErrorRate > 10) {
                process.exit(1); // Critical performance issues
            } else if (overallErrorRate > 5) {
                process.exit(2); // Performance warnings
            } else {
                process.exit(0); // Good performance
            }
        })
        .catch(error => {
            console.error('Load testing failed:', error);
            process.exit(1);
        });
}

module.exports = LoadTester;