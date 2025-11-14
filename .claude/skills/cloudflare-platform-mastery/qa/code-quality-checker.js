/**
 * Code Quality Checker - Validates code quality and best practices
 *
 * This tool analyzes Cloudflare code for quality metrics, best practices,
 * and adherence to coding standards.
 */

const fs = require('fs');
const path = require('path');

class CodeQualityChecker {
  constructor(config = {}) {
    this.config = {
      maxFileLines: 500,
      maxFunctionLines: 50,
      maxComplexity: 10,
      minTestCoverage: 80,
      ...config
    };
    this.issues = [];
    this.suggestions = [];
    this.metrics = {};
  }

  async checkCodeQuality(skillPath) {
    console.log('🔍 Running Code Quality Analysis...\n');

    await this.analyzeSkillStructure(skillPath);
    await this.analyzeCodeFiles(skillPath);
    await this.checkTestQuality(skillPath);
    await this.analyzeDocumentation(skillPath);
    await this.checkPerformancePatterns(skillPath);
    await this.validateSecurityPatterns(skillPath);

    return this.generateQualityReport();
  }

  async analyzeSkillStructure(skillPath) {
    console.log('📁 Analyzing skill structure...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      this.issues.push('Missing SKILL.md file');
      return;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check file size
    const lines = content.split('\n');
    if (lines.length > 1000) {
      this.issues.push(`SKILL.md is too long (${lines.length} lines) - consider splitting content`);
    }

    // Check for proper frontmatter
    const frontmatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
    if (!frontmatterMatch) {
      this.issues.push('Missing or invalid YAML frontmatter');
    } else {
      const frontmatter = frontmatterMatch[1];
      if (!frontmatter.includes('name:') || !frontmatter.includes('description:')) {
        this.issues.push('Frontmatter missing required fields (name, description)');
      }
    }

    this.metrics.skillSize = {
      lines: lines.length,
      words: content.split(/\s+/).length,
      characters: content.length
    };

    console.log(`  📊 SKILL.md: ${lines.length} lines, ${this.metrics.skillSize.words} words`);
  }

  async analyzeCodeFiles(skillPath) {
    console.log('\n💻 Analyzing code files...');

    const codeFiles = this.findCodeFiles(skillPath);
    let totalLines = 0;
    let totalFunctions = 0;
    let complexityIssues = 0;

    for (const filePath of codeFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(skillPath, filePath);

      console.log(`  🔍 ${relativePath}`);

      // Analyze file metrics
      const lines = content.split('\n');
      totalLines += lines.length;

      if (lines.length > this.config.maxFileLines) {
        this.issues.push(`${relativePath}: File too large (${lines.length} lines)`);
      }

      // Analyze functions
      const functions = this.extractFunctions(content, path.extname(filePath));
      totalFunctions += functions.length;

      functions.forEach(func => {
        if (func.lines > this.config.maxFunctionLines) {
          this.issues.push(`${relativePath}: Function '${func.name}' too long (${func.lines} lines)`);
        }

        if (func.complexity > this.config.maxComplexity) {
          this.issues.push(`${relativePath}: Function '${func.name}' too complex (${func.complexity})`);
          complexityIssues++;
        }
      });

      this.metrics[relativePath] = {
        lines: lines.length,
        functions: functions.length,
        complexity: functions.reduce((sum, f) => sum + f.complexity, 0)
      };
    }

    this.metrics.totalCode = {
      files: codeFiles.length,
      lines: totalLines,
      functions: totalFunctions,
      avgComplexity: totalFunctions > 0 ? complexityIssues / totalFunctions : 0
    };

    console.log(`  📊 Found ${codeFiles.length} code files, ${totalLines} lines, ${totalFunctions} functions`);
  }

  async checkTestQuality(skillPath) {
    console.log('\n🧪 Analyzing test quality...');

    const testFiles = this.findTestFiles(skillPath);
    if (testFiles.length === 0) {
      this.issues.push('No test files found - add comprehensive tests');
      return;
    }

    let totalTests = 0;
    let testLines = 0;
    let assertionCount = 0;

    for (const filePath of testFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(skillPath, filePath);

      console.log(`  🔍 ${relativePath}`);

      const lines = content.split('\n');
      testLines += lines.length;

      // Count test cases
      const testCases = content.match(/(it|test)\s*\(/g) || [];
      totalTests += testCases.length;

      // Count assertions
      const assertions = content.match(/(expect|assert|should)\./g) || [];
      assertionCount += assertions.length;

      // Check for test patterns
      if (!content.includes('describe') && !content.includes('suite')) {
        this.suggestions.push(`${relativePath}: Group tests with describe/suite blocks`);
      }

      if (!content.includes('beforeEach') && !content.includes('beforeAll')) {
        this.suggestions.push(`${relativePath}: Consider using setup/teardown hooks`);
      }
    }

    // Calculate test coverage (simplified)
    const codeFiles = this.findCodeFiles(skillPath);
    const estimatedCoverage = (testLines / (this.metrics.totalCode.lines || 1)) * 100;

    if (estimatedCoverage < this.config.minTestCoverage) {
      this.issues.push(`Low test coverage (${estimatedCoverage.toFixed(1)}%) - aim for ${this.config.minTestCoverage}%`);
    }

    this.metrics.tests = {
      files: testFiles.length,
      testCases: totalTests,
      assertions: assertionCount,
      lines: testLines,
      estimatedCoverage
    };

    console.log(`  📊 ${testFiles.length} test files, ${totalTests} test cases, ${assertionCount} assertions`);
  }

  async analyzeDocumentation(skillPath) {
    console.log('\n📚 Analyzing documentation quality...');

    const docFiles = this.findDocumentationFiles(skillPath);
    let totalDocLines = 0;
    let codeExamples = 0;

    for (const filePath of docFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(skillPath, filePath);

      console.log(`  🔍 ${relativePath}`);

      const lines = content.split('\n');
      totalDocLines += lines.length;

      // Count code examples
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      codeExamples += codeBlocks.length;

      // Check for documentation quality indicators
      if (!content.includes('#') && !relativePath.includes('README')) {
        this.suggestions.push(`${relativePath}: Add section headers for better structure`);
      }

      if (codeBlocks.length === 0 && relativePath.includes('example')) {
        this.suggestions.push(`${relativePath}: Add code examples for clarity`);
      }
    }

    this.metrics.documentation = {
      files: docFiles.length,
      lines: totalDocLines,
      codeExamples
    };

    console.log(`  📊 ${docFiles.length} documentation files, ${codeExamples} code examples`);
  }

  async checkPerformancePatterns(skillPath) {
    console.log('\n⚡ Checking performance patterns...');

    const codeFiles = this.findCodeFiles(skillPath);
    const performanceIssues = [];
    const performanceOptimizations = [];

    for (const filePath of codeFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(skillPath, filePath);

      // Check for performance anti-patterns
      if (content.includes('for (let i = 0; i <')) {
        // Check for synchronous operations in loops
        const loopWithAsync = content.match(/for\s*\(.*\)\s*{[\s\S]*?await/s);
        if (loopWithAsync) {
          performanceIssues.push(`${relativePath}: Synchronous loop with async operations - use Promise.all`);
        }
      }

      // Check for memory leaks
      const cachePattern = content.match(/cache\.set\(.*\)/g);
      const deletePattern = content.match(/cache\.delete\(/g);
      if (cachePattern && cachePattern.length > deletePattern.length) {
        performanceIssues.push(`${relativePath}: Potential memory leak - cache grows without bounds`);
      }

      // Check for optimizations
      if (content.includes('Promise.all') || content.includes('Promise.allSettled')) {
        performanceOptimizations.push(`${relativePath}: Uses parallel execution`);
      }

      if (content.includes('cache.match') || content.includes('caches.default')) {
        performanceOptimizations.push(`${relativePath}: Implements caching`);
      }
    }

    this.metrics.performance = {
      issues: performanceIssues.length,
      optimizations: performanceOptimizations.length
    };

    if (performanceIssues.length > 0) {
      this.issues.push(...performanceIssues);
    }

    console.log(`  📊 ${performanceIssues.length} performance issues, ${performanceOptimizations.length} optimizations found`);
  }

  async validateSecurityPatterns(skillPath) {
    console.log('\n🔒 Validating security patterns...');

    const codeFiles = this.findCodeFiles(skillPath);
    const securityIssues = [];
    const securityPractices = [];

    for (const filePath of codeFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(skillPath, filePath);

      // Check for hardcoded secrets
      const secretPattern = content.match(/['"]([A-Z_]*SECRET|API_KEY|TOKEN|PASSWORD)[^'"]*['"]/g);
      if (secretPattern) {
        securityIssues.push(`${relativePath}: Hardcoded secrets detected`);
      }

      // Check for input validation
      const userInputPattern = content.match(/(searchParams\.get|body\.[^;]+)/g);
      const validationPattern = content.match(/(validate|sanitize|escape)/gi);

      if (userInputPattern && !validationPattern) {
        securityIssues.push(`${relativePath}: User input without validation`);
      }

      // Check for security headers
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection'
      ];

      const hasSecurityHeaders = securityHeaders.some(header => content.includes(header));
      if (hasSecurityHeaders && content.includes('Response(')) {
        securityPractices.push(`${relativePath}: Implements security headers`);
      }

      // Check for HTTPS enforcement
      if (content.includes('Strict-Transport-Security')) {
        securityPractices.push(`${relativePath}: Enforces HTTPS`);
      }
    }

    this.metrics.security = {
      issues: securityIssues.length,
      practices: securityPractices.length
    };

    if (securityIssues.length > 0) {
      this.issues.push(...securityIssues);
    }

    console.log(`  📊 ${securityIssues.length} security issues, ${securityPractices.length} good practices`);
  }

  findCodeFiles(dir) {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs'];
    const codeFiles = [];

    const searchDir = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          searchDir(itemPath);
        } else if (stat.isFile() && codeExtensions.includes(path.extname(item))) {
          // Exclude test files
          if (!item.includes('.test.') && !item.includes('.spec.') && !item.includes('-test.')) {
            codeFiles.push(itemPath);
          }
        }
      }
    };

    searchDir(dir);
    return codeFiles;
  }

  findTestFiles(dir) {
    const testExtensions = ['.js', '.ts', '.jsx', '.tsx'];
    const testFiles = [];

    const searchDir = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          searchDir(itemPath);
        } else if (stat.isFile() && testExtensions.includes(path.extname(item))) {
          // Include test files
          if (item.includes('.test.') || item.includes('.spec.') || item.includes('-test.') || item.includes('test-')) {
            testFiles.push(itemPath);
          }
        }
      }
    };

    searchDir(dir);
    return testFiles;
  }

  findDocumentationFiles(dir) {
    const docExtensions = ['.md', '.txt', '.rst'];
    const docFiles = [];

    const searchDir = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          searchDir(itemPath);
        } else if (stat.isFile() && docExtensions.includes(path.extname(item))) {
          // Exclude README if it's the main skill file
          if (item !== 'SKILL.md') {
            docFiles.push(itemPath);
          }
        }
      }
    };

    searchDir(dir);
    return docFiles;
  }

  extractFunctions(content, extension) {
    const functions = [];

    if (['.js', '.ts', '.jsx', '.tsx'].includes(extension)) {
      // JavaScript/TypeScript function extraction
      const functionMatches = content.matchAll(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|async\s+function\s+(\w+)|(\w+)\s*=\s*async\s+function)/g);

      for (const match of functionMatches) {
        const functionName = match[1] || match[2] || match[3] || match[4];
        if (functionName) {
          const funcStart = match.index;
          const funcContent = this.extractFunctionContent(content, funcStart);

          functions.push({
            name: functionName,
            lines: funcContent.split('\n').length,
            complexity: this.calculateComplexity(funcContent)
          });
        }
      }
    }

    return functions;
  }

  extractFunctionContent(content, startIndex) {
    let braceCount = 0;
    let inFunction = false;
    let funcContent = '';

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      funcContent += char;

      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          break;
        }
      }
    }

    return funcContent;
  }

  calculateComplexity(functionContent) {
    // Simplified cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'elif', 'while', 'for', 'foreach', 'switch', 'case',
      '&&', '||', 'catch', 'throw', 'return', 'break', 'continue'
    ];

    let complexity = 1; // Base complexity

    for (const keyword of complexityKeywords) {
      const matches = functionContent.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  generateQualityReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CODE QUALITY REPORT');
    console.log('='.repeat(60));

    // Calculate overall score
    const score = this.calculateQualityScore();

    console.log(`\n🎯 Overall Quality Score: ${score}/100`);

    console.log(`\n📈 Metrics:`);
    console.log(`  📁 Code Files: ${this.metrics.totalCode?.files || 0}`);
    console.log(`  📝 Total Lines: ${this.metrics.totalCode?.lines || 0}`);
    console.log(`  🔧 Functions: ${this.metrics.totalCode?.functions || 0}`);
    console.log(`  🧪 Test Cases: ${this.metrics.tests?.testCases || 0}`);
    console.log(`  📚 Documentation: ${this.metrics.documentation?.files || 0}`);

    if (this.issues.length > 0) {
      console.log(`\n❌ Issues (${this.issues.length}):`);
      this.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (this.suggestions.length > 0) {
      console.log(`\n💡 Suggestions (${this.suggestions.length}):`);
      this.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
    }

    // Quality assessment
    let assessment;
    if (score >= 90) {
      assessment = '🏆 EXCELLENT - High-quality code following all best practices';
    } else if (score >= 80) {
      assessment = '✅ GOOD - Quality code with minor improvements needed';
    } else if (score >= 70) {
      assessment = '⚠️  FAIR - Code needs significant quality improvements';
    } else {
      assessment = '❌ POOR - Major quality issues require attention';
    }

    console.log(`\n📋 Assessment: ${assessment}`);

    return {
      score,
      metrics: this.metrics,
      issues: this.issues,
      suggestions: this.suggestions,
      assessment,
      ready: score >= 75
    };
  }

  calculateQualityScore() {
    let score = 100;

    // Deduct points for issues
    score -= this.issues.length * 5;

    // Deduct points for suggestions (less severe)
    score -= this.suggestions.length * 2;

    // Bonus points for good metrics
    if (this.metrics.tests?.estimatedCoverage >= 80) {
      score += 10;
    }

    if (this.metrics.performance?.optimimizations > 0) {
      score += 5;
    }

    if (this.metrics.security?.practices > 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// CLI interface
if (require.main === module) {
  const skillPath = process.argv[2] || process.cwd();
  const config = {
    maxFileLines: parseInt(process.argv[3]) || 500,
    maxFunctionLines: parseInt(process.argv[4]) || 50,
    maxComplexity: parseInt(process.argv[5]) || 10
  };

  const checker = new CodeQualityChecker(config);

  checker.checkCodeQuality(skillPath)
    .then(report => {
      process.exit(report.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('Code quality check failed:', error);
      process.exit(1);
    });
}

module.exports = CodeQualityChecker;