/**
 * Cloudflare Security Policies Template
 * Comprehensive WAF and security rules configuration
 */

// Security configuration object
const SECURITY_CONFIG = {
    // WAF Rules Configuration
    waf: {
        // Rate limiting rules
        rateLimiting: {
            // General rate limiting
            general: {
                requestsPerMinute: 100,
                requestsPerHour: 1000,
                requestsPerDay: 10000,
                burstSize: 20,
                penaltyDuration: 300, // 5 minutes
                action: 'challenge'
            },

            // API endpoints rate limiting
            api: {
                requestsPerMinute: 60,
                requestsPerHour: 600,
                burstSize: 10,
                penaltyDuration: 900, // 15 minutes
                action: 'challenge'
            },

            // Authentication endpoints
            auth: {
                requestsPerMinute: 10,
                requestsPerHour: 50,
                burstSize: 5,
                penaltyDuration: 1800, // 30 minutes
                action: 'block'
            },

            // Upload endpoints
            upload: {
                requestsPerMinute: 5,
                requestsPerHour: 20,
                burstSize: 2,
                penaltyDuration: 600, // 10 minutes
                action: 'challenge'
            }
        },

        // IP reputation rules
        ipReputation: {
            // Block known malicious IPs
            malicious: {
                action: 'block',
                log: true
            },

            // Challenge suspicious IPs
            suspicious: {
                action: 'challenge',
                log: true
            },

            // Allow trusted IPs
            trusted: {
                action: 'allow',
                log: false
            }
        },

        // Geographic rules
        geographic: {
            // Blocked countries (ISO country codes)
            blockedCountries: [], // Example: ['CN', 'RU', 'KP']

            // Challenged countries
            challengedCountries: [], // Example: ['BR', 'IN', 'ID']

            // Allowed countries (whitelist mode)
            allowedCountries: [], // Example: ['US', 'CA', 'GB', 'AU']

            // Exclude from geography rules
            exceptions: [] // Example: ['admin/*', 'api/public/*']
        },

        // OWASP Top 10 protection rules
        owasp: {
            // SQL Injection protection
            sqlInjection: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Cross-Site Scripting (XSS) protection
            xss: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Local File Inclusion (LFI) protection
            lfi: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Remote File Inclusion (RFI) protection
            rfi: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Command Injection protection
            commandInjection: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // XXE (XML External Entity) protection
            xxe: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Server-Side Request Forgery (SSRF) protection
            ssrf: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Broken Authentication protection
            brokenAuth: {
                enabled: true,
                action: 'challenge',
                scoreThreshold: 3
            },

            // Sensitive Data Exposure protection
            dataExposure: {
                enabled: true,
                action: 'block',
                scoreThreshold: 5
            },

            // Security Misconfiguration protection
            misconfig: {
                enabled: true,
                action: 'challenge',
                scoreThreshold: 3
            }
        },

        // Bot management
        botManagement: {
            // Enable bot fight mode
            botFightMode: false,

            // Enable super bot fight mode
            superBotFightMode: false,

            // Bot score threshold (0-100)
            botScoreThreshold: 30,

            // Actions based on bot score
            actions: {
                definitelyAutomated: 'block',    // Score 0-29
                likelyAutomated: 'challenge',     // Score 30-49
                likelyHuman: 'allow',             // Score 70-89
                definitelyHuman: 'allow'          // Score 90-100
            },

            // Verified bots to allow
            verifiedBots: [
                'google',
                'microsoft',
                'facebook',
                'twitter',
                'apple',
                'amazon',
                'cloudflare'
            ]
        },

        // Content protection
        contentProtection: {
            // Prevent hotlinking
            hotlinkProtection: {
                enabled: false,
                allowedDomains: [], // Empty = allow none, ['*'] = allow all
                action: 'block'
            },

            // Protect sensitive files
            sensitiveFiles: [
                '.env',
                '.env.*',
                '*.key',
                '*.pem',
                '*.crt',
                '*.p12',
                '.htaccess',
                '.htpasswd',
                'web.config',
                'composer.json',
                'package.json',
                'wp-config.php',
                'config.php',
                'database.yml',
                '*.sql',
                '*.backup'
            ],

            // File upload restrictions
            uploadRestrictions: {
                maxFileSize: 10485760, // 10MB
                allowedExtensions: [
                    'jpg', 'jpeg', 'png', 'gif', 'webp',
                    'pdf', 'doc', 'docx', 'xls', 'xlsx',
                    'txt', 'csv', 'json', 'xml'
                ],
                blockedExtensions: [
                    'exe', 'bat', 'cmd', 'com', 'pif', 'scr',
                    'vbs', 'js', 'jar', 'app', 'deb',
                    'pkg', 'dmg', 'iso', 'img', 'msi'
                ],
                action: 'block'
            }
        },

        // DDoS protection
        ddosProtection: {
            // HTTP DDoS protection level
            httpLevel: 'medium', // low, medium, high, advanced

            // Network DDoS protection
            networkLevel: true,

            // SYN flood protection
            synProtection: true,

            // UDP flood protection
            udpProtection: true,

            // Amplification attack protection
            amplificationProtection: true,

            // Custom rate limiting for DDoS
            customRules: [
                {
                    name: 'High bandwidth usage',
                    condition: 'http.request.headers.visits_in_minutes > 1000',
                    action: 'challenge'
                },
                {
                    name: 'Suspicious user agent',
                    condition: 'http.request.headers.user_agent contains "bot" or "crawler" or "scraper"',
                    action: 'challenge'
                }
            ]
        },

        // Zero Trust security
        zeroTrust: {
            // Device posture rules
            devicePosture: {
                requireSecureOS: true,
                requiredOSVersions: {
                    windows: '10.0.19042',
                    macos: '11.0',
                    linux: '5.4.0',
                    ios: '14.0',
                    android: '10.0'
                },
                blockJailbroken: true,
                blockRooted: true
            },

            // Location-based rules
            locationRules: {
                requireVPN: false,
                allowedCountries: [], // Empty = allow all
                blockAnonymousNetworks: true,
                blockHostingProviders: true
            },

            // Time-based rules
            timeBasedRules: {
                businessHoursOnly: false,
                businessHours: {
                    start: '09:00',
                    end: '17:00',
                    timezone: 'America/New_York',
                    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                }
            }
        }
    },

    // Security Headers Configuration
    securityHeaders: {
        // Content Security Policy
        contentSecurityPolicy: {
            enabled: true,
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google-analytics.com"],
                'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                'img-src': ["'self'", "data:", "https:", "blob:"],
                'font-src': ["'self'", "https://fonts.gstatic.com"],
                'connect-src': ["'self'", "https://api.example.com"],
                'frame-ancestors': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"],
                'frame-src': ["'none'"],
                'media-src': ["'self'"],
                'object-src': ["'none'"],
                'manifest-src': ["'self'"],
                'worker-src': ["'self'"]
            },
            reportOnly: false,
            reportUri: '/api/csp-report'
        },

        // HTTP Strict Transport Security
        strictTransportSecurity: {
            enabled: true,
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },

        // X-Frame-Options
        xFrameOptions: {
            enabled: true,
            value: 'DENY' // DENY, SAMEORIGIN, ALLOW-FROM
        },

        // X-Content-Type-Options
        xContentTypeOptions: {
            enabled: true,
            value: 'nosniff'
        },

        // Referrer Policy
        referrerPolicy: {
            enabled: true,
            value: 'strict-origin-when-cross-origin'
        },

        // Permissions Policy
        permissionsPolicy: {
            enabled: true,
            directives: {
                'geolocation': [],
                'microphone': [],
                'camera': [],
                'payment': [],
                'usb': [],
                'accelerometer': [],
                'gyroscope': [],
                'magnetometer': []
            }
        },

        // Additional security headers
        additionalHeaders: {
            'X-XSS-Protection': '1; mode=block',
            'X-Permitted-Cross-Domain-Policies': 'none',
            'X-Download-Options': 'noopen',
            'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive',
            'Server': 'Cloudflare'  // Hide server signature
        }
    },

    // SSL/TLS Configuration
    sslTls: {
        // SSL/TLS settings
        minTLSVersion: '1.2',
        maxTLSVersion: '1.3',
        ciphers: [
            'TLS_AES_128_GCM_SHA256',
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
            'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
            'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
            'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256'
        ],

        // HSTS preload
        hstsPreload: true,

        // Certificate transparency
        certificateTransparency: true,

        // OCSP stapling
        ocspStapling: true
    },

    // Authentication and Authorization
    auth: {
        // Rate limiting for authentication
        rateLimit: {
            login: {
                maxAttempts: 5,
                windowMinutes: 15,
                lockoutMinutes: 30
            },
            passwordReset: {
                maxAttempts: 3,
                windowMinutes: 60,
                lockoutMinutes: 60
            },
            registration: {
                maxAttempts: 10,
                windowMinutes: 1440, // 24 hours
                lockoutMinutes: 1440
            }
        },

        // Password policy
        passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            preventCommonPasswords: true,
            preventUserInfoInPassword: true,
            passwordHistory: 5,
            maxAge: 90 // days
        },

        // Multi-factor authentication
        mfa: {
            required: false,
            gracePeriodDays: 7,
            methods: ['totp', 'sms', 'email'],
            backupCodes: {
                count: 10,
                length: 8
            }
        },

        // Session management
        sessionManagement: {
            maxDuration: 3600, // 1 hour
            absoluteMaxDuration: 28800, // 8 hours
            concurrentSessions: 3,
            secureFlag: true,
            httpOnlyFlag: true,
            sameSitePolicy: 'Strict'
        }
    },

    // Logging and Monitoring
    logging: {
        // Security event logging
        securityEvents: {
            loginAttempts: true,
            failedLogins: true,
            passwordChanges: true,
            mfaEvents: true,
            privilegeChanges: true,
            dataAccess: true,
            configChanges: true,
            firewallEvents: true
        },

        // Log retention
        retention: {
            securityLogs: 365, // days
            accessLogs: 90,
            errorLogs: 30,
            performanceLogs: 7
        },

        // Alert configuration
        alerts: {
            channels: ['email', 'slack', 'webhook'],
            thresholds: {
                failedLoginsPerHour: 20,
                unusualAccessPatterns: true,
                securityPolicyViolations: true,
                privilegeEscalation: true
            }
        }
    },

    // Compliance settings
    compliance: {
        // GDPR compliance
        gdpr: {
            enabled: true,
            dataProcessingAgreement: true,
            consentManagement: true,
            dataPortability: true,
            rightToErasure: true,
            breachNotification: true
        },

        // HIPAA compliance
        hipaa: {
            enabled: false,
            auditLogging: true,
            accessControls: true,
            encryption: true,
            backupAndRecovery: true
        },

        // SOC 2 compliance
        soc2: {
            enabled: false,
            type: 'SOC2_Type2',
            auditFrequency: 'annual',
            accessReviews: 'quarterly',
            riskAssessments: 'annual'
        }
    }
};

// Export configuration for use in Cloudflare Workers or Pages Functions
module.exports = SECURITY_CONFIG;

// Helper functions for security implementation
const SecurityHelpers = {
    /**
     * Generate WAF rule expressions
     */
    generateWAFExpression: (rule) => {
        // Implementation for generating WAF expressions
        // This would be used to create Cloudflare WAF rules
    },

    /**
     * Validate security headers
     */
    validateSecurityHeaders: (headers) => {
        // Implementation for validating security headers
        return {
            valid: true,
            issues: []
        };
    },

    /**
     * Generate CSP policy string
     */
    generateCSP: (config) => {
        const directives = Object.entries(config.directives)
            .map(([key, values]) => `${key} ${values.join(' ')}`)
            .join('; ');

        return directives;
    },

    /**
     * Check for security vulnerabilities
     */
    checkVulnerabilities: (request) => {
        // Implementation for checking common vulnerabilities
        return {
            hasVulnerabilities: false,
            vulnerabilities: [],
            riskScore: 0
        };
    },

    /**
     * Rate limiting check
     */
    checkRateLimit: (client, action) => {
        // Implementation for rate limiting
        return {
            allowed: true,
            remaining: 99,
            resetTime: Date.now() + 60000
        };
    },

    /**
     * Geolocation check
     */
    checkGeolocation: (client, rules) => {
        // Implementation for geolocation-based rules
        return {
            allowed: true,
            country: 'US',
            action: 'allow'
        };
    }
};

// Export helpers
module.exports.SecurityHelpers = SecurityHelpers;