/**
 * Cloudflare Performance Configuration Template
 * Caching, optimization, and performance settings
 */

// Performance configuration object
const PERFORMANCE_CONFIG = {
    // Caching Configuration
    caching: {
        // Browser cache settings
        browser: {
            // Static assets (CSS, JS, images)
            static: {
                ttl: 31536000, // 1 year
                browserTTL: 31536000,
                edgeTTL: 31536000,
                cacheEverything: true,
                cacheKey: {
                    includeScheme: false,
                    includeSubdomain: false,
                    ignoreQueryStrings: true
                }
            },

            // HTML files
            html: {
                ttl: 3600, // 1 hour
                browserTTL: 0, // No browser caching
                edgeTTL: 3600,
                cacheEverything: false,
                cacheKey: {
                    includeScheme: false,
                    includeSubdomain: false,
                    ignoreQueryStrings: false
                }
            },

            // API responses
            api: {
                ttl: 300, // 5 minutes
                browserTTL: 0, // No browser caching
                edgeTTL: 300,
                cacheEverything: false,
                cacheKey: {
                    includeScheme: true,
                    includeSubdomain: true,
                    ignoreQueryStrings: false
                }
            },

            // Dynamic content
            dynamic: {
                ttl: 60, // 1 minute
                browserTTL: 0,
                edgeTTL: 60,
                cacheEverything: false,
                cacheKey: {
                    includeScheme: true,
                    includeSubdomain: true,
                    ignoreQueryStrings: false
                }
            }
        },

        // Edge cache settings
        edge: {
            // Cache levels
            levels: {
                // CDN edge cache
                edge: {
                    enabled: true,
                    maxSize: '5GB',
                    defaultTtl: 86400, // 24 hours
                    maxTtl: 2592000 // 30 days
                },

                // Cloudflare edge cache
                cloudflare: {
                    enabled: true,
                    purgeOnDeploy: true,
                    respectStrongEtag: true,
                    cacheByDeviceType: false
                },

                // Browser cache
                browser: {
                    enabled: true,
                    respectHeaders: true,
                    override: false
                }
            },

            // Cache rules
            rules: [
                {
                    name: 'Cache static assets',
                    match: {
                        url: '*.{css,js,png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot}',
                        methods: ['GET', 'HEAD']
                    },
                    settings: {
                        cacheTtl: 31536000,
                        browserTtl: 31536000,
                        cacheKey: {
                            ignoreQueryStrings: true
                        }
                    }
                },
                {
                    name: 'Cache API responses',
                    match: {
                        url: '/api/*',
                        methods: ['GET'],
                        headers: {
                            'authorization': 'absent'
                        }
                    },
                    settings: {
                        cacheTtl: 300,
                        browserTtl: 0,
                        cacheKey: {
                            ignoreQueryStrings: false,
                            includeHeaders: ['accept', 'accept-language']
                        }
                    }
                },
                {
                    name: 'Bypass cache for admin',
                    match: {
                        url: '/admin/*'
                    },
                    settings: {
                        cacheTtl: 0,
                        bypassCache: true
                    }
                }
            ],

            // Cache key configuration
            cacheKey: {
                includeCountry: false,
                includeDeviceType: false,
                includeLanguage: false,
                includeProtocol: false,
                includeHost: true,
                ignoreQueryStrings: [],
                includedQueryStrings: [],
                includedHeaders: [],
                includedCookies: []
            }
        },

        // Purge configuration
        purge: {
            // Automatic purge on deployment
            autoPurge: {
                enabled: true,
                purgedUrls: [
                    '/index.html',
                    '/*.{html,css,js}',
                    '/sitemap.xml',
                    '/robots.txt'
                ]
            },

            // Purge by tag
            byTag: {
                enabled: true,
                tags: [
                    'static',
                    'dynamic',
                    'api',
                    'pages'
                ]
            },

            // Cache purge APIs
            endpoints: [
                '/api/purge/*',
                '/admin/cache/purge'
            ],

            // Rate limiting for purge operations
            rateLimit: {
                perMinute: 10,
                perHour: 100
            }
        }
    },

    // Optimization Configuration
    optimization: {
        // Auto Minify
        minify: {
            html: true,
            css: true,
            js: false // Usually handled by build tools
        },

        // Brotli compression
        brotli: true,

        // Gzip compression
        gzip: true,

        // Early Hints
        earlyHints: {
            enabled: true,
            preconnectUrls: [
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
                'https://www.google-analytics.com'
            ],
            preloadResources: [
                '/styles/main.css',
                '/scripts/main.js'
            ]
        },

        // Image optimization
        images: {
            // Enable automatic image optimization
            autoOptimize: true,

            // WebP conversion
            webp: true,

            // AVIF conversion
            avif: true,

            // Responsive images
            responsive: {
                enabled: true,
                breakpoints: [320, 640, 768, 1024, 1280, 1536],
                quality: 85,
                format: 'auto'
            },

            // Image compression settings
            compression: {
                jpeg: {
                    quality: 85,
                    progressive: true
                },
                png: {
                    compression: 6,
                    interlaced: false
                },
                webp: {
                    quality: 80
                },
                avif: {
                    quality: 75
                }
            },

            // Image dimensions
            maxDimensions: {
                width: 2048,
                height: 2048
            },

            // Strip metadata
            stripMetadata: true
        },

        // Code optimization
        code: {
            // JavaScript bundling
            bundling: {
                enabled: true,
                treeShaking: true,
                minification: true,
                sourceMaps: false // Disabled in production
            },

            // CSS optimization
            css: {
                minification: true,
                purging: true, // Remove unused CSS
                criticalCSS: true, // Inline critical CSS
                splitting: true // Split CSS by page
            },

            // HTML optimization
            html: {
                minification: true,
                removeComments: true,
                removeWhitespace: true,
                removeOptionalTags: true,
                removeRedundantAttributes: true
            }
        },

        // Font optimization
        fonts: {
            // Preload fonts
            preload: [
                '/fonts/inter-var.woff2'
            ],

            // Display strategy
            display: 'swap',

            // Font subsets
            subsets: ['latin', 'latin-ext'],

            // Variable fonts
            variableFonts: true,

            // Font loading optimization
            loading: {
                preload: true,
                prefetch: true,
                async: false
            }
        }
    },

    // Network Configuration
    network: {
        // HTTP/2 and HTTP/3
        http2: true,
        http3: true,

        // TCP Fast Open
        tcpFastOpen: true,

        // SSL/TLS optimization
        tls: {
            // Session resumption
            sessionResumption: true,

            // OCSP stapling
            ocspStapling: true,

            // TLS record size optimization
            recordSize: 4096,

            // TLS false start
            falseStart: true
        },

        // Connection optimization
        connections: {
            // Keep-alive connections
            keepAlive: true,

            // Connection pooling
            pooling: true,

            // Connection limits
            maxConnections: 100,

            // Connection timeout
            timeout: 30 // seconds
        },

        // Request/response optimization
        requests: {
            // Request coalescing
            coalescing: true,

            // Request priority
            priority: true,

            // Response streaming
            streaming: true,

            // Chunked encoding
            chunked: true
        }
    },

    // CDN Configuration
    cdn: {
        // CDN selection strategy
        selection: {
            strategy: 'latency', // latency, cost, region
            fallback: true,
            healthChecks: true
        },

        // Edge locations
        locations: {
            // Preferred edge locations
            preferred: [],

            // Excluded locations
            excluded: [],

            // Performance requirements
            requirements: {
                maxLatency: 100, // ms
                minUptime: 99.9 // percentage
            }
        },

        // CDN features
        features: {
            // Edge computing
            edgeComputing: true,

            // Image optimization at edge
            imageOptimization: true,

            // Video optimization
            videoOptimization: false,

            // A/B testing
            abTesting: true,

            // Feature flags
            featureFlags: true,

            // Geotargeting
            geotargeting: true,

            // Device detection
            deviceDetection: true
        }
    },

    // Performance Monitoring
    monitoring: {
        // Real User Monitoring (RUM)
        rum: {
            enabled: true,
            sampleRate: 0.1, // 10% of traffic
            metrics: [
                'navigationTiming',
                'paintTiming',
                'firstContentfulPaint',
                'largestContentfulPaint',
                'firstInputDelay',
                'cumulativeLayoutShift',
                'timeToFirstByte'
            ]
        },

        // Synthetic monitoring
        synthetic: {
            enabled: true,
            locations: [
                'US - East',
                'US - West',
                'Europe - London',
                'Asia - Singapore',
                'Australia - Sydney'
            ],
            frequency: 5, // minutes
            tests: [
                {
                    name: 'Homepage load',
                    url: '/',
                    expectedStatus: 200,
                    expectedResponseTime: 2000 // ms
                },
                {
                    name: 'API health check',
                    url: '/api/health',
                    expectedStatus: 200,
                    expectedResponseTime: 500 // ms
                }
            ]
        },

        // Performance budgets
        budgets: {
            totalSize: 1024 * 1024, // 1MB
            jsSize: 300 * 1024, // 300KB
            cssSize: 100 * 1024, // 100KB
            imageSize: 500 * 1024, // 500KB
            fontMaxLoadTime: 1000, // ms
            fcp: 1500, // First Contentful Paint
            lcp: 2500, // Largest Contentful Paint
            fid: 100, // First Input Delay
            cls: 0.1 // Cumulative Layout Shift
        },

        // Alerting
        alerts: {
            channels: ['email', 'slack'],
            thresholds: {
                responseTime: 3000, // ms
                errorRate: 5, // percentage
                availability: 99.5 // percentage
            }
        }
    },

    // A/B Testing and Experiments
    experimentation: {
        // A/B testing configuration
        abTesting: {
            enabled: false,
            trafficSplit: 50, // percentage
            variants: [
                {
                    name: 'control',
                    weight: 50
                },
                {
                    name: 'variant-a',
                    weight: 50
                }
            ]
        },

        // Feature flags
        featureFlags: {
            enabled: true,
            flags: {
                'new-ui': {
                    enabled: false,
                    rolloutPercentage: 0,
                    conditions: []
                },
                'beta-features': {
                    enabled: true,
                    rolloutPercentage: 20,
                    conditions: [
                        'user_tier:premium'
                    ]
                }
            }
        }
    },

    // Core Web Vitals Optimization
    coreWebVitals: {
        // Largest Contentful Paint (LCP)
        lcp: {
            target: 2500, // ms
            optimization: [
                'imageOptimization',
                'serverResponseTime',
                'renderBlockingResources',
                'cdnOptimization'
            ]
        },

        // First Input Delay (FID)
        fid: {
            target: 100, // ms
            optimization: [
                'javascriptOptimization',
                'codeSplitting',
                'browserCaching',
                'thirdPartyOptimization'
            ]
        },

        // Cumulative Layout Shift (CLS)
        cls: {
            target: 0.1,
            optimization: [
                'dimensionReservations',
                'fontOptimization',
                'lazyLoading',
                'animationOptimization'
            ]
        }
    },

    // Environment-specific settings
    environments: {
        development: {
            caching: {
                browser: {
                    static: {
                        ttl: 0 // No caching in development
                    }
                }
            },
            optimization: {
                minify: false,
                brotli: false,
                gzip: false
            },
            monitoring: {
                rum: false
            }
        },

        staging: {
            caching: {
                browser: {
                    static: {
                        ttl: 3600 // 1 hour in staging
                    }
                }
            },
            optimization: {
                minify: true,
                brotli: true,
                gzip: true
            },
            monitoring: {
                rum: true,
                sampleRate: 0.05 // 5% sample rate
            }
        },

        production: {
            caching: {
                browser: {
                    static: {
                        ttl: 31536000 // 1 year in production
                    }
                }
            },
            optimization: {
                minify: true,
                brotli: true,
                gzip: true
            },
            monitoring: {
                rum: true,
                sampleRate: 0.1 // 10% sample rate
            }
        }
    }
};

// Export configuration
module.exports = PERFORMANCE_CONFIG;

// Performance optimization helpers
const PerformanceHelpers = {
    /**
     * Generate cache rules for Cloudflare
     */
    generateCacheRules: (config) => {
        return config.caching.edge.rules.map(rule => ({
            description: rule.name,
            expression: generateExpression(rule.match),
            action: 'cache',
            cache: {
                edge_ttl: rule.settings.cacheTtl,
                browser_ttl: rule.settings.browserTtl,
                cache_key: rule.settings.cacheKey
            }
        }));
    },

    /**
     * Generate performance headers
     */
    generatePerformanceHeaders: (config) => {
        const headers = {};

        // Early Hints
        if (config.optimization.earlyHints.enabled) {
            headers['Link'] = config.optimization.earlyHints.preconnectUrls
                .map(url => `<${url}>; rel=preconnect`)
                .concat(config.optimization.earlyHints.preloadResources
                    .map(url => `<${url}>; rel=preload; as=${getResourceType(url)}`))
                .join(', ');
        }

        // Cache control
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';

        // Compression
        headers['Accept-Encoding'] = 'br, gzip';

        return headers;
    },

    /**
     * Optimize images for performance
     */
    optimizeImage: (imageUrl, options = {}) => {
        const {
            width,
            height,
            quality = 85,
            format = 'auto',
            fit = 'cover'
        } = options;

        let optimizedUrl = `https://your-domain.com/cdn-cgi/image/`;
        const params = [];

        if (width) params.push(`w=${width}`);
        if (height) params.push(`h=${height}`);
        if (quality !== 85) params.push(`q=${quality}`);
        if (format !== 'auto') params.push(`f=${format}`);
        if (fit !== 'cover') params.push(`fit=${fit}`);

        if (params.length > 0) {
            optimizedUrl += params.join(',') + '/';
        }

        return optimizedUrl + imageUrl;
    },

    /**
     * Generate critical CSS
     */
    generateCriticalCSS: async (html, css) => {
        // This would typically use a service like Penthouse or Critters
        // Placeholder implementation
        return css;
    },

    /**
     * Check performance budgets
     */
    checkBudgets: (assets, budget) => {
        const results = {
            passed: true,
            violations: []
        };

        // Check total size
        const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
        if (totalSize > budget.totalSize) {
            results.passed = false;
            results.violations.push({
                type: 'totalSize',
                actual: totalSize,
                budget: budget.totalSize
            });
        }

        // Check JavaScript size
        const jsSize = assets
            .filter(asset => asset.type === 'js')
            .reduce((sum, asset) => sum + asset.size, 0);
        if (jsSize > budget.jsSize) {
            results.passed = false;
            results.violations.push({
                type: 'jsSize',
                actual: jsSize,
                budget: budget.jsSize
            });
        }

        return results;
    },

    /**
     * Generate Web Vitals optimization recommendations
     */
    generateOptimizationRecommendations: (metrics, targets) => {
        const recommendations = [];

        if (metrics.lcp > targets.lcp) {
            recommendations.push({
                metric: 'LCP',
                current: metrics.lcp,
                target: targets.lcp,
                suggestions: [
                    'Optimize images',
                    'Preload critical resources',
                    'Remove render-blocking resources',
                    'Improve server response time'
                ]
            });
        }

        if (metrics.fid > targets.fid) {
            recommendations.push({
                metric: 'FID',
                current: metrics.fid,
                target: targets.fid,
                suggestions: [
                    'Reduce JavaScript execution time',
                    'Break up long tasks',
                    'Optimize third-party scripts'
                ]
            });
        }

        if (metrics.cls > targets.cls) {
            recommendations.push({
                metric: 'CLS',
                current: metrics.cls,
                target: targets.cls,
                suggestions: [
                    'Reserve space for images and ads',
                    'Avoid inserting content above existing content',
                    'Use CSS aspect-ratio for images'
                ]
            });
        }

        return recommendations;
    }
};

// Helper functions
function generateExpression(match) {
    // Generate Cloudflare expression from match object
    const conditions = [];

    if (match.url) {
        conditions.push(`http.request.uri.path matches "${match.url}"`);
    }

    if (match.methods) {
        conditions.push(`http.request.method in ${JSON.stringify(match.methods)}`);
    }

    if (match.headers) {
        Object.entries(match.headers).forEach(([header, value]) => {
            conditions.push(`http.request.headers["${header}"] ${value}`);
        });
    }

    return conditions.join(' and ');
}

function getResourceType(url) {
    const extension = url.split('.').pop().toLowerCase();
    const resourceTypes = {
        'css': 'style',
        'js': 'script',
        'woff': 'font',
        'woff2': 'font',
        'ttf': 'font',
        'png': 'image',
        'jpg': 'image',
        'jpeg': 'image',
        'gif': 'image',
        'webp': 'image'
    };

    return resourceTypes[extension] || 'image';
}

// Export helpers
module.exports.PerformanceHelpers = PerformanceHelpers;