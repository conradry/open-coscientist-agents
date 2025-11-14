/**
 * D1 Query Performance Analyzer
 * Optimizes medical research platform for 60ms response times
 *
 * Features:
 * - Query performance analysis
 * - Index recommendations
 * - Slow query detection
 * - Optimization suggestions
 * - Performance metrics tracking
 */

import { createClient } from '@libsql/client';

class D1QueryAnalyzer {
    constructor(d1Client, config = {}) {
        this.d1 = d1Client;
        this.config = {
            slowQueryThreshold: config.slowQueryThreshold || 100, // 100ms
            enableProfiling: config.enableProfiling !== false,
            enableIndexAnalysis: config.enableIndexAnalysis !== false,
            enableOptimizationSuggestions: config.enableOptimizationSuggestions !== false,
            maxQueryHistory: config.maxQueryHistory || 1000,
            ...config
        };

        this.queryHistory = [];
        this.slowQueries = [];
        this.indexUsage = new Map();
        this.performanceMetrics = {
            totalQueries: 0,
            avgResponseTime: 0,
            slowQueryCount: 0,
            indexHitRate: 0,
            cacheHitRate: 0
        };
    }

    /**
     * Analyze query execution and provide insights
     */
    async analyzeQuery(query, params = [], options = {}) {
        const startTime = Date.now();
        const analysisResult = {
            query,
            params,
            timestamp: new Date().toISOString(),
            responseTime: 0,
            rowsAffected: 0,
            indexUsed: null,
            optimizationSuggestions: [],
            status: 'success'
        };

        try {
            // Execute EXPLAIN QUERY PLAN
            const explainResult = await this.analyzeQueryPlan(query, params);

            // Execute actual query if not analysis only
            let actualResult = null;
            if (!options.analysisOnly) {
                actualResult = await this.d1.execute(query, params);
                analysisResult.rowsAffected = actualResult.rows.length;
            }

            const responseTime = Date.now() - startTime;
            analysisResult.responseTime = responseTime;

            // Analyze performance
            const performanceAnalysis = await this.analyzePerformance(
                query,
                explainResult,
                responseTime,
                actualResult
            );

            analysisResult.queryPlan = explainResult.plan;
            analysisResult.performance = performanceAnalysis;
            analysisResult.optimizationSuggestions = performanceAnalysis.suggestions;

            // Track metrics
            this.updateMetrics(responseTime, analysisResult);

            // Log slow queries
            if (responseTime > this.config.slowQueryThreshold) {
                this.logSlowQuery(analysisResult);
            }

            return analysisResult;

        } catch (error) {
            analysisResult.status = 'error';
            analysisResult.error = error.message;
            analysisResult.responseTime = Date.now() - startTime;

            throw new Error(`Query analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze query execution plan
     */
    async analyzeQueryPlan(query, params = []) {
        try {
            const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
            const result = await this.d1.execute(explainQuery, params);

            const plan = result.rows.map(row => ({
                id: row.id,
                parent: row.parent,
                notused: row.notused,
                detail: row.detail
            }));

            // Analyze plan characteristics
            const analysis = this.parseQueryPlan(plan);

            return {
                plan,
                analysis,
                estimatedCost: this.estimateQueryCost(plan),
                usesIndex: this.usesIndex(plan),
                tableScans: this.countTableScans(plan)
            };

        } catch (error) {
            throw new Error(`Query plan analysis failed: ${error.message}`);
        }
    }

    /**
     * Parse and analyze query plan details
     */
    parseQueryPlan(plan) {
        const analysis = {
            type: 'unknown',
            tables: [],
            indexes: [],
            operations: []
        };

        for (const step of plan) {
            const detail = step.detail.toLowerCase();

            // Identify operation types
            if (detail.includes('scan')) {
                analysis.operations.push('SCAN');
            } else if (detail.includes('search')) {
                analysis.operations.push('SEARCH');
            } else if (detail.includes('using index')) {
                analysis.operations.push('INDEX_SEARCH');
                const indexMatch = detail.match(/using index (\w+)/);
                if (indexMatch) {
                    analysis.indexes.push(indexMatch[1]);
                }
            }

            // Extract table names
            const tableMatch = detail.match(/from (\w+)/);
            if (tableMatch) {
                analysis.tables.push(tableMatch[1]);
            }

            // Determine query type
            if (detail.includes('scan table')) {
                analysis.type = 'full_table_scan';
            } else if (detail.includes('using index')) {
                analysis.type = 'index_search';
            } else if (detail.includes('temporary') || detail.includes('subquery')) {
                analysis.type = 'subquery';
            }
        }

        return analysis;
    }

    /**
     * Estimate query cost based on execution plan
     */
    estimateQueryCost(plan) {
        let cost = 0;

        for (const step of plan) {
            const detail = step.detail.toLowerCase();

            if (detail.includes('scan table')) {
                cost += 1000; // High cost for table scans
            } else if (detail.includes('using index')) {
                cost += 10; // Low cost for index searches
            } else if (detail.includes('temporary') || detail.includes('btree')) {
                cost += 100; // Medium cost for temporary operations
            }
        }

        return cost;
    }

    /**
     * Check if query uses indexes
     */
    usesIndex(plan) {
        return plan.some(step => step.detail.toLowerCase().includes('using index'));
    }

    /**
     * Count table scans in execution plan
     */
    countTableScans(plan) {
        return plan.filter(step =>
            step.detail.toLowerCase().includes('scan table')
        ).length;
    }

    /**
     * Analyze query performance and provide suggestions
     */
    async analyzePerformance(query, planAnalysis, responseTime, result) {
        const suggestions = [];
        const performance = {
            score: 100,
            issues: [],
            optimizations: []
        };

        // Response time analysis
        if (responseTime > this.config.slowQueryThreshold) {
            performance.score -= 30;
            performance.issues.push('Query exceeds performance threshold');
            suggestions.push({
                type: 'performance',
                severity: 'high',
                message: `Query took ${responseTime}ms (threshold: ${this.config.slowQueryThreshold}ms)`,
                suggestion: 'Consider query optimization or indexing'
            });
        }

        // Table scan analysis
        if (planAnalysis.usesIndex === false) {
            performance.score -= 25;
            performance.issues.push('Query performs table scan');
            suggestions.push({
                type: 'indexing',
                severity: 'high',
                message: 'Query uses full table scan instead of index',
                suggestion: 'Create appropriate indexes for WHERE clause columns'
            });
        }

        // Multiple table scans
        if (planAnalysis.tableScans > 1) {
            performance.score -= 15;
            performance.issues.push(`Multiple table scans detected (${planAnalysis.tableScans})`);
            suggestions.push({
                type: 'query_structure',
                severity: 'medium',
                message: 'Multiple table scans detected',
                suggestion: 'Consider rewriting query or adding composite indexes'
            });
        }

        // JOIN analysis
        if (query.toLowerCase().includes('join')) {
            const joinAnalysis = await this.analyzeJoins(query, planAnalysis);
            if (joinAnalysis.needsOptimization) {
                performance.score -= 20;
                performance.issues.push('JOIN operation needs optimization');
                suggestions.push({
                    type: 'joins',
                    severity: 'medium',
                    message: 'JOIN operation could be optimized',
                    suggestion: 'Add indexes on join columns and ensure proper join order'
                });
            }
        }

        // WHERE clause analysis
        const whereAnalysis = this.analyzeWhereClause(query);
        if (whereAnalysis.unindexedColumns.length > 0) {
            suggestions.push({
                type: 'indexing',
                severity: 'medium',
                message: `Unindexed columns in WHERE clause: ${whereAnalysis.unindexedColumns.join(', ')}`,
                suggestion: 'Create indexes on frequently filtered columns'
            });
        }

        // ORDER BY analysis
        if (query.toLowerCase().includes('order by')) {
            const orderAnalysis = this.analyzeOrderBy(query);
            if (orderAnalysis.needsIndex) {
                suggestions.push({
                    type: 'indexing',
                    severity: 'low',
                    message: 'ORDER BY could benefit from composite index',
                    suggestion: 'Create composite index covering ORDER BY columns'
                });
            }
        }

        // Result set size analysis
        if (result && result.rows.length > 1000) {
            performance.score -= 10;
            suggestions.push({
                type: 'pagination',
                severity: 'low',
                message: 'Large result set returned',
                suggestion: 'Implement pagination with LIMIT and OFFSET'
            });
        }

        // FTS5 optimization for medical search
        if (query.toLowerCase().includes('match') || query.toLowerCase().includes('papers_fts')) {
            const ftsSuggestions = this.analyzeFTSQuery(query);
            suggestions.push(...ftsSuggestions);
        }

        performance.suggestions = suggestions;
        performance.optimizations = suggestions.filter(s => s.severity === 'high');

        return performance;
    }

    /**
     * Analyze JOIN operations
     */
    async analyzeJoins(query, planAnalysis) {
        const joinAnalysis = {
            needsOptimization: false,
            joinColumns: [],
            missingIndexes: []
        };

        // Extract join columns (simplified regex approach)
        const joinPattern = /join\s+(\w+)\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
        const joins = [...query.matchAll(joinPattern)];

        for (const join of joins) {
            const [, table, leftTable, leftColumn, rightTable, rightColumn] = join;

            joinAnalysis.joinColumns.push({
                table,
                column: leftColumn,
                otherTable: rightTable,
                otherColumn: rightColumn
            });

            // Check if join columns have indexes
            const leftIndexCheck = await this.checkIndexExists(leftTable, leftColumn);
            const rightIndexCheck = await this.checkIndexExists(rightTable, rightColumn);

            if (!leftIndexCheck) {
                joinAnalysis.missingIndexes.push(`${leftTable}.${leftColumn}`);
            }
            if (!rightIndexCheck) {
                joinAnalysis.missingIndexes.push(`${rightTable}.${rightColumn}`);
            }
        }

        joinAnalysis.needsOptimization = joinAnalysis.missingIndexes.length > 0;

        return joinAnalysis;
    }

    /**
     * Analyze WHERE clause for indexing opportunities
     */
    analyzeWhereClause(query) {
        const analysis = {
            columns: [],
            unindexedColumns: [],
            conditions: []
        };

        // Extract WHERE clause (simplified)
        const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
        if (whereMatch) {
            const whereClause = whereMatch[1];

            // Extract column names (simplified regex)
            const columnPattern = /(\w+)\.(\w+)/g;
            const matches = [...whereClause.matchAll(columnPattern)];

            for (const match of matches) {
                const [, table, column] = match;
                analysis.columns.push(`${table}.${column}`);
                analysis.unindexedColumns.push(`${table}.${column}`);
            }
        }

        return analysis;
    }

    /**
     * Analyze ORDER BY clause
     */
    analyzeOrderBy(query) {
        const analysis = {
            columns: [],
            needsIndex: false
        };

        const orderByMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
        if (orderByMatch) {
            const orderByClause = orderByMatch[1];
            analysis.columns = orderByClause.split(',').map(col => col.trim().split(' ')[0]);
            analysis.needsIndex = analysis.columns.length > 1; // Multi-column ORDER BY benefits from index
        }

        return analysis;
    }

    /**
     * Analyze FTS5 queries for medical search optimization
     */
    analyzeFTSQuery(query) {
        const suggestions = [];

        // Check for FTS5 usage
        if (query.toLowerCase().includes('papers_fts')) {
            // Look for MATCH queries
            if (query.toLowerCase().includes('match')) {
                // Check for boolean operators
                if (!query.toLowerCase().match(/\b(and|or|not)\b/)) {
                    suggestions.push({
                        type: 'fts',
                        severity: 'low',
                        message: 'Consider using boolean operators (AND, OR, NOT) for better precision',
                        suggestion: 'Use boolean operators to improve search relevance'
                    });
                }

                // Check for phrase searches
                if (!query.includes('"')) {
                    suggestions.push({
                        type: 'fts',
                        severity: 'low',
                        message: 'Consider using phrase searches for exact matches',
                        suggestion: 'Use quotes for phrase searches: "exact phrase"'
                    });
                }

                // Check for LIMIT clause
                if (!query.toLowerCase().includes('limit')) {
                    suggestions.push({
                        type: 'performance',
                        severity: 'medium',
                        message: 'FTS queries should have LIMIT clause',
                        suggestion: 'Add LIMIT to prevent returning too many results'
                    });
                }
            }
        }

        return suggestions;
    }

    /**
     * Check if index exists for a table column
     */
    async checkIndexExists(tableName, columnName) {
        try {
            const query = `
                SELECT name FROM sqlite_master
                WHERE type = 'index'
                AND tbl_name = ?
                AND sql LIKE ?
                LIMIT 1
            `;

            const result = await this.d1.execute(query, [tableName, `%${columnName}%`]);
            return result.rows.length > 0;

        } catch (error) {
            console.warn('Index check failed:', error.message);
            return false;
        }
    }

    /**
     * Get index recommendations for a table
     */
    async getIndexRecommendations(tableName, limit = 10) {
        const recommendations = [];

        try {
            // Analyze recent slow queries for this table
            const tableSlowQueries = this.slowQueries.filter(q =>
                q.query.toLowerCase().includes(`from ${tableName}`)
            );

            // Extract commonly queried columns
            const columnFrequency = new Map();
            for (const slowQuery of tableSlowQueries) {
                const columns = this.extractQueryColumns(slowQuery.query);
                for (const column of columns) {
                    columnFrequency.set(column, (columnFrequency.get(column) || 0) + 1);
                }
            }

            // Generate index recommendations
            for (const [column, frequency] of columnFrequency.entries()) {
                if (frequency >= 2) { // Frequently queried columns
                    recommendations.push({
                        table: tableName,
                        columns: [column],
                        type: 'simple',
                        priority: frequency >= 5 ? 'high' : 'medium',
                        reason: `Used in ${frequency} slow queries`,
                        sql: `CREATE INDEX idx_${tableName}_${column} ON ${tableName}(${column});`
                    });
                }
            }

            // Check for composite index opportunities
            const compositeSuggestions = this.suggestCompositeIndexes(tableSlowQueries);
            recommendations.push(...compositeSuggestions);

            return recommendations.sort((a, b) => {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }).slice(0, limit);

        } catch (error) {
            console.error('Index recommendation analysis failed:', error);
            return [];
        }
    }

    /**
     * Suggest composite indexes for multi-column queries
     */
    suggestCompositeIndexes(slowQueries) {
        const compositeSuggestions = [];

        // Group queries by table and column combinations
        const queryGroups = new Map();

        for (const query of slowQueries) {
            const columns = this.extractQueryColumns(query.query);
            if (columns.length > 1) {
                const key = columns.join(',');
                if (!queryGroups.has(key)) {
                    queryGroups.set(key, []);
                }
                queryGroups.get(key).push(query);
            }
        }

        // Generate composite index suggestions
        for (const [columns, queries] of queryGroups) {
            if (queries.length >= 2) {
                const table = this.extractTableName(queries[0].query);
                const columnList = columns.split(',');

                compositeSuggestions.push({
                    table,
                    columns: columnList,
                    type: 'composite',
                    priority: 'high',
                    reason: `Used together in ${queries.length} slow queries`,
                    frequency: queries.length,
                    sql: `CREATE INDEX idx_${table}_${columnList.join('_')} ON ${table}(${columnList.join(', ')});`
                });
            }
        }

        return compositeSuggestions;
    }

    /**
     * Extract columns from SQL query (simplified)
     */
    extractQueryColumns(query) {
        const columns = [];
        const lowerQuery = query.toLowerCase();

        // Extract columns from WHERE clause
        const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
        if (whereMatch) {
            const whereClause = whereMatch[1];
            const columnPattern = /(\w+)\.(\w+)/g;
            const matches = [...whereClause.matchAll(columnPattern)];

            for (const match of matches) {
                columns.push(match[2]);
            }
        }

        // Extract columns from ORDER BY
        const orderByMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
        if (orderByMatch) {
            const orderByColumns = orderByMatch[1].split(',').map(col => col.trim().split(' ')[0]);
            columns.push(...orderByColumns);
        }

        return [...new Set(columns)];
    }

    /**
     * Extract table name from query (simplified)
     */
    extractTableName(query) {
        const fromMatch = query.match(/from\s+(\w+)/i);
        return fromMatch ? fromMatch[1] : 'unknown';
    }

    /**
     * Update performance metrics
     */
    updateMetrics(responseTime, analysis) {
        this.performanceMetrics.totalQueries++;

        // Update average response time
        const totalQueries = this.performanceMetrics.totalQueries;
        const currentAvg = this.performanceMetrics.avgResponseTime;
        this.performanceMetrics.avgResponseTime =
            (currentAvg * (totalQueries - 1) + responseTime) / totalQueries;

        // Update slow query count
        if (responseTime > this.config.slowQueryThreshold) {
            this.performanceMetrics.slowQueryCount++;
        }

        // Update query history
        this.queryHistory.push(analysis);
        if (this.queryHistory.length > this.config.maxQueryHistory) {
            this.queryHistory.shift();
        }
    }

    /**
     * Log slow query for analysis
     */
    logSlowQuery(analysis) {
        this.slowQueries.push(analysis);

        // Limit slow query history
        if (this.slowQueries.length > this.config.maxQueryHistory) {
            this.slowQueries.shift();
        }

        console.warn(`⚠️  Slow query detected (${analysis.responseTime}ms):`, analysis.query.substring(0, 100));
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.performanceMetrics,
            slowQueries: this.slowQueries.slice(0, 10), // Top 10 slow queries
            topSlowQueries: this.getTopSlowQueries(),
            indexRecommendations: [],
            performanceGrade: this.calculatePerformanceGrade(),
            recommendations: []
        };

        // Add recommendations based on metrics
        if (this.performanceMetrics.avgResponseTime > 50) {
            report.recommendations.push({
                type: 'performance',
                message: 'Average response time exceeds 50ms target',
                suggestion: 'Review slow queries and consider adding indexes'
            });
        }

        if (this.performanceMetrics.slowQueryCount > this.performanceMetrics.totalQueries * 0.1) {
            report.recommendations.push({
                type: 'query_optimization',
                message: 'High percentage of slow queries detected',
                suggestion: 'Focus on optimizing frequently executed slow queries'
            });
        }

        return report;
    }

    /**
     * Get top slow queries by frequency and response time
     */
    getTopSlowQueries() {
        const queryFrequency = new Map();

        for (const slowQuery of this.slowQueries) {
            const normalizedQuery = this.normalizeQuery(slowQuery.query);
            const existing = queryFrequency.get(normalizedQuery) || {
                query: slowQuery.query,
                count: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                maxResponseTime: 0
            };

            existing.count++;
            existing.totalResponseTime += slowQuery.responseTime;
            existing.avgResponseTime = existing.totalResponseTime / existing.count;
            existing.maxResponseTime = Math.max(existing.maxResponseTime, slowQuery.responseTime);

            queryFrequency.set(normalizedQuery, existing);
        }

        return Array.from(queryFrequency.values())
            .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
            .slice(0, 5);
    }

    /**
     * Normalize query for grouping (remove parameters, normalize whitespace)
     */
    normalizeQuery(query) {
        return query
            .replace(/\s+/g, ' ')
            .replace(/\?/g, '?')
            .trim();
    }

    /**
     * Calculate overall performance grade
     */
    calculatePerformanceGrade() {
        const metrics = this.performanceMetrics;
        let score = 100;

        // Response time scoring
        if (metrics.avgResponseTime > 100) score -= 30;
        else if (metrics.avgResponseTime > 50) score -= 15;

        // Slow query percentage scoring
        const slowQueryPercentage = metrics.slowQueryCount / metrics.totalQueries;
        if (slowQueryPercentage > 0.2) score -= 25;
        else if (slowQueryPercentage > 0.1) score -= 10;

        // Index usage scoring
        if (metrics.indexHitRate < 0.8) score -= 20;

        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }
}

export default D1QueryAnalyzer;

// Example usage:
/*
import { createClient } from '@libsql/client';
import D1QueryAnalyzer from './query-analyzer.js';

const d1 = createClient({
    url: process.env.D1_DATABASE_URL,
    authToken: process.env.D1_AUTH_TOKEN
});

const analyzer = new D1QueryAnalyzer(d1, {
    slowQueryThreshold: 60, // Medical platform target: 60ms
    enableProfiling: true
});

// Analyze a search query
const searchQuery = `
    SELECT p.* FROM papers p
    JOIN papers_fts ON p.id = papers_fts.rowid
    WHERE papers_fts MATCH ? AND p.medical_specialty = ?
    ORDER BY p.citation_count DESC
    LIMIT 20
`;

const analysis = await analyzer.analyzeQuery(searchQuery, ['cardiology treatment', 'Cardiology']);

console.log('Query Analysis:', analysis);
console.log('Optimization Suggestions:', analysis.optimizationSuggestions);

// Get index recommendations
const recommendations = await analyzer.getIndexRecommendations('papers');
console.log('Index Recommendations:', recommendations);

// Generate performance report
const report = analyzer.generateReport();
console.log('Performance Report:', report);
*/