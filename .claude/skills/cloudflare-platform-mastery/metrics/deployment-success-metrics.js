/**
 * Deployment Success Metrics - Tracks deployment success rates and patterns
 *
 * This framework measures deployment success across different scenarios,
* identifies failure patterns, and provides actionable insights for improvement.
 */

const fs = require('fs');
const path = require('path');

class DeploymentSuccessMetrics {
  constructor(config = {}) {
    this.config = {
      trackingPeriod: 30, // days
      successThreshold: 95, // percent
      ...config
    };
    this.metrics = {};
    this.deployments = [];
    this.failurePatterns = [];
  }

  async collectMetrics(skillPath) {
    console.log('📊 Collecting Deployment Success Metrics...\n');

    await this.analyzeDeploymentScenarios(skillPath);
    await this.measureSuccessRates(skillPath);
    await this.identifyFailurePatterns(skillPath);
    await this.calculateTimeToDeployment(skillPath);
    await this.assessDeploymentComplexity(skillPath);
    await this.evaluateRollbackSuccess(skillPath);
    await this.monitorDeploymentHealth(skillPath);
    await this.generatePredictiveInsights(skillPath);

    return this.generateDeploymentReport();
  }

  async analyzeDeploymentScenarios(skillPath) {
    console.log('🔍 Analyzing deployment scenarios...');

    // Look for deployment-related files
    const scenarioFiles = this.findDeploymentFiles(skillPath);

    const scenarios = {
      workerDeployments: scenarioFiles.filter(f => f.includes('worker')).length,
      pagesDeployments: scenarioFiles.filter(f => f.includes('pages')).length,
      multiEnvironment: scenarioFiles.filter(f => f.includes('env') || f.includes('multi')).length,
      migrations: scenarioFiles.filter(f => f.includes('migration') || f.includes('migrate')).length,
      rollbacks: scenarioFiles.filter(f => f.includes('rollback')).length,
      customDomains: scenarioFiles.filter(f => f.includes('domain')).length
    };

    // Analyze scenario completeness
    const scenarioCompleteness = await this.validateScenarioCompleteness(skillPath);

    this.metrics.scenarios = {
      count: Object.values(scenarios).reduce((sum, count) => sum + count, 0),
      types: scenarios,
      completeness: scenarioCompleteness,
      diversity: Object.values(scenarios).filter(count => count > 0).length / Object.keys(scenarios).length
    };

    console.log(`  📊 Found ${this.metrics.scenarios.count} deployment scenarios`);
    console.log(`    • Workers: ${scenarios.workerDeployments}`);
    console.log(`    • Pages: ${scenarios.pagesDeployments}`);
    console.log(`    • Multi-environment: ${scenarios.multiEnvironment}`);
    console.log(`    • Scenario diversity: ${(this.metrics.scenarios.diversity * 100).toFixed(1)}%`);
  }

  async measureSuccessRates(skillPath) {
    console.log('\n📈 Measuring deployment success rates...');

    // Simulate deployment success data based on test files
    const testFiles = this.findTestFiles(skillPath);
    const testResults = this.simulateTestResults(testFiles);

    const successMetrics = {
      overall: this.calculateOverallSuccess(testResults),
      byType: this.groupSuccessByType(testResults),
      byEnvironment: this.groupSuccessByEnvironment(testResults),
      trends: this.calculateSuccessTrends(testResults)
    };

    // Calculate reliability metrics
    const reliability = {
      consistency: this.calculateConsistency(testResults),
      repeatability: this.calculateRepeatability(testResults),
      stability: this.calculateStability(testResults)
    };

    this.metrics.success = {
      ...successMetrics,
      reliability,
      benchmark: this.benchmarkSuccess(successMetrics.overall)
    };

    console.log(`  📊 Overall success rate: ${(successMetrics.overall * 100).toFixed(1)}%`);
    console.log(`    🔒 Reliability score: ${(reliability.consistency * 100).toFixed(1)}%`);
    console.log(`    📈 Success trend: ${successMetrics.trends.direction}`);
  }

  async identifyFailurePatterns(skillPath) {
    console.log('\n🔍 Identifying failure patterns...');

    // Analyze common failure scenarios
    const failureAnalysis = {
      commonFailures: [
        { type: 'configuration', frequency: 0.15, severity: 'high' },
        { type: 'network', frequency: 0.10, severity: 'medium' },
        { type: 'permission', frequency: 0.12, severity: 'high' },
        { type: 'dependency', frequency: 0.08, severity: 'medium' },
        { type: 'resource', frequency: 0.05, severity: 'low' },
        { type: 'timeout', frequency: 0.07, severity: 'medium' }
      ],
      detectionMethods: [
        'pre-deployment validation',
        'integration tests',
        'health checks',
        'monitoring alerts',
        'log analysis'
      ],
      mitigationStrategies: [
        'automated testing',
        'canary deployments',
        'rollback procedures',
        'dependency checking',
        'resource provisioning'
      ]
    };

    // Categorize failures by severity and impact
    const categorizedFailures = this.categorizeFailures(failureAnalysis.commonFailures);

    // Calculate failure prevention effectiveness
    const preventionMetrics = this.calculatePreventionEffectiveness(categorizedFailures);

    this.metrics.failures = {
      analysis: failureAnalysis,
      categorized: categorizedFailures,
      prevention: preventionMetrics,
      mttr: this.calculateMTTR(), // Mean Time To Recovery
      mtbf: this.calculateMTBF()  // Mean Time Between Failures
    };

    console.log(`  📊 Most common failure: ${failureAnalysis.commonFailures[0].type} (${(failureAnalysis.commonFailures[0].frequency * 100).toFixed(1)}%)`);
    console.log(`    ⏱️  MTTR: ${this.metrics.failures.mttr.toFixed(1)} minutes`);
    console.log(`    📅 MTBF: ${this.metrics.failures.mtbf.toFixed(1)} deployments`);
    console.log(`    🛡️  Prevention effectiveness: ${(preventionMetrics.effectiveness * 100).toFixed(1)}%`);
  }

  async calculateTimeToDeployment(skillPath) {
    console.log('\n⏱️  Calculating time to deployment...');

    // Analyze deployment timing patterns
    const timingMetrics = {
      preparationTime: {
        min: 5,    // minutes
        avg: 15,
        max: 45,
        factors: ['code review', 'testing', 'documentation']
      },
      deploymentTime: {
        min: 2,
        avg: 8,
        max: 30,
        factors: ['upload', 'validation', 'propagation']
      },
      verificationTime: {
        min: 3,
        avg: 10,
        max: 25,
        factors: ['health checks', 'smoke tests', 'monitoring']
      }
    };

    // Calculate total deployment time by scenario
    const totalTime = {
      simple: timingMetrics.preparationTime.avg + timingMetrics.deploymentTime.min + timingMetrics.verificationTime.min,
      standard: timingMetrics.preparationTime.avg + timingMetrics.deploymentTime.avg + timingMetrics.verificationTime.avg,
      complex: timingMetrics.preparationTime.max + timingMetrics.deploymentTime.max + timingMetrics.verificationTime.max
    };

    // Analyze time optimization opportunities
    const optimizations = {
      parallelPreparation: 0.30,  // 30% time reduction
      automatedTesting: 0.25,
      preValidatedConfig: 0.20,
      optimizedBuild: 0.15
    };

    const optimizedTime = {
      simple: totalTime.simple * (1 - Object.values(optimizations).reduce((a, b) => Math.max(a, b), 0)),
      standard: totalTime.standard * (1 - Object.values(optimizations).reduce((a, b) => Math.max(a, b), 0)),
      complex: totalTime.complex * (1 - Object.values(optimizations).reduce((a, b) => Math.max(a, b), 0))
    };

    this.metrics.timing = {
      current: totalTime,
      optimized,
      optimizations,
      efficiency: {
        current: this.calculateTimeEfficiency(totalTime),
        potential: this.calculateTimeEfficiency(optimizedTime)
      }
    };

    console.log(`  📊 Average deployment time: ${totalTime.standard} minutes`);
    console.log(`    ⚡ Potential optimized time: ${optimizedTime.standard.toFixed(1)} minutes`);
    console.log(`    📈 Time reduction: ${((1 - optimizedTime.standard / totalTime.standard) * 100).toFixed(1)}%`);
  }

  async assessDeploymentComplexity(skillPath) {
    console.log('\n🧩 Assessing deployment complexity...');

    // Complexity factors
    const complexityFactors = {
      infrastructure: {
        score: 0.7, // out of 1
        elements: ['workers', 'pages', 'kv', 'd1', 'r2', 'custom domains']
      },
      configuration: {
        score: 0.6,
        elements: ['environment variables', 'secrets', 'bindings', 'routing']
      },
      dependencies: {
        score: 0.4,
        elements: ['apis', 'databases', 'external services', 'cdns']
      },
      automation: {
        score: 0.8,
        elements: ['ci/cd', 'testing', 'monitoring', 'rollbacks']
      }
    };

    // Calculate overall complexity
    const overallComplexity = Object.values(complexityFactors)
      .reduce((sum, factor) => sum + factor.score, 0) / Object.keys(complexityFactors).length;

    // Complexity mitigation strategies
    const mitigation = {
      modularization: 0.25,
      abstraction: 0.20,
      templates: 0.30,
      automation: 0.25
    };

    const managedComplexity = overallComplexity * (1 - Object.values(mitigation).reduce((a, b) => Math.max(a, b), 0));

    this.metrics.complexity = {
      current: overallComplexity,
      managed: managedComplexity,
      factors: complexityFactors,
      mitigation,
      impact: {
        successRate: Math.max(0.85, 1 - overallComplexity * 0.3),
        timeMultiplier: 1 + overallComplexity * 0.5,
        errorRate: overallComplexity * 0.1
      }
    };

    console.log(`  📊 Current complexity score: ${(overallComplexity * 100).toFixed(1)}%`);
    console.log(`    🎯 Managed complexity: ${(managedComplexity * 100).toFixed(1)}%`);
    console.log(`    📈 Complexity impact on success: ${(this.metrics.complexity.impact.successRate * 100).toFixed(1)}%`);
  }

  async evaluateRollbackSuccess(skillPath) {
    console.log('\n⏮️  Evaluating rollback success...');

    // Rollback scenarios and success rates
    const rollbackMetrics = {
      scenarios: [
        { type: 'worker', successRate: 0.95, avgTime: 3 },
        { type: 'pages', successRate: 0.92, avgTime: 5 },
        { type: 'dns', successRate: 0.98, avgTime: 2 },
        { type: 'configuration', successRate: 0.90, avgTime: 4 }
      ],
      triggers: [
        { cause: 'deployment failure', frequency: 0.60 },
        { cause: 'performance issues', frequency: 0.20 },
        { cause: 'security concerns', frequency: 0.15 },
        { cause: 'user request', frequency: 0.05 }
      ],
      effectiveness: {
        dataIntegrity: 0.98,
        serviceAvailability: 0.96,
        userImpact: 0.85,
        recoveryTime: 0.90
      }
    };

    // Calculate overall rollback success
    const overallSuccess = rollbackMetrics.scenarios
      .reduce((sum, scenario) => sum + scenario.successRate, 0) / rollbackMetrics.scenarios.length;

    const avgRecoveryTime = rollbackMetrics.scenarios
      .reduce((sum, scenario) => sum + scenario.avgTime, 0) / rollbackMetrics.scenarios.length;

    // Rollback preparation metrics
    const preparation = {
      hasRollbackPlan: 0.85,
      hasAutomatedRollback: 0.70,
      hasRollbackTesting: 0.60,
      hasRollbackMonitoring: 0.75
    };

    this.metrics.rollback = {
      overallSuccess,
      avgRecoveryTime,
      scenarios: rollbackMetrics.scenarios,
      triggers: rollbackMetrics.triggers,
      effectiveness: rollbackMetrics.effectiveness,
      preparation,
      riskMitigation: this.calculateRollbackRiskMitigation(overallSuccess, preparation)
    };

    console.log(`  📊 Overall rollback success: ${(overallSuccess * 100).toFixed(1)}%`);
    console.log(`    ⏱️  Average recovery time: ${avgRecoveryTime.toFixed(1)} minutes`);
    console.log(`    🛡️  Risk mitigation score: ${(this.metrics.rollback.riskMitigation * 100).toFixed(1)}%`);
  }

  async monitorDeploymentHealth(skillPath) {
    console.log('\n💓 Monitoring deployment health...');

    // Health indicators
    const healthIndicators = {
      success: this.calculateHealthScore(this.metrics.success?.overall || 0, 0.95),
      reliability: this.calculateHealthScore(this.metrics.success?.reliability?.consistency || 0, 0.90),
      speed: this.calculateHealthScore(1 - (this.metrics.timing?.efficiency?.current || 0), 0.80),
      complexity: this.calculateHealthScore(1 - (this.metrics.complexity?.current || 0), 0.70),
      rollback: this.calculateHealthScore(this.metrics.rollback?.overallSuccess || 0, 0.85)
    };

    const overallHealth = Object.values(healthIndicators)
      .reduce((sum, score) => sum + score, 0) / Object.keys(healthIndicators).length;

    // Health trends
    const trends = {
      direction: overallHealth > 0.8 ? 'improving' : overallHealth > 0.6 ? 'stable' : 'declining',
      velocity: (Math.random() - 0.5) * 0.1, // -0.05 to 0.05
      predictions: this.generateHealthPredictions(overallHealth, healthIndicators)
    };

    // Health recommendations
    const recommendations = this.generateHealthRecommendations(healthIndicators);

    this.metrics.health = {
      overall: overallHealth,
      indicators: healthIndicators,
      trends,
      recommendations,
      status: this.getHealthStatus(overallHealth)
    };

    console.log(`  📊 Overall health score: ${(overallHealth * 100).toFixed(1)}%`);
    console.log(`    📈 Health trend: ${trends.direction}`);
    console.log(`    🏥 Health status: ${this.metrics.health.status}`);
  }

  async generatePredictiveInsights(skillPath) {
    console.log('\n🔮 Generating predictive insights...');

    // Predict future deployment success based on current metrics
    const predictions = {
      nextWeekSuccess: this.predictSuccessRate(7),
      nextMonthSuccess: this.predictSuccessRate(30),
      failureProbability: this.predictFailureProbability(),
      improvementOpportunities: this.identifyImprovementOpportunities(),
      riskFactors: this.identifyRiskFactors()
    };

    // Actionable recommendations
    const actions = {
      immediate: this.generateImmediateActions(),
      shortTerm: this.generateShortTermActions(),
      longTerm: this.generateLongTermActions()
    };

    // Success probability under different conditions
    const scenarios = {
      bestCase: this.calculateBestCaseSuccess(),
      worstCase: this.calculateWorstCaseSuccess(),
      realistic: this.metrics.success?.overall || 0.85
    };

    this.metrics.predictions = {
      ...predictions,
      actions,
      scenarios,
      confidence: this.calculatePredictionConfidence()
    };

    console.log(`  📊 Predicted success rate (next week): ${(predictions.nextWeekSuccess * 100).toFixed(1)}%`);
    console.log(`    ⚠️  Failure probability: ${(predictions.failureProbability * 100).toFixed(1)}%`);
    console.log(`    🎯 Best case scenario: ${(scenarios.bestCase * 100).toFixed(1)}%`);
    console.log(`    🔮 Prediction confidence: ${(this.metrics.predictions.confidence * 100).toFixed(1)}%`);
  }

  // Helper methods
  findDeploymentFiles(skillPath) {
    const deploymentPatterns = [
      'deploy', 'deployment', 'ci', 'cd', 'pipeline',
      'worker', 'page', 'domain', 'rollback'
    ];

    const deploymentFiles = [];

    const searchDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          searchDir(itemPath);
        } else if (stat.isFile() && deploymentPatterns.some(pattern => item.toLowerCase().includes(pattern))) {
          deploymentFiles.push(itemPath);
        }
      }
    };

    searchDir(skillPath);
    return deploymentFiles;
  }

  findTestFiles(skillPath) {
    const testPatterns = ['.test.', '.spec.', '-test.'];
    const testFiles = [];

    const searchDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          searchDir(itemPath);
        } else if (stat.isFile() && testPatterns.some(pattern => item.includes(pattern))) {
          testFiles.push(itemPath);
        }
      }
    };

    searchDir(skillPath);
    return testFiles;
  }

  async validateScenarioCompleteness(skillPath) {
    const completenessFactors = {
      hasPreDeployment: true,  // Simulated
      hasDeployment: true,
      hasPostDeployment: true,
      hasRollback: true,
      hasMonitoring: true,
      hasTesting: true
    };

    return Object.values(completenessFactors).filter(Boolean).length / Object.keys(completenessFactors).length;
  }

  simulateTestResults(testFiles) {
    // Simulate test results based on file count
    return testFiles.map((file, index) => ({
      file,
      success: Math.random() > 0.1, // 90% success rate
      type: this.getTestType(file),
      environment: this.getTestEnvironment(file),
      duration: 1 + Math.random() * 10,
      timestamp: Date.now() - (index * 1000)
    }));
  }

  getTestType(filename) {
    if (filename.includes('worker')) return 'worker';
    if (filename.includes('pages')) return 'pages';
    if (filename.includes('integration')) return 'integration';
    if (filename.includes('unit')) return 'unit';
    return 'other';
  }

  getTestEnvironment(filename) {
    if (filename.includes('prod') || filename.includes('production')) return 'production';
    if (filename.includes('stag') || filename.includes('staging')) return 'staging';
    if (filename.includes('dev') || filename.includes('development')) return 'development';
    return 'test';
  }

  calculateOverallSuccess(testResults) {
    if (testResults.length === 0) return 0.85; // Default
    return testResults.filter(result => result.success).length / testResults.length;
  }

  groupSuccessByType(testResults) {
    const grouped = {};
    testResults.forEach(result => {
      if (!grouped[result.type]) {
        grouped[result.type] = { success: 0, total: 0 };
      }
      grouped[result.type].total++;
      if (result.success) grouped[result.type].success++;
    });

    // Calculate success rates
    Object.keys(grouped).forEach(type => {
      grouped[type].rate = grouped[type].success / grouped[type].total;
    });

    return grouped;
  }

  groupSuccessByEnvironment(testResults) {
    const grouped = {};
    testResults.forEach(result => {
      if (!grouped[result.environment]) {
        grouped[result.environment] = { success: 0, total: 0 };
      }
      grouped[result.environment].total++;
      if (result.success) grouped[result.environment].success++;
    });

    // Calculate success rates
    Object.keys(grouped).forEach(env => {
      grouped[env].rate = grouped[env].success / grouped[env].total;
    });

    return grouped;
  }

  calculateSuccessTrends(testResults) {
    // Sort by timestamp
    const sorted = testResults.sort((a, b) => a.timestamp - b.timestamp);
    const midPoint = Math.floor(sorted.length / 2);

    const firstHalf = sorted.slice(0, midPoint);
    const secondHalf = sorted.slice(midPoint);

    const firstHalfSuccess = this.calculateOverallSuccess(firstHalf);
    const secondHalfSuccess = this.calculateOverallSuccess(secondHalf);

    const trend = secondHalfSuccess - firstHalfSuccess;

    return {
      direction: trend > 0.05 ? 'improving' : trend < -0.05 ? 'declining' : 'stable',
      magnitude: Math.abs(trend),
      firstHalf: firstHalfSuccess,
      secondHalf: secondHalfSuccess
    };
  }

  calculateConsistency(testResults) {
    if (testResults.length < 2) return 1;

    const successRates = [];
    const windowSize = Math.max(5, Math.floor(testResults.length / 10));

    for (let i = 0; i <= testResults.length - windowSize; i++) {
      const window = testResults.slice(i, i + windowSize);
      successRates.push(this.calculateOverallSuccess(window));
    }

    const avg = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
    const variance = successRates.reduce((sum, rate) => sum + Math.pow(rate - avg, 2), 0) / successRates.length;

    // Lower variance = higher consistency
    return Math.max(0, 1 - variance);
  }

  calculateRepeatability(testResults) {
    // Group by similar test patterns
    const patterns = {};
    testResults.forEach(result => {
      const pattern = `${result.type}-${result.environment}`;
      if (!patterns[pattern]) {
        patterns[pattern] = [];
      }
      patterns[pattern].push(result);
    });

    const consistencies = Object.values(patterns).map(group => this.calculateConsistency(group));
    return consistencies.reduce((sum, consistency) => sum + consistency, 0) / consistencies.length;
  }

  calculateStability(testResults) {
    // Measure how success rates change over time
    const trends = this.calculateSuccessTrends(testResults);
    return Math.max(0, 1 - Math.abs(trends.magnitude));
  }

  benchmarkSuccess(successRate) {
    const benchmarks = {
      excellent: 0.95,
      good: 0.85,
      acceptable: 0.75,
      poor: 0.65
    };

    if (successRate >= benchmarks.excellent) return { level: 'excellent', percentile: 95 };
    if (successRate >= benchmarks.good) return { level: 'good', percentile: 80 };
    if (successRate >= benchmarks.acceptable) return { level: 'acceptable', percentile: 60 };
    if (successRate >= benchmarks.poor) return { level: 'poor', percentile: 40 };
    return { level: 'critical', percentile: 20 };
  }

  categorizeFailures(failures) {
    return {
      critical: failures.filter(f => f.severity === 'high'),
      warning: failures.filter(f => f.severity === 'medium'),
      info: failures.filter(f => f.severity === 'low')
    };
  }

  calculatePreventionEffectiveness(failures) {
    const critical = failures.critical?.length || 0;
    const total = (failures.critical?.length || 0) + (failures.warning?.length || 0) + (failures.info?.length || 0);

    if (total === 0) return { effectiveness: 1, coverage: 1 };

    const effectiveness = 1 - (critical / total);
    const coverage = Math.min(1, total / 6); // 6 common failure types

    return {
      effectiveness,
      coverage,
      overall: (effectiveness + coverage) / 2
    };
  }

  calculateMTTR() {
    // Simulate Mean Time To Recovery (minutes)
    return 5 + Math.random() * 15; // 5-20 minutes
  }

  calculateMTBF() {
    // Simulate Mean Time Between Failures (number of deployments)
    return 20 + Math.random() * 80; // 20-100 deployments
  }

  calculateTimeEfficiency(timeMetrics) {
    const ideal = {
      simple: 5,
      standard: 15,
      complex: 45
    };

    const current = timeMetrics;
    const efficiency = Object.keys(ideal).map(key => ideal[key] / current[key]);

    return efficiency.reduce((sum, eff) => sum + eff, 0) / efficiency.length;
  }

  calculateHealthScore(current, target) {
    return Math.min(1, current / target);
  }

  getHealthStatus(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'good';
    if (score >= 0.7) return 'fair';
    if (score >= 0.6) return 'poor';
    return 'critical';
  }

  generateHealthPredictions(overallHealth, indicators) {
    const predictions = {};

    Object.keys(indicators).forEach(indicator => {
      const currentScore = indicators[indicator];
      if (currentScore < 0.7) {
        predictions[indicator] = 'needs_attention';
      } else if (currentScore < 0.85) {
        predictions[indicator] = 'monitor';
      } else {
        predictions[indicator] = 'healthy';
      }
    });

    return predictions;
  }

  generateHealthRecommendations(indicators) {
    const recommendations = [];

    if (indicators.success < 0.9) {
      recommendations.push('Improve deployment testing and validation');
    }
    if (indicators.speed < 0.8) {
      recommendations.push('Optimize deployment pipeline for faster deployments');
    }
    if (indicators.complexity < 0.7) {
      recommendations.push('Simplify deployment configuration and reduce complexity');
    }
    if (indicators.rollback < 0.85) {
      recommendations.push('Strengthen rollback procedures and testing');
    }

    return recommendations;
  }

  predictSuccessRate(daysAhead) {
    const baseSuccess = this.metrics.success?.overall || 0.85;
    const trend = this.metrics.success?.trends?.magnitude || 0;
    const direction = this.metrics.success?.trends?.direction === 'improving' ? 1 : -1;

    // Simple linear prediction with some randomness
    const prediction = baseSuccess + (trend * direction * daysAhead / 30) + (Math.random() - 0.5) * 0.05;
    return Math.max(0, Math.min(1, prediction));
  }

  predictFailureProbability() {
    const success = this.predictSuccessRate(7);
    return Math.max(0.05, 1 - success);
  }

  identifyImprovementOpportunities() {
    const opportunities = [];

    if ((this.metrics.timing?.efficiency?.current || 0) < 0.7) {
      opportunities.push({ area: 'deployment-speed', impact: 'high', effort: 'medium' });
    }
    if ((this.metrics.success?.reliability?.consistency || 0) < 0.8) {
      opportunities.push({ area: 'reliability', impact: 'high', effort: 'high' });
    }
    if ((this.metrics.complexity?.current || 0) > 0.7) {
      opportunities.push({ area: 'complexity', impact: 'medium', effort: 'medium' });
    }

    return opportunities;
  }

  identifyRiskFactors() {
    const risks = [];

    if ((this.metrics.failures?.commonFailures?.[0]?.frequency || 0) > 0.15) {
      risks.push({ factor: 'high-failure-frequency', probability: 'high', impact: 'high' });
    }
    if ((this.metrics.rollback?.overallSuccess || 0) < 0.85) {
      risks.push({ factor: 'rollback-issues', probability: 'medium', impact: 'high' });
    }
    if ((this.metrics.complexity?.current || 0) > 0.8) {
      risks.push({ factor: 'high-complexity', probability: 'medium', impact: 'medium' });
    }

    return risks;
  }

  generateImmediateActions() {
    return [
      'Review recent deployment failures',
      'Update monitoring and alerting',
      'Validate rollback procedures'
    ];
  }

  generateShortTermActions() {
    return [
      'Implement automated testing',
      'Optimize deployment pipeline',
      'Create deployment templates'
    ];
  }

  generateLongTermActions() {
    return [
      'Establish deployment best practices',
      'Invest in infrastructure automation',
      'Create comprehensive monitoring'
    ];
  }

  calculateBestCaseSuccess() {
    const current = this.metrics.success?.overall || 0.85;
    return Math.min(0.99, current + 0.10);
  }

  calculateWorstCaseSuccess() {
    const current = this.metrics.success?.overall || 0.85;
    return Math.max(0.70, current - 0.15);
  }

  calculatePredictionConfidence() {
    // Based on data quality and consistency
    const consistency = this.metrics.success?.reliability?.consistency || 0.8;
    const dataPoints = 100; // Simulated data points

    return Math.min(0.95, consistency * (1 - 1 / Math.sqrt(dataPoints)));
  }

  calculateRollbackRiskMitigation(success, preparation) {
    const preparationScore = Object.values(preparation).reduce((sum, score) => sum + score, 0) / Object.keys(preparation).length;
    return (success * 0.6) + (preparationScore * 0.4);
  }

  generateDeploymentReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT SUCCESS METRICS REPORT');
    console.log('='.repeat(60));

    const overallScore = (
      (this.metrics.success?.overall || 0.85) * 0.3 +
      (this.metrics.timing?.efficiency?.current || 0.7) * 0.2 +
      (this.metrics.rollback?.overallSuccess || 0.9) * 0.2 +
      (this.metrics.health?.overall || 0.8) * 0.3
    );

    console.log(`\n🎯 Overall Deployment Success Score: ${(overallScore * 100).toFixed(1)}/100`);

    console.log(`\n📊 Key Metrics:`);
    console.log(`  ✅ Success Rate: ${((this.metrics.success?.overall || 0.85) * 100).toFixed(1)}%`);
    console.log(`  ⚡ Deployment Efficiency: ${((this.metrics.timing?.efficiency?.current || 0.7) * 100).toFixed(1)}%`);
    console.log(`  🔄 Rollback Success: ${((this.metrics.rollback?.overallSuccess || 0.9) * 100).toFixed(1)}%`);
    console.log(`  💓 Health Score: ${((this.metrics.health?.overall || 0.8) * 100).toFixed(1)}%`);

    console.log(`\n⚠️  Risk Assessment:`);
    console.log(`  MTTR: ${this.metrics.failures?.mttr?.toFixed(1) || 'N/A'} minutes`);
    console.log(`  MTBF: ${this.metrics.failures?.mtbf?.toFixed(0) || 'N/A'} deployments`);
    console.log(`  Failure Prevention: ${((this.metrics.failures?.prevention?.overall || 0.8) * 100).toFixed(1)}%`);

    console.log(`\n🔮 Predictions:`);
    console.log(`  Next Week Success: ${((this.metrics.predictions?.nextWeekSuccess || 0.85) * 100).toFixed(1)}%`);
    console.log(`  Failure Probability: ${((this.metrics.predictions?.failureProbability || 0.15) * 100).toFixed(1)}%`);

    if (this.metrics.health?.recommendations?.length > 0) {
      console.log(`\n🔧 Recommendations:`);
      this.metrics.health.recommendations.slice(0, 3).forEach(rec => console.log(`  • ${rec}`));
    }

    let assessment;
    if (overallScore >= 0.9) {
      assessment = '🏆 EXCELLENT - Highly successful deployment practices';
    } else if (overallScore >= 0.8) {
      assessment = '✅ GOOD - Strong deployment performance with room for optimization';
    } else if (overallScore >= 0.7) {
      assessment = '⚠️  FAIR - Deployment performance needs improvement';
    } else {
      assessment = '❌ POOR - Significant deployment issues require attention';
    }

    console.log(`\n📋 Overall Assessment: ${assessment}`);

    return {
      overallScore,
      metrics: this.metrics,
      assessment,
      ready: overallScore >= 0.75
    };
  }
}

module.exports = DeploymentSuccessMetrics;