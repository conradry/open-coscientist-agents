#!/usr/bin/env node

/**
 * Coverage Reporter - Code coverage and testing completeness reporter
 *
 * This script analyzes test coverage and generates detailed reports
 * on testing completeness across the skill components.
 */

const fs = require('fs');
const path = require('path');

class CoverageReporter {
  constructor(config = {}) {
    this.config = {
      skillPath: process.cwd(),
      outputDir: path.join(process.cwd(), 'coverage-reports'),
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      },
      ...config
    };
    this.coverageData = {};
    this.completenessMetrics = {};
  }

  async generateReport() {
    console.log('📊 Generating Coverage and Completeness Report...\n');

    try {
      await this.analyzeTestCoverage();
      await this.analyzeFileCoverage();
      await this.analyzeScenarioCoverage();
      await this.analyzeDocumentationCoverage();
      await this.analyzeIntegrationCoverage();
      await this.calculateOverallCoverage();
      await this.generateCoverageReport();

      return this.coverageData;
    } catch (error) {
      console.error('❌ Coverage reporting failed:', error.message);
      throw error;
    }
  }

  async analyzeTestCoverage() {
    console.log('1️⃣ Analyzing Test Coverage...');

    // Find test files and corresponding source files
    const testFiles = this.findFiles(this.config.skillPath, /\.test\.js$/);
    const sourceFiles = this.findSourceFiles(this.config.skillPath);

    // Map tests to source files
    const coverageMap = this.createCoverageMap(testFiles, sourceFiles);

    // Calculate coverage metrics
    const coverageMetrics = {
      totalFiles: sourceFiles.length,
      testedFiles: coverageMap.size,
      untestedFiles: sourceFiles.length - coverageMap.size,
      fileCoverage: this.calculateFileCoverage(coverageMap),
      testDistribution: this.analyzeTestDistribution(testFiles),
      coverageByType: this.analyzeCoverageByType(testFiles)
    };

    this.coverageData.testCoverage = coverageMetrics;

    console.log(`  📁 Total files: ${coverageMetrics.totalFiles}`);
    console.log(`  ✅ Tested files: ${coverageMetrics.testedFiles}`);
    console.log(`  ❌ Untested files: ${coverageMetrics.untestedFiles}`);
    console.log(`  📈 Coverage: ${((coverageMetrics.testedFiles / coverageMetrics.totalFiles) * 100).toFixed(1)}%`);
  }

  async analyzeFileCoverage() {
    console.log('\n2️⃣ Analyzing File Coverage...');

    const directories = ['validation', 'tests', 'qa', 'scenarios', 'metrics', 'ci'];
    const coverageByDirectory = {};

    for (const dir of directories) {
      const dirPath = path.join(this.config.skillPath, dir);
      if (fs.existsSync(dirPath)) {
        const files = this.findFiles(dirPath, /\.js$/);
        const testFiles = files.filter(file => file.includes('.test.') || file.includes('-test.'));
        const sourceFiles = files.filter(file => !file.includes('.test.') && !file.includes('-test.'));

        coverageByDirectory[dir] = {
          total: files.length,
          tests: testFiles.length,
          source: sourceFiles.length,
          coverage: sourceFiles.length > 0 ? (testFiles.length / (testFiles.length + sourceFiles.length)) * 100 : 0
        };

        console.log(`  📂 ${dir}: ${coverageByDirectory[dir].coverage.toFixed(1)}% coverage`);
      }
    }

    this.coverageData.fileCoverage = coverageByDirectory;
  }

  async analyzeScenarioCoverage() {
    console.log('\n3️⃣ Analyzing Scenario Coverage...');

    const scenariosDir = path.join(this.config.skillPath, 'scenarios');
    if (!fs.existsSync(scenariosDir)) {
      console.log('  ⚠️  No scenarios directory found');
      return;
    }

    const scenarioFiles = this.findFiles(scenariosDir, /-scenario\.js$/);
    const expectedScenarios = [
      'basic-deployment',
      'enterprise-migration',
      'performance-optimization',
      'disaster-recovery',
      'security-hardening',
      'multi-environment'
    ];

    const scenarioCoverage = {
      total: scenarioFiles.length,
      expected: expectedScenarios.length,
      covered: 0,
      missing: [],
      categories: {
        deployment: 0,
        performance: 0,
        security: 0,
        reliability: 0
      }
    };

    // Check which scenarios are covered
    scenarioFiles.forEach(file => {
      const fileName = path.basename(file, '-scenario.js');
      if (expectedScenarios.includes(fileName)) {
        scenarioCoverage.covered++;
      }

      // Categorize scenarios
      if (file.includes('deployment') || file.includes('migration')) {
        scenarioCoverage.categories.deployment++;
      }
      if (file.includes('performance') || file.includes('optimization')) {
        scenarioCoverage.categories.performance++;
      }
      if (file.includes('security') || file.includes('hardening')) {
        scenarioCoverage.categories.security++;
      }
      if (file.includes('disaster') || file.includes('recovery')) {
        scenarioCoverage.categories.reliability++;
      }
    });

    // Identify missing scenarios
    expectedScenarios.forEach(scenario => {
      const hasScenario = scenarioFiles.some(file => file.includes(scenario));
      if (!hasScenario) {
        scenarioCoverage.missing.push(scenario);
      }
    });

    this.coverageData.scenarioCoverage = scenarioCoverage;

    console.log(`  📊 Scenarios covered: ${scenarioCoverage.covered}/${scenarioCoverage.expected}`);
    console.log(`    • Deployment: ${scenarioCoverage.categories.deployment}`);
    console.log(`    • Performance: ${scenarioCoverage.categories.performance}`);
    console.log(`    • Security: ${scenarioCoverage.categories.security}`);
    console.log(`    • Reliability: ${scenarioCoverage.categories.reliability}`);

    if (scenarioCoverage.missing.length > 0) {
      console.log(`    ❌ Missing: ${scenarioCoverage.missing.join(', ')}`);
    }
  }

  async analyzeDocumentationCoverage() {
    console.log('\n4️⃣ Analyzing Documentation Coverage...');

    const documentationMetrics = {
      hasMainDocumentation: false,
      hasExamples: false,
      hasApiDocs: false,
      hasTroubleshooting: false,
      hasQuickReference: false,
      hasContributing: false,
      completenessScore: 0
    };

    // Check main documentation
    const skillMdPath = path.join(this.config.skillPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      documentationMetrics.hasMainDocumentation = true;
      const content = fs.readFileSync(skillMdPath, 'utf8');

      // Check for documentation sections
      if (content.includes('## Examples') || content.match(/```[\s\S]*?```/g)?.length >= 3) {
        documentationMetrics.hasExamples = true;
      }
      if (content.includes('API') || content.includes('endpoint')) {
        documentationMetrics.hasApiDocs = true;
      }
      if (content.includes('Troubleshoot') || content.includes('Common Issues')) {
        documentationMetrics.hasTroubleshooting = true;
      }
      if (content.includes('Quick Reference') || content.includes('Cheat Sheet')) {
        documentationMetrics.hasQuickReference = true;
      }
    }

    // Check for additional documentation files
    const additionalDocs = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE'];
    for (const doc of additionalDocs) {
      if (fs.existsSync(path.join(this.config.skillPath, doc))) {
        if (doc === 'CONTRIBUTING.md') {
          documentationMetrics.hasContributing = true;
        }
      }
    }

    // Calculate completeness score
    const checks = [
      documentationMetrics.hasMainDocumentation,
      documentationMetrics.hasExamples,
      documentationMetrics.hasApiDocs,
      documentationMetrics.hasTroubleshooting,
      documentationMetrics.hasQuickReference,
      documentationMetrics.hasContributing
    ];

    documentationMetrics.completenessScore = (checks.filter(Boolean).length / checks.length) * 100;

    this.coverageData.documentationCoverage = documentationMetrics;

    console.log(`  📚 Documentation completeness: ${documentationMetrics.completenessScore.toFixed(1)}%`);
    console.log(`    ✅ Main docs: ${documentationMetrics.hasMainDocumentation ? 'Yes' : 'No'}`);
    console.log(`    💻 Examples: ${documentationMetrics.hasExamples ? 'Yes' : 'No'}`);
    console.log(`    🔧 Troubleshooting: ${documentationMetrics.hasTroubleshooting ? 'Yes' : 'No'}`);
    console.log(`    📋 Quick reference: ${documentationMetrics.hasQuickReference ? 'Yes' : 'No'}`);
  }

  async analyzeIntegrationCoverage() {
    console.log('\n5️⃣ Analyzing Integration Coverage...');

    const integrationMetrics = {
      hasGitHubActions: false,
      hasCICD: false,
      hasMonitoring: false,
      hasAlerting: false,
      hasHealthChecks: false,
      crossSkillReferences: 0,
      externalIntegrations: 0
    };

    // Check for CI/CD files
    const ciDir = path.join(this.config.skillPath, 'ci');
    if (fs.existsSync(ciDir)) {
      const ciFiles = this.findFiles(ciDir, /\.yml$/);
      if (ciFiles.some(file => file.includes('github-actions'))) {
        integrationMetrics.hasGitHubActions = true;
        integrationMetrics.hasCICD = true;
      }
    }

    // Check for monitoring and alerting
    const qaDir = path.join(this.config.skillPath, 'qa');
    if (fs.existsSync(qaDir)) {
      const qaFiles = this.findFiles(qaDir, /\.js$/);
      if (qaFiles.some(file => file.includes('monitor') || file.includes('health'))) {
        integrationMetrics.hasMonitoring = true;
      }
      if (qaFiles.some(file => file.includes('alert'))) {
        integrationMetrics.hasAlerting = true;
      }
    }

    // Analyze skill references in main documentation
    const skillMdPath = path.join(this.config.skillPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf8');

      // Count cross-skill references
      const skillRefs = content.match(/[a-z][a-z0-9-]*:[a-z0-9-]+/g) || [];
      integrationMetrics.crossSkillReferences = skillRefs.length;

      // Look for external service integrations
      const externalServices = [
        'github', 'slack', 'discord', 'webhook', 'api', 'database',
        'redis', 'aws', 'azure', 'google', 'docker', 'kubernetes'
      ];

      externalServices.forEach(service => {
        if (content.toLowerCase().includes(service)) {
          integrationMetrics.externalIntegrations++;
        }
      });
    }

    // Calculate integration score
    const integrationChecks = [
      integrationMetrics.hasGitHubActions,
      integrationMetrics.hasCICD,
      integrationMetrics.hasMonitoring,
      integrationMetrics.hasAlerting,
      integrationMetrics.crossSkillReferences > 0,
      integrationMetrics.externalIntegrations > 0
    ];

    const integrationScore = (integrationChecks.filter(Boolean).length / integrationChecks.length) * 100;

    this.coverageData.integrationCoverage = {
      ...integrationMetrics,
      score: integrationScore
    };

    console.log(`  🔗 Integration coverage: ${integrationScore.toFixed(1)}%`);
    console.log(`    🚀 CI/CD: ${integrationMetrics.hasCICD ? 'Yes' : 'No'}`);
    console.log(`    📊 Monitoring: ${integrationMetrics.hasMonitoring ? 'Yes' : 'No'}`);
    console.log(`    🔔 Alerting: ${integrationMetrics.hasAlerting ? 'Yes' : 'No'}`);
    console.log(`    🔗 Cross-skill refs: ${integrationMetrics.crossSkillReferences}`);
    console.log(`    🌐 External integrations: ${integrationMetrics.externalIntegrations}`);
  }

  async calculateOverallCoverage() {
    console.log('\n6️⃣ Calculating Overall Coverage...');

    const weights = {
      testCoverage: 0.35,
      fileCoverage: 0.20,
      scenarioCoverage: 0.20,
      documentationCoverage: 0.15,
      integrationCoverage: 0.10
    };

    const scores = {
      testCoverage: this.coverageData.testCoverage?.fileCoverage?.coverage || 0,
      fileCoverage: this.calculateAverageFileCoverage(),
      scenarioCoverage: (this.coverageData.scenarioCoverage?.covered || 0) / Math.max(1, this.coverageData.scenarioCoverage?.expected || 1) * 100,
      documentationCoverage: this.coverageData.documentationCoverage?.completenessScore || 0,
      integrationCoverage: this.coverageData.integrationCoverage?.score || 0
    };

    const overallScore = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (scores[key] * weight);
    }, 0);

    // Determine coverage level
    let coverageLevel;
    if (overallScore >= 90) {
      coverageLevel = 'excellent';
    } else if (overallScore >= 80) {
      coverageLevel = 'good';
    } else if (overallScore >= 70) {
      coverageLevel = 'acceptable';
    } else if (overallScore >= 50) {
      coverageLevel = 'needs-improvement';
    } else {
      coverageLevel = 'poor';
    }

    this.coverageData.overall = {
      score: overallScore,
      level: coverageLevel,
      weights,
      componentScores: scores,
      recommendations: this.generateCoverageRecommendations(scores)
    };

    console.log(`  🎯 Overall coverage: ${overallScore.toFixed(1)}%`);
    console.log(`  📊 Coverage level: ${coverageLevel}`);
  }

  async generateCoverageReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COVERAGE AND COMPLETENESS REPORT');
    console.log('='.repeat(60));

    const { overall } = this.coverageData;

    console.log(`\n🎯 Overall Coverage: ${overall.score.toFixed(1)}%`);
    console.log(`📊 Coverage Level: ${overall.level.toUpperCase()}`);

    console.log(`\n📂 Component Coverage:`);
    console.log(`  🧪 Tests: ${overall.componentScores.testCoverage.toFixed(1)}%`);
    console.log(`  📁 Files: ${overall.componentScores.fileCoverage.toFixed(1)}%`);
    console.log(`  🎭 Scenarios: ${overall.componentScores.scenarioCoverage.toFixed(1)}%`);
    console.log(`  📚 Documentation: ${overall.componentScores.documentationCoverage.toFixed(1)}%`);
    console.log(`  🔗 Integrations: ${overall.componentScores.integrationCoverage.toFixed(1)}%`);

    // Threshold comparison
    console.log(`\n📏 Threshold Comparison:`);
    Object.entries(this.config.thresholds).forEach(([metric, threshold]) => {
      const score = this.coverageData[metric] || 0;
      const status = score >= threshold ? '✅' : '❌';
      console.log(`  ${status} ${metric}: ${score.toFixed(1)}% (target: ${threshold}%)`);
    });

    if (overall.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      overall.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Save detailed report
    await this.saveCoverageReport();

    console.log(`\n📄 Detailed report saved to coverage-reports/`);

    return this.coverageData;
  }

  findFiles(dir, pattern) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const searchDir = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);

        for (const item of items) {
          const itemPath = path.join(currentDir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            searchDir(itemPath);
          } else if (stat.isFile() && pattern.test(item)) {
            files.push(itemPath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    searchDir(dir);
    return files;
  }

  findSourceFiles(skillPath) {
    const sourcePatterns = [
      /\.(js|ts|jsx|tsx)$/,
      /\.(py|go|rs)$/
    ];

    const sourceFiles = [];

    const searchDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          searchDir(itemPath);
        } else if (stat.isFile()) {
          const isSource = sourcePatterns.some(pattern => pattern.test(item));
          const isNotTest = !item.includes('.test.') && !item.includes('-test.') && !item.includes('spec.');
          if (isSource && isNotTest) {
            sourceFiles.push(itemPath);
          }
        }
      }
    };

    searchDir(skillPath);
    return sourceFiles;
  }

  createCoverageMap(testFiles, sourceFiles) {
    const coverageMap = new Map();

    testFiles.forEach(testFile => {
      const testName = path.basename(testFile).replace(/\.test\.js$/, '').replace(/-test\.js$/, '');

      // Find corresponding source file
      const sourceFile = sourceFiles.find(file => {
        const fileName = path.basename(file, path.extname(file));
        return fileName === testName || fileName.includes(testName);
      });

      if (sourceFile) {
        coverageMap.set(sourceFile, testFile);
      }
    });

    return coverageMap;
  }

  calculateFileCoverage(coverageMap) {
    const sourceFiles = this.findSourceFiles(this.config.skillPath);
    const coverageByType = {
      validation: { total: 0, covered: 0 },
      tests: { total: 0, covered: 0 },
      qa: { total: 0, covered: 0 },
      scenarios: { total: 0, covered: 0 },
      metrics: { total: 0, covered: 0 },
      ci: { total: 0, covered: 0 }
    };

    sourceFiles.forEach(file => {
      const relativePath = path.relative(this.config.skillPath, file);
      const dirName = path.dirname(relativePath).split(path.sep)[0];

      if (coverageByType[dirName]) {
        coverageByType[dirName].total++;
        if (coverageMap.has(file)) {
          coverageByType[dirName].covered++;
        }
      }
    });

    return coverageByType;
  }

  analyzeTestDistribution(testFiles) {
    const distribution = {
      unit: 0,
      integration: 0,
      performance: 0,
      security: 0,
      e2e: 0
    };

    testFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();

      if (file.includes('unit') || content.includes('describe(')) {
        distribution.unit++;
      }
      if (file.includes('integration') || content.includes('fetch(') || content.includes('api')) {
        distribution.integration++;
      }
      if (file.includes('performance') || content.includes('benchmark') || content.includes('speed')) {
        distribution.performance++;
      }
      if (file.includes('security') || content.includes('auth') || content.includes('vulnerabil')) {
        distribution.security++;
      }
      if (file.includes('e2e') || content.includes('scenario') || content.includes('workflow')) {
        distribution.e2e++;
      }
    });

    return distribution;
  }

  analyzeCoverageByType(testFiles) {
    const typeCoverage = {};

    const testTypes = [
      'validation',
      'unit-tests',
      'integration-tests',
      'performance-tests',
      'security-tests'
    ];

    testTypes.forEach(type => {
      const typeTests = testFiles.filter(file => file.includes(type));
      const sourceFiles = this.findFiles(path.join(this.config.skillPath, type), /\.(js|ts)$/);

      typeCoverage[type] = {
        tests: typeTests.length,
        source: sourceFiles.filter(file => !file.includes('.test.') && !file.includes('-test.')).length,
        coverage: sourceFiles.length > 0 ? (typeTests.length / sourceFiles.length) * 100 : 0
      };
    });

    return typeCoverage;
  }

  calculateAverageFileCoverage() {
    const fileCoverage = this.coverageData.fileCoverage;
    if (!fileCoverage) return 0;

    const coverages = Object.values(fileCoverage)
      .map(dir => dir.cover || 0)
      .filter(coverage => coverage > 0);

    return coverages.length > 0 ? coverages.reduce((sum, cov) => sum + cov, 0) / coverages.length : 0;
  }

  generateCoverageRecommendations(scores) {
    const recommendations = [];

    if (scores.testCoverage < 80) {
      recommendations.push('Increase test coverage to at least 80%');
    }
    if (scores.fileCoverage < 70) {
      recommendations.push('Add tests for uncovered files and directories');
    }
    if (scores.scenarioCoverage < 75) {
      recommendations.push('Expand scenario coverage to include more use cases');
    }
    if (scores.documentationCoverage < 85) {
      recommendations.push('Enhance documentation with examples and troubleshooting guides');
    }
    if (scores.integrationCoverage < 70) {
      recommendations.push('Improve CI/CD integration and monitoring setup');
    }

    // Priority recommendations
    const lowestScore = Math.min(...Object.values(scores));
    if (lowestScore < 50) {
      recommendations.unshift('Address critical coverage gaps immediately');
    }

    return recommendations;
  }

  async saveCoverageReport() {
    const outputDir = this.config.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON report
    const jsonFile = path.join(outputDir, 'coverage-report.json');
    fs.writeFileSync(jsonFile, JSON.stringify(this.coverageData, null, 2));

    // Save HTML report
    const htmlFile = path.join(outputDir, 'coverage-report.html');
    const htmlContent = this.generateHTMLReport();
    fs.writeFileSync(htmlFile, htmlContent);

    // Save summary report
    const summaryFile = path.join(outputDir, 'coverage-summary.md');
    const markdownContent = this.generateMarkdownSummary();
    fs.writeFileSync(summaryFile, markdownContent);
  }

  generateHTMLReport() {
    const { overall } = this.coverageData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Cloudflare Platform Mastery</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px 8px 0 0; }
        .content { padding: 2rem; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .metric { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .progress { background: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden; margin: 1rem 0; }
        .progress-bar { background: #28a745; height: 100%; transition: width 0.3s ease; }
        .thresholds { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
        .threshold { padding: 1rem; border-left: 4px solid #28a745; background: #f8f9fa; }
        .threshold.failed { border-left-color: #dc3545; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 1.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Coverage Report</h1>
            <p>Cloudflare Platform Mastery Skill</p>
        </div>
        <div class="content">
            <h2>Overall Coverage</h2>
            <div class="metric-value">${overall.score.toFixed(1)}%</div>
            <div class="progress">
                <div class="progress-bar" style="width: ${overall.score}%"></div>
            </div>
            <p>Coverage Level: <strong>${overall.level.toUpperCase()}</strong></p>

            <h3>Component Breakdown</h3>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-value">${overall.componentScores.testCoverage.toFixed(1)}%</div>
                    <div>Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${overall.componentScores.fileCoverage.toFixed(1)}%</div>
                    <div>Files</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${overall.componentScores.scenarioCoverage.toFixed(1)}%</div>
                    <div>Scenarios</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${overall.componentScores.documentationCoverage.toFixed(1)}%</div>
                    <div>Documentation</div>
                </div>
            </div>

            <h3>Threshold Comparison</h3>
            <div class="thresholds">
                ${Object.entries(this.config.thresholds).map(([metric, threshold]) => {
                  const score = this.coverageData[metric] || 0;
                  const passed = score >= threshold;
                  return `
                    <div class="threshold ${passed ? '' : 'failed'}">
                        <strong>${metric}</strong><br>
                        ${score.toFixed(1)}% / ${threshold}%<br>
                        ${passed ? '✅ Pass' : '❌ Fail'}
                    </div>
                  `;
                }).join('')}
            </div>

            <h3>Recommendations</h3>
            <div class="recommendations">
                <h4>💡 Areas for Improvement:</h4>
                <ul>
                    ${overall.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateMarkdownSummary() {
    const { overall } = this.coverageData;

    return `# Coverage Report

## Overall Coverage: ${overall.score.toFixed(1)}% (${overall.level.toUpperCase()})

### Component Coverage
- **Tests**: ${overall.componentScores.testCoverage.toFixed(1)}%
- **Files**: ${overall.componentScores.fileCoverage.toFixed(1)}%
- **Scenarios**: ${overall.componentScores.scenarioCoverage.toFixed(1)}%
- **Documentation**: ${overall.componentScores.documentationCoverage.toFixed(1)}%
- **Integrations**: ${overall.componentScores.integrationCoverage.toFixed(1)}%

### Threshold Comparison
${Object.entries(this.config.thresholds).map(([metric, threshold]) => {
  const score = this.coverageData[metric] || 0;
  const status = score >= threshold ? '✅' : '❌';
  return `- ${status} ${metric}: ${score.toFixed(1)}% (target: ${threshold}%)`;
}).join('\n')}

### Recommendations
${overall.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

---
*Report generated on ${new Date().toISOString()}*
    `;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--skill-path' && i + 1 < args.length) {
      config.skillPath = args[i + 1];
      i++;
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      config.outputDir = args[i + 1];
      i++;
    } else if (arg.startsWith('--threshold-') && i + 1 < args.length) {
      const metric = arg.replace('--threshold-', '');
      config.thresholds = config.thresholds || {};
      config.thresholds[metric] = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Coverage Reporter - Analyze test coverage and completeness

Usage: node coverage-reporter.js [options]

Options:
  --skill-path <path>     Path to the skill directory (default: current directory)
  --output-dir <path>     Output directory for reports (default: ./coverage-reports)
  --threshold-<metric> <value>  Set threshold for coverage metric
  --help, -h              Show this help message

Examples:
  node coverage-reporter.js
  node coverage-reporter.js --skill-path /path/to/skill --threshold-statements 85
      `);
      process.exit(0);
    }
  }

  const reporter = new CoverageReporter(config);

  reporter.generateReport()
    .then(() => {
      console.log('\n✅ Coverage report generated successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Coverage reporting failed:', error.message);
      process.exit(1);
    });
}

module.exports = CoverageReporter;