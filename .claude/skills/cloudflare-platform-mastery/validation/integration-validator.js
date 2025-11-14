/**
 * Integration Validator - Validates Cloudflare skill integration with other skills
 *
 * This validator ensures the Cloudflare skill works well with other skills
 * in the ecosystem and follows integration best practices.
 */

const fs = require('fs');
const path = require('path');

class IntegrationValidator {
  constructor(skillPath) {
    this.skillPath = skillPath;
    this.integrationResults = [];
    this.conflicts = [];
    this.synergies = [];
  }

  async validateIntegrations() {
    console.log('🔗 Validating Cloudflare Skill Integrations...\n');

    await this.validateSkillDependencies();
    await this.validateCrossSkillReferences();
    await this.validateWorkflowIntegration();
    await this.validateToolCompatibility();
    await this.validateMemoryCoordination();
    await this.validateSwarmIntegration();

    return this.generateIntegrationReport();
  }

  async validateSkillDependencies() {
    console.log('🔍 Checking skill dependencies...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      console.log('  ❌ SKILL.md not found');
      return;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for required background skills
    const requiredSkills = [
      'using-superpowers',
      'test-driven-development',
      'writing-skills',
      'verification-before-completion'
    ];

    const foundReferences = requiredSkills.filter(skill =>
      content.includes(skill)
    );

    console.log(`  ✅ References ${foundReferences.length}/${requiredSkills.length} required skills`);

    if (foundReferences.length < requiredSkills.length * 0.5) {
      this.conflicts.push('Insufficient references to prerequisite skills');
    }

    // Check for optional but useful skill references
    const optionalSkills = [
      'github-workflow-automation',
      'performance-analysis',
      'systematic-debugging',
      'security-analysis'
    ];

    const foundOptional = optionalSkills.filter(skill =>
      content.includes(skill)
    );

    console.log(`  ✅ References ${foundOptional.length}/${optionalSkills.length} optional skills`);

    this.integrationResults.push({
      type: 'dependencies',
      status: foundReferences.length >= 2 ? 'passed' : 'warning',
      details: {
        required: foundReferences.length,
        optional: foundOptional.length
      }
    });
  }

  async validateCrossSkillReferences() {
    console.log('\n📚 Validating cross-skill references...');

    // Find other skills in the ecosystem
    const skillsDir = path.dirname(path.dirname(this.skillPath));
    const allSkills = fs.readdirSync(skillsDir)
      .filter(item => {
        const itemPath = path.join(skillsDir, item);
        return fs.statSync(itemPath).isDirectory() &&
               fs.existsSync(path.join(itemPath, 'SKILL.md'));
      });

    console.log(`  Found ${allSkills.length} skills in ecosystem`);

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for proper cross-reference format
    const crossRefPattern = /\*\*(?:REQUIRED|OPTIONAL|RECOMMENDED)[\s\S]*?\*.*Use.*:[?\s]*(\w[-\w]*)/g;
    const matches = content.match(crossRefPattern) || [];

    console.log(`  ✅ Found ${matches.length} properly formatted cross-references`);

    // Check for @ syntax violations
    const atSyntaxMatches = content.match(/@\w[-\w]*/g) || [];
    if (atSyntaxMatches.length > 0) {
      this.conflicts.push(`Found ${atSyntaxMatches.length} @ syntax references (should use skill names only)`);
      console.log(`  ⚠️  Found ${atSyntaxMatches.length} problematic @ syntax references`);
    } else {
      console.log('  ✅ No problematic @ syntax references');
    }

    this.integrationResults.push({
      type: 'cross-references',
      status: atSyntaxMatches.length === 0 ? 'passed' : 'warning',
      details: {
        properReferences: matches.length,
        atSyntaxViolations: atSyntaxMatches.length
      }
    });
  }

  async validateWorkflowIntegration() {
    console.log('\n⚙️  Validating workflow integration...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for workflow-related content
    const workflowIndicators = [
      'workflow',
      'pipeline',
      'automation',
      'ci/cd',
      'deployment',
      'build process'
    ];

    const workflowContent = workflowIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase())
    );

    console.log(`  ✅ Contains ${workflowContent.length} workflow indicators`);

    // Check for integration with GitHub workflows
    const githubWorkflowFiles = [
      'ci/github-actions-workflow.yml',
      '.github/workflows/cloudflare.yml',
      '.github/workflows/deploy.yml'
    ];

    let foundWorkflows = 0;
    for (const workflowFile of githubWorkflowFiles) {
      const filePath = path.join(this.skillPath, workflowFile);
      if (fs.existsSync(filePath)) {
        foundWorkflows++;
        console.log(`  ✅ Found ${workflowFile}`);
      }
    }

    if (foundWorkflows === 0) {
      this.synergies.push('Consider adding GitHub workflow integration');
    }

    this.integrationResults.push({
      type: 'workflow',
      status: foundWorkflows > 0 ? 'passed' : 'info',
      details: {
        workflowIndicators: workflowContent.length,
        githubWorkflows: foundWorkflows
      }
    });
  }

  async validateToolCompatibility() {
    console.log('\n🛠️  Validating tool compatibility...');

    // Check for compatibility with common development tools
    const toolsToCheck = [
      'wrangler',
      'cloudflare-cli',
      'docker',
      'terraform',
      'github-cli',
      'npm',
      'node'
    ];

    let compatibleTools = 0;

    // Check package.json for tool compatibility
    const packageJsonPath = path.join(this.skillPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      toolsToCheck.forEach(tool => {
        if (Object.keys(allDeps).some(dep => dep.includes(tool))) {
          compatibleTools++;
        }
      });
    }

    // Check documentation for tool mentions
    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    toolsToCheck.forEach(tool => {
      if (content.toLowerCase().includes(tool.toLowerCase())) {
        compatibleTools++;
      }
    });

    console.log(`  ✅ Compatible with ${compatibleTools}/${toolsToCheck.length} common tools`);

    this.integrationResults.push({
      type: 'tools',
      status: compatibleTools >= toolsToCheck.length * 0.6 ? 'passed' : 'warning',
      details: {
        compatible: compatibleTools,
        total: toolsToCheck.length
      }
    });
  }

  async validateMemoryCoordination() {
    console.log('\n🧠 Validating memory coordination...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for memory coordination patterns
    const memoryPatterns = [
      'memory_usage',
      'memory_search',
      'mcp__claude-flow',
      'coordination',
      'swarm',
      'namespace'
    ];

    const foundPatterns = memoryPatterns.filter(pattern =>
      content.includes(pattern)
    );

    console.log(`  ✅ Contains ${foundPatterns.length}/${memoryPatterns.length} memory coordination patterns`);

    // Check if skill mentions memory usage
    const hasMemoryUsage = content.includes('memory_usage') ||
                          content.includes('memory store') ||
                          content.includes('coordination');

    if (hasMemoryUsage) {
      console.log('  ✅ Includes memory coordination guidance');
    } else {
      this.synergies.push('Consider adding memory coordination for multi-skill workflows');
    }

    this.integrationResults.push({
      type: 'memory',
      status: hasMemoryUsage ? 'passed' : 'info',
      details: {
        patterns: foundPatterns.length,
        total: memoryPatterns.length,
        hasGuidance: hasMemoryUsage
      }
    });
  }

  async validateSwarmIntegration() {
    console.log('\n🐝 Validating swarm integration...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for swarm-related content
    const swarmIndicators = [
      'swarm',
      'agent',
      'coordination',
      'parallel',
      'orchestration',
      'claude-flow',
      'task_orchestrate'
    ];

    const foundIndicators = swarmIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase())
    );

    console.log(`  ✅ Contains ${foundIndicators.length}/${swarmIndicators.length} swarm indicators`);

    // Check for practical swarm usage examples
    const hasSwarmExample = content.includes('Task(') ||
                          content.includes('agent_spawn') ||
                          content.includes('swarm_init');

    if (hasSwarmExample) {
      console.log('  ✅ Includes swarm usage examples');
    } else {
      this.synergies.push('Consider adding swarm orchestration examples');
    }

    this.integrationResults.push({
      type: 'swarm',
      status: hasSwarmExample ? 'passed' : 'info',
      details: {
        indicators: foundIndicators.length,
        total: swarmIndicators.length,
        hasExample: hasSwarmExample
      }
    });
  }

  generateIntegrationReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🔗 INTEGRATION VALIDATION REPORT');
    console.log('='.repeat(60));

    const totalChecks = this.integrationResults.length;
    const passedChecks = this.integrationResults.filter(r => r.status === 'passed').length;
    const warningChecks = this.integrationResults.filter(r => r.status === 'warning').length;
    const infoChecks = this.integrationResults.filter(r => r.status === 'info').length;

    console.log(`\n📊 Integration Summary:`);
    console.log(`  Total Checks: ${totalChecks}`);
    console.log(`  ✅ Passed: ${passedChecks}`);
    console.log(`  ⚠️  Warnings: ${warningChecks}`);
    console.log(`  ℹ️  Info: ${infoChecks}`);

    console.log(`\n🔍 Detailed Results:`);
    this.integrationResults.forEach(result => {
      const statusIcon = result.status === 'passed' ? '✅' :
                        result.status === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${statusIcon} ${result.type.toUpperCase()}:`);

      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`    - ${key}: ${value}`);
        });
      }
    });

    if (this.conflicts.length > 0) {
      console.log(`\n❌ Conflicts (${this.conflicts.length}):`);
      this.conflicts.forEach(conflict => console.log(`  • ${conflict}`));
    }

    if (this.synergies.length > 0) {
      console.log(`\n💡 Synergy Opportunities (${this.synergies.length}):`);
      this.synergies.forEach(synergy => console.log(`  • ${synergy}`));
    }

    // Calculate integration score
    const score = Math.max(0, (passedChecks / totalChecks) * 100 - (warningChecks * 10));
    console.log(`\n🎯 Integration Score: ${score.toFixed(1)}/100`);

    let assessment;
    if (score >= 90) {
      assessment = '🏆 EXCELLENT - Skill integrates perfectly with ecosystem';
    } else if (score >= 80) {
      assessment = '✅ GOOD - Skill integrates well with minor improvements needed';
    } else if (score >= 70) {
      assessment = '⚠️  FAIR - Skill needs integration improvements';
    } else {
      assessment = '❌ POOR - Skill requires significant integration work';
    }

    console.log(`\n📈 Overall Assessment: ${assessment}`);

    return {
      score: score,
      total: totalChecks,
      passed: passedChecks,
      warnings: warningChecks,
      conflicts: this.conflicts,
      synergies: this.synergies,
      results: this.integrationResults,
      ready: score >= 75
    };
  }
}

// CLI interface
if (require.main === module) {
  const skillPath = process.argv[2] || process.cwd();
  const validator = new IntegrationValidator(skillPath);

  validator.validateIntegrations()
    .then(report => {
      process.exit(report.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('Integration validation failed:', error);
      process.exit(1);
    });
}

module.exports = IntegrationValidator;