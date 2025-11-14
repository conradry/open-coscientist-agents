/**
 * Documentation Validator - Ensures documentation completeness
 *
 * This validator checks that all documentation is complete, accurate,
 * and follows best practices for technical documentation.
 */

const fs = require('fs');
const path = require('path');

class DocumentationValidator {
  constructor(config = {}) {
    this.config = {
      minCodeExamples: 5,
      requiredSections: [
        'Overview',
        'Quick Reference',
        'Implementation',
        'Examples',
        'Troubleshooting'
      ],
      ...config
    };
    this.issues = [];
    this.suggestions = [];
    this.metrics = {};
  }

  async validateDocumentation(skillPath) {
    console.log('📚 Validating Documentation...\n');

    await this.validateMainSkillFile(skillPath);
    await this.validateCodeExamples(skillPath);
    await this.validateCrossReferences(skillPath);
    await this.validateAccessibility(skillPath);
    await this.validateSearchability(skillPath);
    await this.validateVersioning(skillPath);

    return this.generateDocumentationReport();
  }

  async validateMainSkillFile(skillPath) {
    console.log('📄 Validating main skill file...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      this.issues.push('SKILL.md file is missing');
      return;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check frontmatter
    console.log('  🔍 Checking frontmatter...');
    const frontmatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
    if (!frontmatterMatch) {
      this.issues.push('Missing YAML frontmatter');
    } else {
      const frontmatter = frontmatterMatch[1];
      this.validateFrontmatter(frontmatter);
    }

    // Check required sections
    console.log('  🔍 Checking required sections...');
    this.validateRequiredSections(content);

    // Check for README or additional docs
    console.log('  🔍 Checking additional documentation...');
    this.validateAdditionalDocs(skillPath);

    this.metrics.mainFile = {
      lines: content.split('\n').length,
      words: content.split(/\s+/).length,
      hasFrontmatter: !!frontmatterMatch,
      sections: (content.match(/^##\s+(.+)$/gm) || []).length
    };

    console.log(`  📊 SKILL.md: ${this.metrics.mainFile.lines} lines, ${this.metrics.mainFile.sections} sections`);
  }

  validateFrontmatter(frontmatter) {
    const requiredFields = ['name', 'description'];
    const optionalFields = ['version', 'author', 'tags'];

    const hasName = frontmatter.includes('name:');
    const hasDescription = frontmatter.includes('description:');

    if (!hasName) {
      this.issues.push('Frontmatter missing "name" field');
    }

    if (!hasDescription) {
      this.issues.push('Frontmatter missing "description" field');
    }

    // Check name format
    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (!/^[a-z0-9-]+$/.test(name)) {
        this.suggestions.push('Skill name should use lowercase letters, numbers, and hyphens only');
      }
    }

    // Check description
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    if (descMatch) {
      const description = descMatch[1].trim();
      if (!description.startsWith('Use when')) {
        this.suggestions.push('Description should start with "Use when..." to indicate trigger conditions');
      }

      if (description.length > 200) {
        this.suggestions.push('Description should be concise (under 200 characters)');
      }
    }

    this.metrics.frontmatter = {
      hasRequiredFields: hasName && hasDescription,
      requiredFieldCount: [hasName, hasDescription].filter(Boolean).length,
      optionalFieldCount: optionalFields.filter(field => frontmatter.includes(field + ':')).length
    };
  }

  validateRequiredSections(content) {
    const foundSections = [];
    const missingSections = [];

    for (const section of this.config.requiredSections) {
      const sectionPattern = new RegExp(`^##\\s*${section}\\s*$`, 'mi');
      if (sectionPattern.test(content)) {
        foundSections.push(section);
      } else {
        missingSections.push(section);
      }
    }

    if (missingSections.length > 0) {
      this.issues.push(`Missing required sections: ${missingSections.join(', ')}`);
    }

    // Check section quality
    const sections = content.split(/^##/m);
    let emptySections = 0;

    sections.forEach((section, index) => {
      if (index > 0) { // Skip content before first section
        const cleanSection = section.trim();
        if (cleanSection.length < 100) {
          emptySections++;
        }
      }
    });

    if (emptySections > 0) {
      this.suggestions.push(`${emptySections} section(s) appear to be empty or too short`);
    }

    this.metrics.sections = {
      required: this.config.requiredSections.length,
      found: foundSections.length,
      missing: missingSections.length,
      empty: emptySections
    };
  }

  validateAdditionalDocs(skillPath) {
    const additionalDocs = [
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'LICENSE'
    ];

    const foundDocs = [];
    const missingDocs = [];

    for (const doc of additionalDocs) {
      const docPath = path.join(skillPath, doc);
      if (fs.existsSync(docPath)) {
        foundDocs.push(doc);
      } else {
        missingDocs.push(doc);
      }
    }

    // README.md is recommended but not required for skills
    if (!fs.existsSync(path.join(skillPath, 'README.md'))) {
      this.suggestions.push('Consider adding README.md for project overview');
    }

    this.metrics.additionalDocs = {
      found: foundDocs.length,
      missing: missingDocs.length,
      recommended: ['README.md']
    };
  }

  async validateCodeExamples(skillPath) {
    console.log('\n💻 Validating code examples...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Extract code blocks
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

    if (codeBlocks.length < this.config.minCodeExamples) {
      this.issues.push(`Insufficient code examples (${codeBlocks.length}, recommend ${this.config.minCodeExamples})`);
    }

    let qualityIssues = 0;
    let goodExamples = 0;

    codeBlocks.forEach((block, index) => {
      const lines = block.split('\n');
      const language = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');

      // Check for language specification
      if (!language) {
        qualityIssues++;
      }

      // Check for comments
      const commentLines = code.split('\n').filter(line =>
        line.trim().startsWith('//') || line.trim().startsWith('#') ||
        line.trim().startsWith('/*') || line.trim().startsWith('*')
      );

      const hasComments = commentLines.length > 0;
      const isComplete = code.length > 50 && (code.includes('{') || code.includes('function'));

      if (language && hasComments && isComplete) {
        goodExamples++;
      }
    });

    // Check for Cloudflare-specific examples
    const cloudflareBlocks = codeBlocks.filter(block =>
      block.toLowerCase().includes('cloudflare') ||
      block.toLowerCase().includes('worker') ||
      block.toLowerCase().includes('env.')
    );

    if (cloudflareBlocks.length === 0 && codeBlocks.length > 0) {
      this.suggestions.push('Include Cloudflare-specific code examples');
    }

    this.metrics.codeExamples = {
      total: codeBlocks.length,
      withLanguage: codeBlocks.filter(b => b.split('\n')[0].replace('```', '').trim()).length,
      withComments: codeBlocks.filter(b => {
        const code = b.split('\n').slice(1, -1).join('\n');
        return code.includes('//') || code.includes('#');
      }).length,
      complete: codeBlocks.filter(b => {
        const code = b.split('\n').slice(1, -1).join('\n');
        return code.length > 50;
      }).length,
      cloudflareSpecific: cloudflareBlocks.length
    };

    console.log(`  📊 ${codeBlocks.length} code blocks found`);
    console.log(`    • With language: ${this.metrics.codeExamples.withLanguage}`);
    console.log(`    • With comments: ${this.metrics.codeExamples.withComments}`);
    console.log(`    • Complete examples: ${this.metrics.codeExamples.complete}`);
    console.log(`    • Cloudflare-specific: ${this.metrics.codeExamples.cloudflareSpecific}`);
  }

  async validateCrossReferences(skillPath) {
    console.log('\n🔗 Validating cross-references...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for internal links
    const internalLinks = content.match(/\[([^\]]+)\]\(#([^)]+)\)/g) || [];
    const brokenInternalLinks = [];

    for (const link of internalLinks) {
      const anchorMatch = link.match(/\(([^)]+)\)/);
      if (anchorMatch) {
        const anchor = anchorMatch[1].replace('#', '');
        const anchorExists = content.includes(`## ${anchor}`) || content.includes(`### ${anchor}`);

        if (!anchorExists) {
          brokenInternalLinks.push(anchor);
        }
      }
    }

    if (brokenInternalLinks.length > 0) {
      this.issues.push(`Broken internal links: ${brokenInternalLinks.join(', ')}`);
    }

    // Check for external links
    const externalLinks = content.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g) || [];
    this.metrics.links = {
      internal: internalLinks.length,
      internalBroken: brokenInternalLinks.length,
      external: externalLinks.length
    };

    // Check for skill references
    const skillReferences = content.match(/\b[a-z][a-z0-9-]*:[a-z0-9-]+\b/g) || [];
    const atSyntaxReferences = content.match(/@[a-z0-9-\/]+/g) || [];

    if (atSyntaxReferences.length > 0) {
      this.issues.push(`Found ${atSyntaxReferences.length} @ syntax references (should use skill names only)`);
    }

    this.metrics.skillReferences = {
      total: skillReferences.length,
      atSyntax: atSyntaxReferences.length
    };

    console.log(`  📊 Links: ${this.metrics.links.internal} internal, ${this.metrics.links.external} external`);
    console.log(`  📊 Skill references: ${this.metrics.skillReferences.total} total, ${this.metrics.skillReferences.atSyntax} @ syntax`);
  }

  async validateAccessibility(skillPath) {
    console.log('\n♿ Validating accessibility...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    let accessibilityScore = 100;

    // Check for proper heading hierarchy
    const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const headingLevels = headings.map(h => (h.match(/^#+/) || [''])[0].length);

    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        accessibilityScore -= 15;
        this.issues.push('Skipped heading levels detected (h1 to h3, etc.)');
        break;
      }
    }

    // Check for descriptive links
    const links = content.match(/\[([^\]]+)\]\([^)]+\)/g) || [];
    const genericLinks = links.filter(link =>
      link.match(/\b(click here|here|link|read more|learn more)\b/i)
    );

    if (genericLinks.length > 0) {
      accessibilityScore -= 10;
      this.issues.push(`Found ${genericLinks.length} generic link text (e.g., "click here")`);
    }

    // Check for image alt text
    const images = content.match(/!\[([^\]]*)\]/g) || [];
    const imagesWithoutAlt = images.filter(img => img === '![]');

    if (imagesWithoutAlt.length > 0) {
      accessibilityScore -= 10;
      this.issues.push(`${imagesWithoutAlt.length} images missing alt text`);
    }

    // Check for color-only information
    const colorOnlyPatterns = [
      /red.*means/gi,
      /green.*indicates/gi,
      /blue.*shows/gi
    ];

    const colorOnlyIssues = colorOnlyPatterns.filter(pattern =>
      content.match(pattern)
    );

    if (colorOnlyIssues.length > 0) {
      accessibilityScore -= 10;
      this.suggestions.push('Avoid conveying information through color only');
    }

    this.metrics.accessibility = {
      score: Math.max(0, accessibilityScore),
      headings: headings.length,
      properHierarchy: headingLevels.every((level, i) =>
        i === 0 || level - headingLevels[i - 1] <= 1
      ),
      descriptiveLinks: links.length - genericLinks.length,
      imagesWithAlt: images.length - imagesWithoutAlt.length
    };

    console.log(`  📊 Accessibility score: ${this.metrics.accessibility.score}/100`);
  }

  async validateSearchability(skillPath) {
    console.log('\n🔍 Validating searchability...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for search terms
    const searchTerms = [
      'Cloudflare', 'Workers', 'Pages', 'R2', 'D1', 'KV', 'Wrangler',
      'CDN', 'edge', 'serverless', 'deployment', 'performance',
      'security', 'cache', 'API', 'zone', 'domain'
    ];

    const foundSearchTerms = searchTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );

    // Check for problem/solution patterns
    const problemPatterns = [
      'how to',
      'what is',
      'when to use',
      'why use',
      'common issues',
      'troubleshooting',
      'error',
      'fix'
    ];

    const foundProblemPatterns = problemPatterns.filter(pattern =>
      content.toLowerCase().includes(pattern)
    );

    // Check for action-oriented language
    const actionWords = [
      'deploy', 'configure', 'setup', 'create', 'implement',
      'optimize', 'secure', 'monitor', 'debug', 'test'
    ];

    const foundActionWords = actionWords.filter(word =>
      content.toLowerCase().includes(word)
    );

    this.metrics.searchability = {
      searchTerms: foundSearchTerms.length,
      totalSearchTerms: searchTerms.length,
      problemPatterns: foundProblemPatterns.length,
      totalProblemPatterns: problemPatterns.length,
      actionWords: foundActionWords.length,
      totalActionWords: actionWords.length
    };

    console.log(`  📊 Search terms: ${foundSearchTerms.length}/${searchTerms.length}`);
    console.log(`  📊 Problem patterns: ${foundProblemPatterns.length}/${problemPatterns.length}`);
    console.log(`  📊 Action words: ${foundActionWords.length}/${actionWords.length}`);

    if (foundSearchTerms.length < searchTerms.length * 0.7) {
      this.suggestions.push('Add more Cloudflare-specific search terms');
    }
  }

  async validateVersioning(skillPath) {
    console.log('\n📋 Validating versioning...');

    // Check for version information
    const changelogPath = path.join(skillPath, 'CHANGELOG.md');
    const hasChangelog = fs.existsSync(changelogPath);

    // Check for version in package.json
    const packageJsonPath = path.join(skillPath, 'package.json');
    let hasVersion = false;

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        hasVersion = !!packageJson.version;
      } catch (error) {
        // Invalid package.json
      }
    }

    // Check for version references in skill file
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const versionReferences = content.match(/\b(v?\d+\.\d+\.\d+)\b/g) || [];

    this.metrics.versioning = {
      hasChangelog,
      hasPackageVersion: hasVersion,
      versionReferences: versionReferences.length
    };

    if (!hasChangelog && !hasVersion) {
      this.suggestions.push('Consider adding version information (CHANGELOG.md or package.json)');
    }

    console.log(`  📊 Changelog: ${hasChangelog ? '✅' : '❌'}`);
    console.log(`  📊 Package version: ${hasVersion ? '✅' : '❌'}`);
    console.log(`  📊 Version references: ${versionReferences.length}`);
  }

  generateDocumentationReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📚 DOCUMENTATION VALIDATION REPORT');
    console.log('='.repeat(60));

    // Calculate overall score
    const score = this.calculateDocumentationScore();

    console.log(`\n🎯 Documentation Score: ${score}/100`);

    console.log(`\n📊 Documentation Metrics:`);
    console.log(`  📄 Main file lines: ${this.metrics.mainFile?.lines || 0}`);
    console.log(`  📖 Sections: ${this.metrics.mainFile?.sections || 0}`);
    console.log(`  💻 Code examples: ${this.metrics.codeExamples?.total || 0}`);
    console.log(`  🔗 Links: ${this.metrics.links?.internal || 0} internal, ${this.metrics.links?.external || 0} external`);
    console.log(`  ♿ Accessibility: ${this.metrics.accessibility?.score || 0}/100`);

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
      assessment = '🏆 EXCELLENT - Comprehensive, well-structured documentation';
    } else if (score >= 80) {
      assessment = '✅ GOOD - Quality documentation with minor improvements needed';
    } else if (score >= 70) {
      assessment = '⚠️  FAIR - Documentation needs significant improvements';
    } else {
      assessment = '❌ POOR - Major documentation issues require attention';
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

  calculateDocumentationScore() {
    let score = 100;

    // Deduct points for issues
    score -= this.issues.length * 8;

    // Deduct points for suggestions
    score -= this.suggestions.length * 3;

    // Bonus points for good metrics
    if (this.metrics.codeExamples?.total >= 5) {
      score += 10;
    }

    if (this.metrics.accessibility?.score >= 90) {
      score += 10;
    }

    if (this.metrics.sections?.found === this.metrics.sections?.required) {
      score += 10;
    }

    if ((this.metrics.searchability?.searchTerms || 0) >= 10) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// CLI interface
if (require.main === module) {
  const skillPath = process.argv[2] || process.cwd();
  const config = {
    minCodeExamples: parseInt(process.argv[3]) || 5
  };

  const validator = new DocumentationValidator(config);

  validator.validateDocumentation(skillPath)
    .then(report => {
      process.exit(report.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('Documentation validation failed:', error);
      process.exit(1);
    });
}

module.exports = DocumentationValidator;