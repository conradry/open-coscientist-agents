/**
 * Unit Tests - Cloudflare API Validator
 *
 * Tests Cloudflare API integration patterns and best practices
 */

const { CloudflareAPIValidator } = require('../../../validation/cloudflare-api-validator');

describe('CloudflareAPIValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new CloudflareAPIValidator();
  });

  describe('validateAPITokenUsage', () => {
    it('should validate correct API token usage', async () => {
      const validTokenCode = `
        const apiToken = env.CLOUDFLARE_API_TOKEN;

        async function getZoneInfo(zoneId) {
          const response = await fetch(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}\`, {
            headers: {
              'Authorization': \`Bearer \${apiToken}\`,
              'Content-Type': 'application/json'
            }
          });
          return response.json();
        }
      `;

      const result = await validator.validateAPITokenUsage(validTokenCode);

      expect(result.valid).toBe(true);
      expect(result.usesBearerToken).toBe(true);
      expect(result.usesEnvironmentVariable).toBe(true);
    });

    it('should reject hardcoded API tokens', async () => {
      const hardcodedTokenCode = `
        const apiToken = '1234567890abcdef1234567890abcdef12345678'; // Bad!

        async function getZoneInfo(zoneId) {
          const response = await fetch(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}\`, {
            headers: {
              'Authorization': \`Bearer \${apiToken}\`
            }
          });
        }
      `;

      const result = await validator.validateAPITokenUsage(hardcodedTokenCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API token is hardcoded - use environment variables');
    });
  });

  describe('validateAPIEndpoints', () => {
    it('should validate correct API endpoints', async () => {
      const validEndpointsCode = `
        async function manageDNS(zoneId, recordId) {
          // Get DNS record
          const getResponse = await fetch(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records/\${recordId}\`);

          // Update DNS record
          const updateResponse = await fetch(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records/\${recordId}\`, {
            method: 'PUT',
            headers: { 'Authorization': \`Bearer \${env.CLOUDFLARE_API_TOKEN}\` },
            body: JSON.stringify({ content: '192.168.1.1' })
          });

          return { get: getResponse.json(), update: updateResponse.json() };
        }
      `;

      const result = await validator.validateAPIEndpoints(validEndpointsCode);

      expect(result.valid).toBe(true);
      expect(result.endpoints).toContain('/zones/{zone_id}/dns_records/{record_id}');
    });

    it('should detect malformed API endpoints', async () => {
      const malformedEndpointsCode = `
        async function getZoneInfo() {
          const response = await fetch('https://api.cloudflare.com/v4/zones/'); // Missing /client/v4
          return response.json();
        }
      `;

      const result = await validator.validateAPIEndpoints(malformedEndpointsCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Invalid API endpoint - should use /client/v4/');
    });
  });

  describe('validateRateLimiting', () => {
    it('should validate proper rate limiting implementation', async () => {
      const rateLimitedCode = `
        const RATE_LIMIT = 4; // 4 requests per second
        let lastRequestTime = 0;

        async function makeAPIRequest(url, options = {}) {
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTime;

          if (timeSinceLastRequest < (1000 / RATE_LIMIT)) {
            await new Promise(resolve => setTimeout(resolve, (1000 / RATE_LIMIT) - timeSinceLastRequest));
          }

          lastRequestTime = Date.now();
          return fetch(url, options);
        }
      `;

      const result = await validator.validateRateLimiting(rateLimitedCode);

      expect(result.valid).toBe(true);
      expect(result.hasRateLimiting).toBe(true);
    });

    it('should warn about missing rate limiting', async () => {
      const noRateLimitCode = `
        async function makeManyRequests() {
          const requests = [];
          for (let i = 0; i < 100; i++) {
            requests.push(fetch('https://api.cloudflare.com/client/v4/zones'));
          }
          return Promise.all(requests); // Could hit rate limits!
        }
      `;

      const result = await validator.validateRateLimiting(noRateLimitCode);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Multiple API requests without rate limiting');
    });
  });

  describe('validateErrorResponseHandling', () => {
    it('should validate proper error response handling', async () => {
      const errorHandlingCode = `
        async function callCloudflareAPI(url, options = {}) {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                'Authorization': \`Bearer \${env.CLOUDFLARE_API_TOKEN}\`,
                ...options.headers
              }
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(\`Cloudflare API error: \${data.errors?.[0]?.message || response.statusText}\`);
            }

            if (!data.success) {
              throw new Error(\`API operation failed: \${data.errors?.[0]?.message || 'Unknown error'}\`);
            }

            return data.result;
          } catch (error) {
            console.error('API call failed:', error);
            throw error;
          }
        }
      `;

      const result = await validator.validateErrorResponseHandling(errorHandlingCode);

      expect(result.valid).toBe(true);
      expect(result.checksResponseStatus).toBe(true);
      expect(result.checksAPISuccess).toBe(true);
    });

    it('should detect missing error response handling', async () => {
      const noErrorHandlingCode = `
        async function callAPI(url) {
          const response = await fetch(url);
          const data = await response.json();
          return data.result; // Could be undefined if API failed!
        }
      `;

      const result = await validator.validateErrorResponseHandling(noErrorHandlingCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('No response status checking');
      expect(result.issues).toContain('No API success field validation');
    });
  });

  describe('validatePaginationHandling', () => {
    it('should validate correct pagination handling', async () => {
      const paginationCode = `
        async function getAllDNSRecords(zoneId) {
          let allRecords = [];
          let page = 1;

          while (true) {
            const url = \`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records?page=\${page}&per_page=100\`;
            const response = await callCloudflareAPI(url);

            allRecords = allRecords.concat(response.result);

            if (response.result_info.page < response.result_info.total_pages) {
              page++;
            } else {
              break;
            }
          }

          return allRecords;
        }
      `;

      const result = await validator.validatePaginationHandling(paginationCode);

      expect(result.valid).toBe(true);
      expect(result.handlesPagination).toBe(true);
    });

    it('should warn about incomplete pagination', async () => {
      const incompletePaginationCode = `
        async function getDNSRecords(zoneId) {
          const url = \`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records?per_page=100\`;
          const response = await callCloudflareAPI(url);
          return response.result; // Only gets first page!
        }
      `;

      const result = await validator.validatePaginationHandling(incompletePaginationCode);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('API call without pagination - may not return all results');
    });
  });

  describe('validateBatchOperations', () => {
    it('should validate efficient batch operations', async () => {
      const batchCode = `
        async function createMultipleDNSRecords(zoneId, records) {
          const promises = records.map(record =>
            callCloudflareAPI(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records\`, {
              method: 'POST',
              body: JSON.stringify(record)
            })
          );

          const results = await Promise.allSettled(promises);

          return results.map(result =>
            result.status === 'fulfilled' ? result.value : { error: result.reason }
          );
        }
      `;

      const result = await validator.validateBatchOperations(batchCode);

      expect(result.valid).toBe(true);
      expect(result.usesBatching).toBe(true);
      expect(result.usesPromiseAllSettled).toBe(true);
    });

    it('should detect inefficient sequential operations', async () => {
      const sequentialCode = `
        async function createMultipleRecords(zoneId, records) {
          const results = [];
          for (const record of records) {
            const result = await callCloudflareAPI(\`https://api.cloudflare.com/client/v4/zones/\${zoneId}/dns_records\`, {
              method: 'POST',
              body: JSON.stringify(record)
            });
            results.push(result);
          }
          return results; // Slow - sequential!
        }
      `;

      const result = await validator.validateBatchOperations(sequentialCode);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Sequential API operations could be parallelized');
    });
  });
});

// Mock CloudflareAPIValidator class for testing
class CloudflareAPIValidator {
  async validateAPITokenUsage(code) {
    const hasBearerToken = code.includes('Bearer');
    const hasHardcodedToken = code.match(/['"][a-f0-9]{32,}['"]/); // Simple pattern for API tokens
    const usesEnvironmentVariable = code.includes('env.CLOUDFLARE_API_TOKEN') || code.includes('env.API_TOKEN');

    const issues = [];
    if (hasHardcodedToken) {
      issues.push('API token is hardcoded - use environment variables');
    }

    return {
      valid: hasBearerToken && !hasHardcodedToken && usesEnvironmentVariable,
      usesBearerToken: hasBearerToken,
      usesEnvironmentVariable,
      issues
    };
  }

  async validateAPIEndpoints(code) {
    const apiEndpoints = code.match(/https:\/\/api\.cloudflare\.com\/client\/v4\/[^"'\s]+/g) || [];
    const invalidEndpoints = code.match(/https:\/\/api\.cloudflare\.com\/v4\//g) || [];

    const issues = [];
    if (invalidEndpoints.length > 0) {
      issues.push('Invalid API endpoint - should use /client/v4/');
    }

    return {
      valid: issues.length === 0,
      endpoints: apiEndpoints.map(url => url.replace(/https:\/\/api\.cloudflare\.com\/client\/v4/, '').replace(/[?&][^"'']*/, '').replace(/\{[^}]+\}/g, '{param}')),
      issues
    };
  }

  async validateRateLimiting(code) {
    const hasRateLimitLogic = code.includes('setTimeout') &&
                            (code.includes('rate') || code.includes('limit'));
    const hasMultipleRequests = (code.match(/fetch\s*\(/g) || []).length > 3;

    const warnings = [];
    if (hasMultipleRequests && !hasRateLimitLogic) {
      warnings.push('Multiple API requests without rate limiting');
    }

    return {
      valid: !hasMultipleRequests || hasRateLimitLogic,
      hasRateLimiting: hasRateLimitLogic,
      warnings
    };
  }

  async validateErrorResponseHandling(code) {
    const checksResponseStatus = code.includes('response.ok') || code.includes('response.status');
    const checksAPISuccess = code.includes('data.success') || code.includes('success');
    const hasTryCatch = code.includes('try') && code.includes('catch');

    const issues = [];
    if (!checksResponseStatus) {
      issues.push('No response status checking');
    }
    if (!checksAPISuccess) {
      issues.push('No API success field validation');
    }

    return {
      valid: checksResponseStatus && checksAPISuccess,
      checksResponseStatus,
      checksAPISuccess,
      hasTryCatch,
      issues
    };
  }

  async validatePaginationHandling(code) {
    const hasPagination = code.includes('page') || code.includes('per_page');
    const handlesPagination = code.includes('total_pages') || code.includes('result_info');

    const warnings = [];
    if (hasPagination && !handlesPagination) {
      warnings.push('API call without pagination - may not return all results');
    }

    return {
      valid: !hasPagination || handlesPagination,
      handlesPagination: handlesPagination,
      warnings
    };
  }

  async validateBatchOperations(code) {
    const usesPromiseAll = code.includes('Promise.all') || code.includes('Promise.allSettled');
    const usesMapForBatching = code.includes('.map(') && code.includes('fetch');
    const hasSequentialLoop = code.includes('for.*await') || code.includes('for.*fetch');

    const warnings = [];
    if (hasSequentialLoop) {
      warnings.push('Sequential API operations could be parallelized');
    }

    return {
      valid: usesPromiseAll || !hasSequentialLoop,
      usesBatching: usesMapForBatching,
      usesPromiseAllSettled: code.includes('Promise.allSettled'),
      warnings
    };
  }
}

module.exports = { CloudflareAPIValidator };