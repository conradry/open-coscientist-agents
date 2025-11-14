#!/usr/bin/env node

/**
 * Cloudflare End-to-End Deployment Validation Framework
 * Comprehensive integration testing for deployed applications
 */

const { performance } = require('perf_hooks');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Integration test configuration
const INTEGRATION_TEST_CONFIG = {
    // Test environment
    environment: 'production', // development, staging, production
    baseUrl: 'https://example.com',
    apiBaseUrl: 'https://api.example.com',

    // Test configuration
    test: {
        timeout: 30000, // 30 seconds per test
        retries: 3,
        retryDelay: 1000,
        parallel: true,
        continueOnFailure: false
    },

    // Authentication configuration
    auth: {
        enabled: false,
        method: 'bearer', // bearer, basic, cookie
        credentials: {
            token: '',
            username: '',
            password: '',
            cookieName: ''
        }
    },

    // Test suites
    suites: [
        {
            name: 'Basic Functionality',
            description: 'Core application functionality tests',
            critical: true,
            tests: [
                {
                    name: 'Homepage Loads',
                    method: 'GET',
                    path: '/',
                    expectedStatus: 200,
                    expectedHeaders: { 'content-type': /text\/html/ },
                    assertions: [
                        { type: 'contains', value: '<html' },
                        { type: 'contains', value: '</html>' },
                        { type: 'response_time', max: 3000 }
                    ]
                },
                {
                    name: 'Static Assets Load',
                    method: 'GET',
                    path: '/styles/main.css',
                    expectedStatus: 200,
                    expectedHeaders: { 'content-type': /text\/css/ },
                    assertions: [
                        { type: 'response_time', max: 1000 }
                    ]
                },
                {
                    name: 'JavaScript Assets Load',
                    method: 'GET',
                    path: '/scripts/main.js',
                    expectedStatus: 200,
                    expectedHeaders: { 'content-type': /application\/javascript/ },
                    assertions: [
                        { type: 'response_time', max: 2000 }
                    ]
                }
            ]
        },
        {
            name: 'API Functionality',
            description: 'API endpoint functionality tests',
            critical: true,
            tests: [
                {
                    name: 'Health Check',
                    method: 'GET',
                    path: '/api/health',
                    expectedStatus: 200,
                    expectedHeaders: { 'content-type': /application\/json/ },
                    assertions: [
                        { type: 'json_path', path: 'status', value: 'ok' },
                        { type: 'json_path', path: 'timestamp', exists: true },
                        { type: 'response_time', max: 1000 }
                    ]
                },
                {
                    name: 'API Version',
                    method: 'GET',
                    path: '/api/version',
                    expectedStatus: 200,
                    expectedHeaders: { 'content-type': /application\/json/ },
                    assertions: [
                        { type: 'json_path', path: 'version', exists: true },
                        { type: 'json_path', path: 'api', exists: true }
                    ]
                }
            ]
        },
        {
            name: 'User Authentication',
            description: 'Authentication and authorization tests',
            critical: false,
            tests: [
                {
                    name: 'Login Endpoint',
                    method: 'POST',
                    path: '/api/auth/login',
                    body: { username: 'test@example.com', password: 'testpassword' },
                    expectedStatus: 401, // Should fail with invalid credentials
                    assertions: [
                        { type: 'json_path', path: 'error', exists: true }
                    ]
                },
                {
                    name: 'Protected Endpoint',
                    method: 'GET',
                    path: '/api/protected',
                    expectedStatus: 401, // Should fail without auth
                    assertions: [
                        { type: 'json_path', path: 'error', value: 'Unauthorized' }
                    ]
                }
            ]
        },
        {
            name: 'Error Handling',
            description: 'Error handling and edge case tests',
            critical: false,
            tests: [
                {
                    name: '404 Error Handling',
                    method: 'GET',
                    path: '/nonexistent-page',
                    expectedStatus: 404,
                    assertions: [
                        { type: 'contains', value: '404' },
                        { type: 'response_time', max: 2000 }
                    ]
                },
                {
                    name: 'Invalid Method',
                    method: 'POST',
                    path: '/api/health',
                    expectedStatus: 405,
                    assertions: [
                        { type: 'contains', value: 'Method Not Allowed' }
                    ]
                }
            ]
        },
        {
            name: 'Security Headers',
            description: 'Security headers validation',
            critical: true,
            tests: [
                {
                    name: 'Security Headers Present',
                    method: 'GET',
                    path: '/',
                    expectedStatus: 200,
                    assertions: [
                        { type: 'header', name: 'x-frame-options', exists: true },
                        { type: 'header', name: 'x-content-type-options', exists: true },
                        { type: 'header', name: 'x-xss-protection', exists: true },
                        { type: 'header', name: 'strict-transport-security', exists: true }
                    ]
                }
            ]
        },
        {
            name: 'Performance',
            description: 'Performance-related tests',
            critical: false,
            tests: [
                {
                    name: 'Page Load Performance',
                    method: 'GET',
                    path: '/',
                    expectedStatus: 200,
                    assertions: [
                        { type: 'response_time', max: 3000 },
                        { type: 'header', name: 'content-length', max: 1048576 } // 1MB
                    ]
                }
            ]
        }
    ],

    // Monitoring and reporting
    monitoring: {
        collectMetrics: true,
        detailedLogs: true,
        screenshots: false,
        networkLogs: true
    }
};

// Test Runner class
class TestRunner {
    constructor(config = {}) {
        this.config = { ...INTEGRATION_TEST_CONFIG, ...config };
        this.results = [];
        this.startTime = null;
        this.endTime = null;
        this.sessionId = this.generateSessionId();
    }

    /**
     * Run all integration test suites
     */
    async runTests() {
        console.log('🚀 Starting integration tests...');
        console.log(`📋 Testing environment: ${this.config.environment}`);
        console.log(`🌐 Base URL: ${this.config.baseUrl}`);
        console.log(`📊 Test suites: ${this.config.suites.length}`);

        this.startTime = Date.now();

        try {
            // Pre-flight checks
            await this.preFlightChecks();

            // Run test suites
            for (const suite of this.config.suites) {
                console.log(`\n🧪 Running test suite: ${suite.name}`);
                console.log(`📝 ${suite.description}`);

                const suiteResult = await this.runSuite(suite);
                this.results.push(suiteResult);

                // Check if we should continue on failure
                if (!suiteResult.success && !this.config.test.continueOnFailure) {
                    console.log(`❌ Critical suite failed: ${suite.name}`);
                    break;
                }
            }

            this.endTime = Date.now();

            // Generate report
            const report = this.generateReport();
            this.generateSummaryReport(report);

            console.log('\n✅ Integration tests completed');
            console.log(`⏱️ Total test duration: ${this.endTime - this.startTime}ms`);

            return report;

        } catch (error) {
            this.endTime = Date.now();
            console.error('❌ Integration tests failed:', error);
            throw error;
        }
    }

    /**
     * Perform pre-flight checks
     */
    async preFlightChecks() {
        console.log('🔍 Performing pre-flight checks...');

        // Check if base URL is accessible
        try {
            const response = await this.makeRequest(this.config.baseUrl);
            if (response.statusCode >= 500) {
                throw new Error(`Server error: ${response.statusCode}`);
            }
            console.log('✅ Base URL is accessible');
        } catch (error) {
            throw new Error(`Base URL not accessible: ${error.message}`);
        }

        // Check API URL if configured
        if (this.config.apiBaseUrl && this.config.apiBaseUrl !== this.config.baseUrl) {
            try {
                const response = await this.makeRequest(this.config.apiBaseUrl);
                if (response.statusCode >= 500) {
                    throw new Error(`API server error: ${response.statusCode}`);
                }
                console.log('✅ API URL is accessible');
            } catch (error) {
                throw new Error(`API URL not accessible: ${error.message}`);
            }
        }

        console.log('✅ Pre-flight checks passed');
    }

    /**
     * Run a single test suite
     */
    async runSuite(suite) {
        const suiteResult = {
            name: suite.name,
            description: suite.description,
            critical: suite.critical,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            success: true,
            tests: [],
            summary: {
                total: suite.tests.length,
                passed: 0,
                failed: 0,
                skipped: 0,
                totalAssertions: 0,
                passedAssertions: 0,
                failedAssertions: 0
            }
        };

        console.log(`📋 Running ${suite.tests.length} tests...`);

        // Run tests in parallel or sequentially
        if (this.config.test.parallel) {
            await this.runTestsParallel(suite, suiteResult);
        } else {
            await this.runTestsSequential(suite, suiteResult);
        }

        suiteResult.endTime = Date.now();
        suiteResult.duration = suiteResult.endTime - suiteResult.startTime;

        // Calculate success
        suiteResult.success = suiteResult.summary.failed === 0 ||
                           (!suite.critical && suiteResult.summary.failed < suite.tests.length);

        console.log(`📊 Suite results: ${suiteResult.summary.passed} passed, ${suiteResult.summary.failed} failed`);

        return suiteResult;
    }

    /**
     * Run tests in parallel
     */
    async runTestsParallel(suite, suiteResult) {
        const testPromises = suite.tests.map(test =>
            this.runTest(test, suite)
                .then(result => {
                    suiteResult.tests.push(result);
                    this.updateSuiteSummary(suiteResult, result);
                    return result;
                })
                .catch(error => {
                    console.error(`Test "${test.name}" failed:`, error);
                    const failedResult = {
                        name: test.name,
                        success: false,
                        error: error.message,
                        duration: 0,
                        assertions: [],
                        response: null
                    };
                    suiteResult.tests.push(failedResult);
                    this.updateSuiteSummary(suiteResult, failedResult);
                    return failedResult;
                })
        );

        await Promise.all(testPromises);
    }

    /**
     * Run tests sequentially
     */
    async runTestsSequential(suite, suiteResult) {
        for (const test of suite.tests) {
            try {
                const result = await this.runTest(test, suite);
                suiteResult.tests.push(result);
                this.updateSuiteSummary(suiteResult, result);
            } catch (error) {
                console.error(`Test "${test.name}" failed:`, error);
                const failedResult = {
                    name: test.name,
                    success: false,
                    error: error.message,
                    duration: 0,
                    assertions: [],
                    response: null
                };
                suiteResult.tests.push(failedResult);
                this.updateSuiteSummary(suiteResult, failedResult);
            }
        }
    }

    /**
     * Run a single test
     */
    async runTest(test, suite) {
        const startTime = performance.now();

        console.log(`  🧪 Running: ${test.name}`);

        const testResult = {
            name: test.name,
            success: true,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            response: null,
            assertions: [],
            error: null,
            logs: []
        };

        try {
            // Build URL
            const url = this.buildUrl(test, suite);

            // Build request options
            const options = this.buildRequestOptions(test, url);

            // Make request with retries
            const response = await this.makeRequestWithRetry(url, options, test);
            testResult.response = response;

            // Run assertions
            await this.runAssertions(test, response, testResult);

            testResult.success = testResult.assertions.filter(a => !a.passed).length === 0;

        } catch (error) {
            testResult.success = false;
            testResult.error = error.message;
            testResult.logs.push(`Error: ${error.message}`);
        }

        const endTime = performance.now();
        testResult.duration = Math.round(endTime - startTime);
        testResult.endTime = Date.now();

        // Log result
        const status = testResult.success ? '✅' : '❌';
        const duration = testResult.duration;
        console.log(`    ${status} ${test.name} (${duration}ms)`);

        if (!testResult.success && testResult.error) {
            console.log(`    💬 ${testResult.error}`);
        }

        return testResult;
    }

    /**
     * Build URL for test
     */
    buildUrl(test, suite) {
        let baseUrl = test.path.startsWith('/api/') ? this.config.apiBaseUrl : this.config.baseUrl;

        // Remove trailing slash from base URL if present
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        // Ensure path starts with /
        let path = test.path;
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        return baseUrl + path;
    }

    /**
     * Build request options
     */
    buildRequestOptions(test, url) {
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: test.method || 'GET',
            headers: {
                'User-Agent': `Cloudflare-IntegrationTest/${this.sessionId}`,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br',
                'X-Test-Session': this.sessionId
            },
            timeout: this.config.test.timeout
        };

        // Add test headers
        if (test.headers) {
            options.headers = { ...options.headers, ...test.headers };
        }

        // Add authentication
        if (this.config.auth.enabled) {
            this.addAuthentication(options);
        }

        // Add body for POST/PUT requests
        if ((test.method === 'POST' || test.method === 'PUT') && test.body) {
            const bodyData = typeof test.body === 'string' ? test.body : JSON.stringify(test.body);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(bodyData);
            options.body = bodyData;
        }

        return options;
    }

    /**
     * Add authentication to request
     */
    addAuthentication(options) {
        const auth = this.config.auth;

        switch (auth.method) {
            case 'bearer':
                if (auth.credentials.token) {
                    options.headers['Authorization'] = `Bearer ${auth.credentials.token}`;
                }
                break;
            case 'basic':
                if (auth.credentials.username && auth.credentials.password) {
                    const credentials = Buffer.from(`${auth.credentials.username}:${auth.credentials.password}`).toString('base64');
                    options.headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
            case 'cookie':
                if (auth.credentials.cookieName && auth.credentials.token) {
                    options.headers['Cookie'] = `${auth.credentials.cookieName}=${auth.credentials.token}`;
                }
                break;
        }
    }

    /**
     * Make HTTP request with retry logic
     */
    async makeRequestWithRetry(url, options, test) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.test.retries + 1; attempt++) {
            try {
                const response = await this.makeRequestWithOptions(options);
                return response;
            } catch (error) {
                lastError = error;

                if (attempt <= this.config.test.retries) {
                    const delay = this.config.test.retryDelay * attempt;
                    console.log(`    🔄 Retry ${attempt}/${this.config.test.retries} for ${test.name} (${delay}ms)`);
                    await this.delay(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Make HTTP request
     */
    async makeRequestWithOptions(options) {
        const url = `https://${options.hostname}${options.path}`;

        return new Promise((resolve, reject) => {
            const client = https;

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

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    /**
     * Run test assertions
     */
    async runAssertions(test, response, testResult) {
        for (const assertion of test.assertions || []) {
            const assertionResult = this.runAssertion(assertion, response, test);
            testResult.assertions.push(assertionResult);

            if (!assertionResult.passed) {
                testResult.logs.push(`Assertion failed: ${assertionResult.message}`);
            }
        }

        // Add default assertions
        if (test.expectedStatus !== undefined) {
            const statusAssertion = this.runAssertion({
                type: 'status_code',
                value: test.expectedStatus
            }, response, test);
            testResult.assertions.push(statusAssertion);
        }

        if (test.expectedHeaders) {
            for (const [headerName, expectedValue] of Object.entries(test.expectedHeaders)) {
                const headerAssertion = this.runAssertion({
                    type: 'header',
                    name: headerName.toLowerCase(),
                    value: expectedValue
                }, response, test);
                testResult.assertions.push(headerAssertion);
            }
        }
    }

    /**
     * Run a single assertion
     */
    runAssertion(assertion, response, test) {
        const result = {
            type: assertion.type,
            passed: false,
            expected: assertion.value,
            actual: null,
            message: ''
        };

        try {
            switch (assertion.type) {
                case 'status_code':
                    result.actual = response.statusCode;
                    result.passed = response.statusCode === assertion.value;
                    result.message = result.passed ?
                        `Status code is ${response.statusCode}` :
                        `Expected status code ${assertion.value}, got ${response.statusCode}`;
                    break;

                case 'contains':
                    result.actual = response.body;
                    result.passed = response.body.includes(assertion.value);
                    result.message = result.passed ?
                        `Response contains "${assertion.value}"` :
                        `Response does not contain "${assertion.value}"`;
                    break;

                case 'json_path':
                    result.actual = this.getJsonPath(response.body, assertion.path);
                    if (assertion.exists) {
                        result.passed = result.actual !== null && result.actual !== undefined;
                        result.message = result.passed ?
                            `JSON path "${assertion.path}" exists` :
                            `JSON path "${assertion.path}" does not exist`;
                    } else {
                        result.passed = result.actual === assertion.value;
                        result.message = result.passed ?
                            `JSON path "${assertion.path}" is ${JSON.stringify(assertion.value)}` :
                            `JSON path "${assertion.path}" expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(result.actual)}`;
                    }
                    break;

                case 'header':
                    const headerValue = response.headers[assertion.name];
                    result.actual = headerValue;

                    if (typeof assertion.value === 'boolean' && assertion.value === true) {
                        result.passed = headerValue !== undefined;
                        result.message = result.passed ?
                            `Header "${assertion.name}" is present` :
                            `Header "${assertion.name}" is missing`;
                    } else if (assertion.value instanceof RegExp) {
                        result.passed = assertion.value.test(headerValue || '');
                        result.message = result.passed ?
                            `Header "${assertion.name}" matches pattern` :
                            `Header "${assertion.name}" does not match pattern`;
                    } else {
                        result.passed = headerValue === assertion.value;
                        result.message = result.passed ?
                            `Header "${assertion.name}" is "${assertion.value}"` :
                            `Header "${assertion.name}" expected "${assertion.value}", got "${headerValue}"`;
                    }
                    break;

                case 'response_time':
                    const responseTime = response.responseTime || 0;
                    result.actual = responseTime;
                    result.passed = responseTime <= assertion.max;
                    result.message = result.passed ?
                        `Response time ${responseTime}ms is within ${assertion.max}ms` :
                        `Response time ${responseTime}ms exceeds ${assertion.max}ms`;
                    break;

                case 'content_length':
                    const contentLength = parseInt(response.headers['content-length'] || '0');
                    result.actual = contentLength;

                    if (assertion.max) {
                        result.passed = contentLength <= assertion.max;
                        result.message = result.passed ?
                            `Content length ${contentLength} bytes is within ${assertion.max} bytes` :
                            `Content length ${contentLength} bytes exceeds ${assertion.max} bytes`;
                    }
                    break;

                default:
                    result.passed = false;
                    result.message = `Unknown assertion type: ${assertion.type}`;
            }
        } catch (error) {
            result.passed = false;
            result.message = `Assertion error: ${error.message}`;
        }

        return result;
    }

    /**
     * Get value from JSON path
     */
    getJsonPath(jsonString, path) {
        try {
            const obj = JSON.parse(jsonString);
            const pathParts = path.split('.');
            let current = obj;

            for (const part of pathParts) {
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    return null;
                }
            }

            return current;
        } catch (error) {
            return null;
        }
    }

    /**
     * Update suite summary
     */
    updateSuiteSummary(suiteResult, testResult) {
        suiteResult.summary.total++;

        if (testResult.success) {
            suiteResult.summary.passed++;
        } else {
            suiteResult.summary.failed++;
        }

        suiteResult.summary.totalAssertions += testResult.assertions.length;
        suiteResult.summary.passedAssertions += testResult.assertions.filter(a => a.passed).length;
        suiteResult.summary.failedAssertions += testResult.assertions.filter(a => !a.passed).length;
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        const report = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            environment: this.config.environment,
            baseUrl: this.config.baseUrl,
            apiBaseUrl: this.config.apiBaseUrl,
            config: this.config,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.endTime - this.startTime,
            suites: this.results,
            summary: this.generateOverallSummary(),
            recommendations: this.generateRecommendations()
        };

        // Save report to file
        const fs = require('fs');
        const reportPath = `./integration-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\n📋 Integration test report saved to: ${reportPath}`);

        return report;
    }

    /**
     * Generate overall summary
     */
    generateOverallSummary() {
        const allSuites = this.results;
        const criticalSuites = allSuites.filter(suite => suite.critical);

        return {
            totalSuites: allSuites.length,
            criticalSuites: criticalSuites.length,
            totalTests: allSuites.reduce((sum, suite) => sum + suite.summary.total, 0),
            passedTests: allSuites.reduce((sum, suite) => sum + suite.summary.passed, 0),
            failedTests: allSuites.reduce((sum, suite) => sum + suite.summary.failed, 0),
            skippedTests: allSuites.reduce((sum, suite) => sum + suite.summary.skipped, 0),
            totalAssertions: allSuites.reduce((sum, suite) => sum + suite.summary.totalAssertions, 0),
            passedAssertions: allSuites.reduce((sum, suite) => sum + suite.summary.passedAssertions, 0),
            failedAssertions: allSuites.reduce((sum, suite) => sum + suite.summary.failedAssertions, 0),
            successRate: 0,
            overallSuccess: false,
            failedSuites: allSuites.filter(suite => !suite.success).map(suite => suite.name)
        };
    }

    /**
     * Generate human-readable summary report
     */
    generateSummaryReport(report) {
        console.log('\n📄 Integration Test Summary Report');
        console.log('='.repeat(50));

        // Overall statistics
        console.log('\n📊 Overall Statistics:');
        console.log(`  Environment: ${report.environment}`);
        console.log(`  Base URL: ${report.baseUrl}`);
        console.log(`  Total Suites: ${report.summary.totalSuites}`);
        console.log(`  Critical Suites: ${report.summary.criticalSuites}`);
        console.log(`  Total Tests: ${report.summary.totalTests}`);
        console.log(`  Passed Tests: ${report.summary.passedTests}`);
        console.log(`  Failed Tests: ${report.summary.failedTests}`);
        console.log(`  Test Success Rate: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(2)}%`);
        console.log(`  Total Assertions: ${report.summary.totalAssertions}`);
        console.log(`  Assertion Success Rate: ${((report.summary.passedAssertions / report.summary.totalAssertions) * 100).toFixed(2)}%`);

        // Suite results
        console.log('\n🧪 Test Suite Results:');
        report.suites.forEach((suite, index) => {
            const status = suite.success ? '✅' : '❌';
            const critical = suite.critical ? ' (Critical)' : '';
            console.log(`  ${status} ${index + 1}. ${suite.name}${critical}: ${suite.summary.passed}/${suite.summary.total} tests passed`);

            // Show failed tests
            const failedTests = suite.tests.filter(test => !test.success);
            if (failedTests.length > 0) {
                failedTests.forEach(test => {
                    console.log(`    ❌ ${test.name}: ${test.error || 'Failed assertions'}`);
                });
            }
        });

        // Overall success
        const overallSuccess = report.summary.failedTests === 0;
        console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);

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
        const summary = this.generateOverallSummary();

        // Failed tests recommendations
        if (summary.failedTests > 0) {
            recommendations.push(`${summary.failedTests} tests failed - review and fix issues`);

            if (summary.failedSuites.length > 0) {
                recommendations.push(`Critical failures in: ${summary.failedSuites.join(', ')}`);
            }
        }

        // Critical suite recommendations
        const criticalFailures = this.results.filter(suite => suite.critical && !suite.success);
        if (criticalFailures.length > 0) {
            recommendations.push('Critical test suites failed - do not proceed with deployment');
        }

        // Performance recommendations
        const slowTests = [];
        this.results.forEach(suite => {
            suite.tests.forEach(test => {
                const slowAssertion = test.assertions.find(a =>
                    a.type === 'response_time' && !a.passed
                );
                if (slowAssertion) {
                    slowTests.push(test.name);
                }
            });
        });

        if (slowTests.length > 0) {
            recommendations.push(`Performance issues detected in: ${slowTests.join(', ')}`);
        }

        // Security recommendations
        const securityFailures = [];
        this.results.forEach(suite => {
            if (suite.name.includes('Security') && !suite.success) {
                securityFailures.push(suite.name);
            }
        });

        if (securityFailures.length > 0) {
            recommendations.push('Security tests failed - address security concerns');
        }

        return recommendations;
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    let config = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        if (args[i] === '--env') {
            config.environment = args[i + 1];
        } else if (args[i] === '--url') {
            config.baseUrl = args[i + 1];
        } else if (args[i] === '--api-url') {
            config.apiBaseUrl = args[i + 1];
        } else if (args[i] === '--suite') {
            const suiteName = args[i + 1];
            const suite = INTEGRATION_TEST_CONFIG.suites.find(s => s.name === suiteName);
            if (suite) {
                config.suites = [suite];
            }
        } else if (args[i] === '--output') {
            config.outputFile = args[i + 1];
        } else if (args[i] === '--continue-on-failure') {
            config.test = { ...INTEGRATION_TEST_CONFIG.test, continueOnFailure: true };
        }
    }

    // Run integration tests
    const runner = new TestRunner(config);

    runner.runTests()
        .then(results => {
            if (config.outputFile) {
                const fs = require('fs');
                fs.writeFileSync(config.outputFile, JSON.stringify(results, null, 2));
                console.log(`\n📁 Results saved to: ${config.outputFile}`);
            }

            // Exit with appropriate code based on test results
            const criticalFailures = results.suites.filter(suite => suite.critical && !suite.success);
            if (criticalFailures.length > 0) {
                process.exit(1); // Critical failures
            } else if (results.summary.failedTests > 0) {
                process.exit(2); // Non-critical failures
            } else {
                process.exit(0); // All tests passed
            }
        })
        .catch(error => {
            console.error('Integration tests failed:', error);
            process.exit(1);
        });
}

module.exports = TestRunner;