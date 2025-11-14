/**
 * Skill Validator - Validates Cloudflare skill completeness and accuracy
 *
 * This validator ensures the skill meets all quality standards and contains
 * all necessary components for effective Cloudflare platform mastery.
 */

const fs = require('fs');
const path = require('path');

class SkillValidator {
  constructor(skillPath) {
    this.skillPath = skillPath;
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
  }

  async validate() {
    console.log('🔍 Validating Cloudflare Platform Mastery Skill...\n');

    // Core validation checks
    await this.validateSkillStructure();
    await this.validateRequiredSections();
    await this.validateCodeExamples();
    await this.validateDependencies();
    await this.validateQualityStandards();
    await this.validateDocumentation();

    return this.generateReport();
  }

  async validateSkillStructure() {
    console.log('📁 Checking skill structure...');

    const requiredDirs = [
      'validation',
      'tests/unit-tests',
      'tests/integration-tests',
      'tests/performance-tests',
      'tests/security-tests',
      'qa',
      'scenarios',
      'metrics',
      'ci'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(this.skillPath, dir);
      if (!fs.existsSync(dirPath)) {
        this.issues.push(`Missing required directory: ${dir}`);
      } else {
        console.log(`  ✅ ${dir}`);
      }
    }

    const requiredFiles = [
      'SKILL.md',
      'validation/skill-validator.js',
      'validation/scenario-tester.js',
      'validation/integration-validator.js',
      'validation/user-experience-tester.js',
      'qa/code-quality-checker.js',
      'qa/documentation-validator.js',
      'scenarios/basic-deployment-scenario.js',
      'ci/github-actions-workflow.yml'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.skillPath, file);
      if (!fs.existsSync(filePath)) {
        this.issues.push(`Missing required file: ${file}`);
      } else {
        console.log(`  ✅ ${file}`);
      }
    }
  }

  async validateRequiredSections() {
    console.log('\n📋 Checking required sections...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      this.issues.push('SKILL.md not found');
      return;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    const requiredSections = [
      '## Overview',
      '## When to Use',
      '## Quick Reference',
      '## Implementation',
      '## Common Mistakes',
      '## Advanced Patterns',
      '## Integration Examples',
      '## Performance Considerations',
      '## Security Best Practices'
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        this.issues.push(`Missing required section: ${section}`);
      } else {
        console.log(`  ✅ ${section}`);
      }
    }

    // Check for YAML frontmatter
    if (!content.match(/^---\s*\n.*?\n---\s*\n/s)) {
      this.issues.push('Missing or invalid YAML frontmatter');
    } else {
      console.log('  ✅ YAML frontmatter');
    }
  }

  async validateCodeExamples() {
    console.log('\n💻 Validating code examples...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Extract code blocks
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

    if (codeBlocks.length === 0) {
      this.warnings.push('No code examples found');
      return;
    }

    console.log(`  Found ${codeBlocks.length} code blocks`);

    // Validate each code block
    codeBlocks.forEach((block, index) => {
      const lines = block.split('\n');
      const language = lines[0].replace('```', '').trim();

      if (!language) {
        this.warnings.push(`Code block ${index + 1} missing language specification`);
      } else {
        console.log(`  ✅ Code block ${index + 1}: ${language}`);
      }

      // Check for common Cloudflare APIs and patterns
      const blockContent = block.toLowerCase();
      const cloudflarePatterns = [
        'cloudflare',
        'workers',
        'pages',
        'r2',
        'd1',
        'kv',
        'wrangler',
        'api_token',
        'zone_id'
      ];

      const hasCloudflareContent = cloudflarePatterns.some(pattern =>
        blockContent.includes(pattern)
      );

      if (!hasCloudflareContent && language !== 'yaml') {
        this.warnings.push(`Code block ${index + 1} may not contain Cloudflare-specific content`);
      }
    });
  }

  async validateDependencies() {
    console.log('\n🔗 Checking dependencies...');

    const packageJsonPath = path.join(this.skillPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        const cloudflareDeps = [
          '@cloudflare/workers-types',
          'wrangler',
          '@cloudflare/kv-asset-handler',
          'cloudflare:workers'
        ];

        const hasCloudflareDeps = Object.keys(deps).some(dep =>
          cloudflareDeps.some(cfDep => dep.includes(cfDep.toLowerCase()))
        );

        if (hasCloudflareDeps) {
          console.log('  ✅ Cloudflare dependencies found');
        } else {
          this.warnings.push('No Cloudflare-specific dependencies found');
        }

        console.log(`  ✅ Found ${Object.keys(deps).length} dependencies`);
      } catch (error) {
        this.issues.push('Invalid package.json format');
      }
    } else {
      this.warnings.push('No package.json found - consider adding for dependency management');
    }
  }

  async validateQualityStandards() {
    console.log('\n⭐ Checking quality standards...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Word count check
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 2000) {
      this.warnings.push(`Skill is quite long (${wordCount} words) - consider condensing`);
    }
    console.log(`  ✅ Word count: ${wordCount}`);

    // Searchability check
    const searchTerms = [
      'Cloudflare', 'Workers', 'Pages', 'R2', 'D1', 'KV', 'Wrangler',
      'deployment', 'performance', 'security', 'cdn', 'edge',
      'serverless', 'function', 'api', 'zone'
    ];

    const foundSearchTerms = searchTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );

    console.log(`  ✅ Searchable terms: ${foundSearchTerms.length}/${searchTerms.length}`);

    if (foundSearchTerms.length < searchTermsTerms.length * 0.7) {
      this.suggestions.push('Add more Cloudflare-specific search terms for better discoverability');
    }

    // Accessibility check
    if (content.includes('```') && !content.includes('## Quick Reference')) {
      this.suggestions.push('Consider adding a Quick Reference table for better accessibility');
    }
  }

  async validateDocumentation() {
    console.log('\n📚 Validating documentation quality...');

    // Check for README
    const readmePath = path.join(this.skillPath, 'README.md');
    if (fs.existsSync(readmePath)) {
      console.log('  ✅ README.md found');
    } else {
      this.suggestions.push('Consider adding README.md for skill overview');
    }

    // Check test coverage
    const testDirs = [
      'tests/unit-tests',
      'tests/integration-tests',
      'tests/performance-tests'
    ];

    let testCount = 0;
    testDirs.forEach(testDir => {
      const dirPath = path.join(this.skillPath, testDir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(f =>
          f.endsWith('.js') || f.endsWith('.test.js') || f.endsWith('.spec.js')
        );
        testCount += files.length;
      }
    });

    console.log(`  ✅ Found ${testCount} test files`);

    if (testCount === 0) {
      this.issues.push('No test files found - skill must have comprehensive testing');
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(60));

    console.log(`\n❌ Issues (${this.issues.length}):`);
    if (this.issues.length === 0) {
      console.log('  ✅ No critical issues found');
    } else {
      this.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
    if (this.warnings.length === 0) {
      console.log('  ✅ No warnings');
    } else {
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log(`\n💡 Suggestions (${this.suggestions.length}):`);
    if (this.suggestions.length === 0) {
      console.log('  ✅ No suggestions');
    } else {
      this.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
    }

    const score = Math.max(0, 100 - (this.issues.length * 10) - (this.warnings.length * 5));
    console.log(`\n🎯 Overall Skill Score: ${score}/100`);

    if (score >= 90) {
      console.log('🏆 EXCELLENT - Skill is ready for production');
    } else if (score >= 80) {
      console.log('✅ GOOD - Skill needs minor improvements');
    } else if (score >= 70) {
      console.log('⚠️  FAIR - Skill needs significant improvements');
    } else {
      console.log('❌ POOR - Skill requires major revisions');
    }

    return {
      score,
      issues: this.issues,
      warnings: this.warnings,
      suggestions: this.suggestions,
      ready: score >= 80
    };
  }
}

// CLI interface
if (require.main === module) {
  const skillPath = process.argv[2] || process.cwd();
  const validator = new SkillValidator(skillPath);

  validator.validate()
    .then(report => {
      process.exit(report.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = SkillValidator;