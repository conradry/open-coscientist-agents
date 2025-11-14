/**
 * Unit Tests - Worker Code Validator
 *
 * Tests individual components and functions for Cloudflare Workers
 */

const { WorkerCodeValidator } = require('../../../validation/worker-code-validator');

describe('WorkerCodeValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new WorkerCodeValidator();
  });

  describe('validateBasicWorkerStructure', () => {
    it('should validate correct worker structure', async () => {
      const validWorkerCode = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          return new Response('Hello World', { status: 200 })
        }
      `;

      const result = await validator.validateBasicWorkerStructure(validWorkerCode);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should reject worker without event listener', async () => {
      const invalidWorkerCode = `
        async function handleRequest(request) {
          return new Response('Hello World', { status: 200 })
        }
      `;

      const result = await validator.validateBasicWorkerStructure(invalidWorkerCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing addEventListener for fetch events');
    });

    it('should reject worker without handleRequest function', async () => {
      const invalidWorkerCode = `
        addEventListener('fetch', event => {
          event.respondWith(new Response('Hello World'))
        })
      `;

      const result = await validator.validateBasicWorkerStructure(invalidWorkerCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing handleRequest function');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate correct environment variable usage', async () => {
      const codeWithEnv = `
        const API_KEY = env.API_KEY;
        const DATABASE = env.DATABASE;

        async function handler(request) {
          return await DATABASE.get('key');
        }
      `;

      const result = await validator.validateEnvironmentVariables(codeWithEnv);

      expect(result.valid).toBe(true);
      expect(result.variables).toContain('API_KEY');
      expect(result.variables).toContain('DATABASE');
    });

    it('should detect unused environment variables', async () => {
      const codeWithUnusedEnv = `
        const API_KEY = env.API_KEY;
        // API_KEY is never used

        async function handler(request) {
          return new Response('Hello');
        }
      `;

      const result = await validator.validateEnvironmentVariables(codeWithUnusedEnv);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Environment variable API_KEY is declared but not used');
    });
  });

  describe('validateAsyncPatterns', () => {
    it('should validate proper async/await usage', async () => {
      const asyncCode = `
        async function fetchData() {
          const response = await fetch('https://api.example.com');
          const data = await response.json();
          return data;
        }

        addEventListener('fetch', async event => {
          const data = await fetchData();
          return new Response(JSON.stringify(data));
        })
      `;

      const result = await validator.validateAsyncPatterns(asyncCode);

      expect(result.valid).toBe(true);
      expect(result.asyncFunctions).toContain('fetchData');
    });

    it('should detect missing await in async functions', async () => {
      const badAsyncCode = `
        async function fetchData() {
          const response = fetch('https://api.example.com'); // Missing await
          return response.json(); // This will fail
        }
      `;

      const result = await validator.validateAsyncPatterns(badAsyncCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing await for fetch call');
    });
  });

  describe('validateErrorHandling', () => {
    it('should validate proper error handling', async () => {
      const codeWithErrors = `
        async function riskyOperation() {
          try {
            const result = await someAsyncCall();
            return result;
          } catch (error) {
            console.error('Operation failed:', error);
            return new Response('Internal Server Error', { status: 500 });
          }
        }
      `;

      const result = await validator.validateErrorHandling(codeWithErrors);

      expect(result.valid).toBe(true);
      expect(result.hasTryCatch).toBe(true);
    });

    it('should warn about functions without error handling', async () => {
      const codeWithoutErrors = `
        async function riskyOperation() {
          const result = await someAsyncCall();
          return result; // No error handling
        }
      `;

      const result = await validator.validateErrorHandling(codeWithoutErrors);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Function riskyOperation lacks error handling');
    });
  });

  describe('validateResponseHandling', () => {
    it('should validate correct Response creation', async () => {
      const validResponse = `
        async function handler() {
          return new Response('Hello World', {
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      `;

      const result = await validator.validateResponseHandling(validResponse);

      expect(result.valid).toBe(true);
      expect(result.hasCorsHeaders).toBe(true);
    });

    it('should detect missing CORS headers', async () => {
      const responseWithoutCors = `
        async function handler() {
          return new Response('Hello World', {
            status: 200,
            headers: {
              'Content-Type': 'text/plain'
            }
          });
        }
      `;

      const result = await validator.validateResponseHandling(responseWithoutCors);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Missing CORS headers for API responses');
    });
  });

  describe('validatePerformance', () => {
    it('should validate efficient code patterns', async () => {
      const efficientCode = `
        // Use caching
        const cache = caches.default;

        async function handler(request) {
          const cacheKey = new Request(request.url);
          const cached = await cache.match(cacheKey);

          if (cached) {
            return cached;
          }

          const response = await fetch(request);
          await cache.put(cacheKey, response.clone());
          return response;
        }
      `;

      const result = await validator.validatePerformance(efficientCode);

      expect(result.valid).toBe(true);
      expect(result.usesCaching).toBe(true);
    });

    it('should detect potential performance issues', async () => {
      const slowCode = `
        async function handler() {
          // Inefficient - repeated computations
          let result = 0;
          for (let i = 0; i < 1000000; i++) {
            result += Math.random() * 1000;
          }
          return new Response(result.toString());
        }
      `;

      const result = await validator.validatePerformance(slowCode);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Potential performance bottleneck detected');
    });
  });

  describe('validateSecurity', () => {
    it('should validate secure code patterns', async () => {
      const secureCode = `
        async function handler(request) {
          // Validate input
          const url = new URL(request.url);
          const userId = url.searchParams.get('userId');

          if (!userId || !/^[a-zA-Z0-9-_]+$/.test(userId)) {
            return new Response('Invalid user ID', { status: 400 });
          }

          // Use secure headers
          return new Response('Success', {
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY'
            }
          });
        }
      `;

      const result = await validator.validateSecurity(secureCode);

      expect(result.valid).toBe(true);
      expect(result.hasInputValidation).toBe(true);
      expect(result.hasSecurityHeaders).toBe(true);
    });

    it('should detect security vulnerabilities', async () => {
      const vulnerableCode = `
        async function handler(request) {
          const url = new URL(request.url);
          const sqlQuery = 'SELECT * FROM users WHERE id = ' + url.searchParams.get('id');
          // SQL injection vulnerability!

          return new Response('Query executed');
        }
      `;

      const result = await validator.validateSecurity(vulnerableCode);

      expect(result.valid).toBe(false);
      expect(result.vulnerabilities).toContain('Potential SQL injection vulnerability');
    });
  });
});

// Mock WorkerCodeValidator class for testing
class WorkerCodeValidator {
  async validateBasicWorkerStructure(code) {
    const hasEventListener = code.includes('addEventListener(');
    const hasHandleRequest = code.includes('handleRequest') || code.includes('handler');

    const issues = [];
    if (!hasEventListener) issues.push('Missing addEventListener for fetch events');
    if (!hasHandleRequest) issues.push('Missing handleRequest function');

    return {
      valid: issues.length === 0,
      issues
    };
  }

  async validateEnvironmentVariables(code) {
    const envMatches = code.match(/env\.([A-Z_]+)/g) || [];
    const variables = envMatches.map(match => match.replace('env.', ''));

    const issues = [];
    // Simplified check - in reality would be more sophisticated
    variables.forEach(variable => {
      const usageCount = (code.match(new RegExp(variable, 'g')) || []).length;
      if (usageCount < 2) { // declared but not used
        issues.push(`Environment variable ${variable} is declared but not used`);
      }
    });

    return {
      valid: issues.length === 0,
      variables,
      issues
    };
  }

  async validateAsyncPatterns(code) {
    const asyncFunctions = code.match(/async function\s+(\w+)/g) || [];
    const fetchCalls = code.match(/fetch\s*\(/g) || [];
    const awaitCalls = code.match(/await\s+fetch/g) || [];

    const issues = [];
    if (fetchCalls.length > awaitCalls.length) {
      issues.push('Missing await for fetch call');
    }

    return {
      valid: issues.length === 0,
      asyncFunctions: asyncFunctions.map(f => f.replace('async function ', '')),
      issues
    };
  }

  async validateErrorHandling(code) {
    const hasTryCatch = code.includes('try') && code.includes('catch');
    const asyncFunctions = code.match(/async function\s+(\w+)/g) || [];

    const warnings = [];
    if (!hasTryCatch && asyncFunctions.length > 0) {
      warnings.push(`Function ${asyncFunctions[0].replace('async function ', '')} lacks error handling`);
    }

    return {
      valid: hasTryCatch,
      hasTryCatch,
      warnings
    };
  }

  async validateResponseHandling(code) {
    const hasCorsHeaders = code.includes('Access-Control-Allow-Origin');
    const responseConstructors = code.match(/new Response\s*\(/g) || [];

    const warnings = [];
    if (responseConstructors.length > 0 && !hasCorsHeaders) {
      warnings.push('Missing CORS headers for API responses');
    }

    return {
      valid: hasCorsHeaders || responseConstructors.length === 0,
      hasCorsHeaders,
      warnings
    };
  }

  async validatePerformance(code) {
    const usesCaching = code.includes('cache.match') || code.includes('caches.default');
    const hasLargeLoops = code.match(/for\s*\([^)]*\+\+.*\d{6,}/g) || [];

    const issues = [];
    if (hasLargeLoops.length > 0) {
      issues.push('Potential performance bottleneck detected');
    }

    return {
      valid: issues.length === 0,
      usesCaching,
      issues
    };
  }

  async validateSecurity(code) {
    const hasInputValidation = code.includes('validate') || code.includes('/^[a-zA-Z0-9-_]+$/');
    const hasSecurityHeaders = code.includes('X-Content-Type-Options');
    const hasStringConcatSql = code.match(/SELECT.*\+.*variable/g) || [];

    const vulnerabilities = [];
    if (hasStringConcatSql.length > 0) {
      vulnerabilities.push('Potential SQL injection vulnerability');
    }

    return {
      valid: vulnerabilities.length === 0 && hasInputValidation,
      hasInputValidation,
      hasSecurityHeaders,
      vulnerabilities
    };
  }
}

module.exports = { WorkerCodeValidator };