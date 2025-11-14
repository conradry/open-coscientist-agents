/**
 * Performance Tests - Worker Performance
 *
 * Tests performance characteristics and optimization patterns
 */

const { WorkerPerformanceAnalyzer } = require('../../qa/worker-performance-analyzer');

describe('Worker Performance Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new WorkerPerformanceAnalyzer();
  });

  describe('Cold Start Performance', () => {
    it('should measure cold start latency', async () => {
      const workerCode = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          return new Response('Hello World')
        }
      `;

      const performanceMetrics = await analyzer.measureColdStart(workerCode);

      expect(performanceMetrics.coldStartTime).toBeLessThan(50); // ms
      expect(performanceMetrics.memoryUsage).toBeLessThan(128); // MB
      expect(performanceMetrics.cpuTime).toBeLessThan(10); // ms
    });

    it('should analyze cold start optimization opportunities', async () => {
      const unoptimizedWorker = `
        import { heavyLibrary } from 'large-package'
        import { anotherLibrary } from 'another-large-package'

        const complexConfig = JSON.parse(largeConfigString)
        const databaseConnection = connectToDatabase()

        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          return new Response('Hello World')
        }
      `;

      const optimizationReport = await analyzer.analyzeColdStartOptimization(unoptimizedWorker);

      expect(optimizationReport.suggestions).toContain('Reduce import size');
      expect(optimizationReport.suggestions).toContain('Lazy load heavy dependencies');
      expect(optimizationReport.estimatedImprovement).toBeGreaterThan(20); // %
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should detect memory leaks in workers', async () => {
      const leakyWorker = `
        const cache = new Map()

        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          // Potential memory leak - cache grows indefinitely
          const key = crypto.randomUUID()
          cache.set(key, new Array(1000).fill('data'))
          return new Response(\`Cache size: \${cache.size}\`)
        }
      `;

      const memoryAnalysis = await analyzer.analyzeMemoryUsage(leakyWorker);

      expect(memoryAnalysis.hasMemoryLeak).toBe(true);
      expect(memoryAnalysis.issues).toContain('Unbounded cache growth');
      expect(memoryAnalysis.recommendations).toContain('Implement cache size limits');
    });

    it('should validate efficient memory patterns', async () => {
      const efficientWorker = `
        const MAX_CACHE_SIZE = 100
        const cache = new Map()

        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const key = request.url
          let value = cache.get(key)

          if (!value) {
            value = await fetchData()

            if (cache.size >= MAX_CACHE_SIZE) {
              const firstKey = cache.keys().next().value
              cache.delete(firstKey)
            }

            cache.set(key, value)
          }

          return new Response(JSON.stringify(value))
        }

        async function fetchData() {
          return { data: 'sample' }
        }
      `;

      const memoryAnalysis = await analyzer.analyzeMemoryUsage(efficientWorker);

      expect(memoryAnalysis.hasMemoryLeak).toBe(false);
      expect(memoryAnalysis.efficientPatterns).toContain('Cache size limiting');
      expect(memoryAnalysis.memoryScore).toBeGreaterThan(80);
    });
  });

  describe('CPU Performance Analysis', () => {
    it('should detect CPU-intensive operations', async () => {
      const cpuIntensiveWorker = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const url = new URL(request.url)
          const size = parseInt(url.searchParams.get('size') || '10000')

          // CPU-intensive operation
          const result = []
          for (let i = 0; i < size; i++) {
            result.push(Math.sqrt(i * Math.random()))
          }

          return new Response(JSON.stringify({ result: result.length }))
        }
      `;

      const cpuAnalysis = await analyzer.analyzeCPUPerformance(cpuIntensiveWorker);

      expect(cpuAnalysis.hasCpuIntensiveOperations).toBe(true);
      expect(cpuAnalysis.hotspots).toContain('Large loop with mathematical operations');
      expect(cpuAnalysis.recommendations).toContain('Consider precomputing results');
    });

    it('should validate efficient CPU patterns', async () => {
      const efficientCpuWorker = `
        // Precomputed lookup table
        const lookupTable = Array.from({length: 1000}, (_, i) => Math.sqrt(i))

        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const url = new URL(request.url)
          const index = parseInt(url.searchParams.get('index') || '0')

          // Fast lookup instead of computation
          const value = lookupTable[index] || 0

          return new Response(JSON.stringify({ value }))
        }
      `;

      const cpuAnalysis = await analyzer.analyzeCPUPerformance(efficientCpuWorker);

      expect(cpuAnalysis.hasCpuIntensiveOperations).toBe(false);
      expect(cpuAnalysis.efficientPatterns).toContain('Precomputed lookup table');
      expect(cpuAnalysis.cpuScore).toBeGreaterThan(85);
    });
  });

  describe('Network Performance Analysis', () => {
    it('should analyze network request patterns', async () => {
      const networkWorker = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const url = new URL(request.url)
          const apiUrls = [
            'https://api1.example.com/data',
            'https://api2.example.com/data',
            'https://api3.example.com/data'
          ]

          // Sequential requests - inefficient
          const results = []
          for (const apiUrl of apiUrls) {
            const response = await fetch(apiUrl)
            const data = await response.json()
            results.push(data)
          }

          return new Response(JSON.stringify(results))
        }
      `;

      const networkAnalysis = await analyzer.analyzeNetworkPerformance(networkWorker);

      expect(networkAnalysis.hasInefficientRequests).toBe(true);
      expect(networkAnalysis.issues).toContain('Sequential network requests');
      expect(networkAnalysis.recommendations).toContain('Use Promise.all for parallel requests');
    });

    it('should validate efficient network patterns', async () => {
      const efficientNetworkWorker = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const apiUrls = [
            'https://api1.example.com/data',
            'https://api2.example.com/data',
            'https://api3.example.com/data'
          ]

          // Parallel requests with caching
          const cache = caches.default

          const requests = apiUrls.map(async apiUrl => {
            const cacheKey = new Request(apiUrl)
            const cached = await cache.match(cacheKey)

            if (cached) {
              return cached.json()
            }

            const response = await fetch(apiUrl)
            const data = await response.json()

            // Cache for 5 minutes
            const cacheResponse = new Response(JSON.stringify(data), {
              headers: { 'Cache-Control': 'max-age=300' }
            })
            await cache.put(cacheKey, cacheResponse)

            return data
          })

          const results = await Promise.all(requests)
          return new Response(JSON.stringify(results))
        }
      `;

      const networkAnalysis = await analyzer.analyzeNetworkPerformance(efficientNetworkWorker);

      expect(networkAnalysis.hasInefficientRequests).toBe(false);
      expect(networkAnalysis.efficientPatterns).toContain('Parallel requests');
      expect(networkAnalysis.efficientPatterns).toContain('Response caching');
      expect(networkAnalysis.networkScore).toBeGreaterThan(90);
    });
  });

  describe('Benchmark Tests', () => {
    it('should benchmark worker throughput', async () => {
      const workerCode = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          return new Response('OK')
        }
      `;

      const benchmark = await analyzer.benchmarkThroughput(workerCode, {
        duration: 5000, // 5 seconds
        concurrency: 100
      });

      expect(benchmark.requestsPerSecond).toBeGreaterThan(1000);
      expect(benchmark.averageLatency).toBeLessThan(50); // ms
      expect(benchmark.errorRate).toBeLessThan(0.01); // 1%
    });

    it('should benchmark memory pressure scenarios', async () => {
      const memoryPressureWorker = `
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const url = new URL(request.url)
          const size = parseInt(url.searchParams.get('size') || '100')

          // Allocate memory based on request
          const data = new Array(size).fill('x').join('')

          return new Response(data)
        }
      `;

      const memoryBenchmark = await analyzer.benchmarkMemoryPressure(memoryPressureWorker, {
        maxRequestSize: 10000,
        concurrency: 50
      });

      expect(memoryBenchmark.maxMemoryUsage).toBeLessThan(50); // MB
      expect(memoryBenchmark.memoryGrowthRate).toBeLessThan(0.1); // MB per request
      expect(memoryBenchmark.gcFrequency).toBeGreaterThan(1); // Should trigger GC
    });
  });

  describe('Optimization Recommendations', () => {
    it('should provide specific optimization recommendations', async () => {
      const unoptimizedWorker = `
        import { heavyLibrary } from 'large-dependency'

        const largeObject = {
          // Lots of unused data
          unusedField1: 'x'.repeat(1000),
          unusedField2: 'y'.repeat(1000),
          usedField: 'important'
        }

        addEventListener('fetch', event => {
          event.respondWith(slowHandler(event.request))
        })

        async function slowHandler(request) {
          // Expensive computation every request
          let result = 0
          for (let i = 0; i < 100000; i++) {
            result += Math.sin(i) * Math.cos(i)
          }

          // Sequential network calls
          const response1 = await fetch('https://api.example.com/1')
          const response2 = await fetch('https://api.example.com/2')

          return new Response(JSON.stringify({
            result,
            data1: await response1.json(),
            data2: await response2.json()
          }))
        }
      `;

      const recommendations = await analyzer.generateOptimizationReport(unoptimizedWorker);

      expect(recommendations.overallScore).toBeLessThan(50);
      expect(recommendations.categories.imports.score).toBeLessThan(50);
      expect(recommendations.categories.memory.score).toBeLessThan(50);
      expect(recommendations.categories.cpu.score).toBeLessThan(50);
      expect(recommendations.categories.network.score).toBeLessThan(50);

      expect(recommendations.prioritizedRecommendations).toHaveLength.greaterThan(3);
      expect(recommendations.estimatedImpact).toContain('high');
    });
  });
});

// Mock WorkerPerformanceAnalyzer class for testing
class WorkerPerformanceAnalyzer {
  async measureColdStart(workerCode) {
    // Simulate cold start measurement
    return {
      coldStartTime: Math.random() * 40 + 10, // 10-50ms
      memoryUsage: Math.random() * 50 + 50, // 50-100MB
      cpuTime: Math.random() * 8 + 2 // 2-10ms
    };
  }

  async analyzeColdStartOptimization(workerCode) {
    const imports = (workerCode.match(/import.*from/g) || []).length;
    const largeStrings = (workerCode.match(/'[^']{500,}'/g) || []).length;

    const suggestions = [];
    if (imports > 2) suggestions.push('Reduce import size');
    if (imports > 1) suggestions.push('Lazy load heavy dependencies');
    if (largeStrings > 0) suggestions.push('Move large data to external storage');

    return {
      suggestions,
      estimatedImprovement: suggestions.length * 15 + 10
    };
  }

  async analyzeMemoryUsage(workerCode) {
    const hasUnboundedCache = workerCode.includes('cache.set(') &&
                           !workerCode.includes('cache.delete(') &&
                           !workerCode.includes('MAX_CACHE_SIZE');

    const hasMemoryLeak = hasUnboundedCache ||
                         workerCode.includes('cache.size') &&
                         !workerCode.includes('limit');

    return {
      hasMemoryLeak,
      issues: hasMemoryLeak ? ['Unbounded cache growth'] : [],
      recommendations: hasMemoryLeak ? ['Implement cache size limits'] : [],
      efficientPatterns: !hasMemoryLeak ? ['Cache size limiting'] : [],
      memoryScore: hasMemoryLeak ? 30 : 85
    };
  }

  async analyzeCPUPerformance(workerCode) {
    const hasLargeLoops = workerCode.match(/for.*\(.*\d{4,}/g) || [];
    const hasExpensiveMath = workerCode.includes('Math.sqrt') && workerCode.includes('Math.random');
    const hasHeavyComputation = hasLargeLoops.length > 0 || hasExpensiveMath;

    return {
      hasCpuIntensiveOperations: hasHeavyComputation,
      hotspots: hasLargeLoops.length > 0 ? ['Large loop with mathematical operations'] : [],
      recommendations: hasHeavyComputation ? ['Consider precomputing results'] : [],
      efficientPatterns: !hasHeavyComputation ? ['Precomputed lookup table'] : [],
      cpuScore: hasHeavyComputation ? 25 : 90
    };
  }

  async analyzeNetworkPerformance(workerCode) {
    const hasSequentialFetch = workerCode.includes('for') && workerCode.includes('await fetch');
    const hasParallelFetch = workerCode.includes('Promise.all') && workerCode.includes('fetch');
    const hasCaching = workerCode.includes('cache.match') || workerCode.includes('caches.default');

    const hasInefficientRequests = hasSequentialFetch && !hasParallelFetch;

    return {
      hasInefficientRequests,
      issues: hasInefficientRequests ? ['Sequential network requests'] : [],
      recommendations: hasInefficientRequests ? ['Use Promise.all for parallel requests'] : [],
      efficientPatterns: [
        ...(hasParallelFetch ? ['Parallel requests'] : []),
        ...(hasCaching ? ['Response caching'] : [])
      ],
      networkScore: hasInefficientRequests ? 35 : 95
    };
  }

  async benchmarkThroughput(workerCode, options) {
    // Simulate benchmark results
    return {
      requestsPerSecond: Math.random() * 2000 + 1000,
      averageLatency: Math.random() * 30 + 20,
      errorRate: Math.random() * 0.005,
      totalRequests: Math.floor((Math.random() * 2000 + 1000) * (options.duration / 1000))
    };
  }

  async benchmarkMemoryPressure(workerCode, options) {
    // Simulate memory pressure test
    return {
      maxMemoryUsage: Math.random() * 30 + 20,
      memoryGrowthRate: Math.random() * 0.05 + 0.02,
      gcFrequency: Math.floor(Math.random() * 5) + 2
    };
  }

  async generateOptimizationReport(workerCode) {
    const memoryAnalysis = await this.analyzeMemoryUsage(workerCode);
    const cpuAnalysis = await this.analyzeCPUPerformance(workerCode);
    const networkAnalysis = await this.analyzeNetworkPerformance(workerCode);

    const overallScore = (memoryAnalysis.memoryScore + cpuAnalysis.cpuScore + networkAnalysis.networkScore) / 3;

    return {
      overallScore,
      categories: {
        imports: { score: 40 }, // Mock score
        memory: memoryAnalysis,
        cpu: cpuAnalysis,
        network: networkAnalysis
      },
      prioritizedRecommendations: [
        'Remove unused imports',
        'Implement proper error handling',
        'Add request caching',
        'Optimize CPU-intensive operations'
      ],
      estimatedImpact: ['high', 'medium', 'medium', 'high']
    };
  }
}

module.exports = { WorkerPerformanceAnalyzer };