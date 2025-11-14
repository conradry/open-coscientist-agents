/**
 * User Experience Tester - Tests skill usability and learning effectiveness
 *
 * This validator focuses on the user experience, readability, and learning
 * effectiveness of the Cloudflare skill.
 */

const fs = require('fs');
const path = require('path');

class UserExperienceTester {
  constructor(skillPath) {
    this.skillPath = skillPath;
    this.uxResults = [];
    this.usabilityIssues = [];
    this.accessibilityIssues = [];
    this.learningMetrics = [];
  }

  async testUserExperience() {
    console.log('👥 Testing User Experience...\n');

    await this.testReadability();
    await this.testNavigation();
    await this.testCodeExamples();
    await this.testLearningProgression();
    await this.testAccessibility();
    await this.testPracticality();
    await this.testFindability();

    return this.generateUXReport();
  }

  async testReadability() {
    console.log('📖 Testing readability...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Readability metrics
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSentencesPerParagraph = sentences.length / paragraphs.length;

    console.log(`  📊 Text Statistics:`);
    console.log(`    - Words: ${words.length}`);
    console.log(`    - Sentences: ${sentences.length}`);
    console.log(`    - Paragraphs: ${paragraphs.length}`);
    console.log(`    - Avg words/sentence: ${avgWordsPerSentence.toFixed(1)}`);
    console.log(`    - Avg sentences/paragraph: ${avgSentencesPerParagraph.toFixed(1)}`);

    // Readability checks
    const readabilityScore = this.calculateReadabilityScore(words, sentences, paragraphs);
    console.log(`    - Readability score: ${readabilityScore}/100`);

    if (readabilityScore >= 80) {
      console.log('  ✅ Excellent readability');
    } else if (readabilityScore >= 70) {
      console.log('  ✅ Good readability');
    } else {
      console.log('  ⚠️  Readability could be improved');
      this.usabilityIssues.push('Consider simplifying complex sentences and breaking up long paragraphs');
    }

    // Check for technical jargon
    const technicalTerms = this.identifyTechnicalTerms(content);
    if (technicalTerms.length > 20) {
      console.log(`  ⚠️  High technical density (${technicalTerms.length} technical terms)`);
      this.usabilityIssues.push('Consider adding explanations for technical terms');
    } else {
      console.log(`  ✅ Appropriate technical density (${technicalTerms.length} technical terms)`);
    }

    this.uxResults.push({
      type: 'readability',
      score: readabilityScore,
      details: {
        words: words.length,
        sentences: sentences.length,
        paragraphs: paragraphs.length,
        technicalTerms: technicalTerms.length,
        avgWordsPerSentence: avgWordsPerSentence.toFixed(1)
      }
    });
  }

  async testNavigation() {
    console.log('\n🧭 Testing navigation...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for clear structure
    const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const hasTableOfContents = content.includes('## Table of Contents') ||
                              content.includes('## Quick Reference') ||
                              (headings.length > 10 && content.match(/\[.*?\]\(.*?\)/g));

    console.log(`  📑 Found ${headings.length} headings`);

    // Check heading hierarchy
    const headingLevels = headings.map(h => (h.match(/^#/) || [''])[0].length);
    const hasProperHierarchy = this.validateHeadingHierarchy(headingLevels);

    if (hasProperHierarchy) {
      console.log('  ✅ Proper heading hierarchy');
    } else {
      console.log('  ⚠️  Heading hierarchy issues detected');
      this.usabilityIssues.push('Fix heading hierarchy for better navigation');
    }

    // Check for navigation aids
    const hasQuickReference = content.includes('## Quick Reference');
    const hasCommonMistakes = content.includes('## Common Mistakes');
    const hasImplementation = content.includes('## Implementation');

    console.log(`  📚 Navigation aids:`);
    console.log(`    - Quick Reference: ${hasQuickReference ? '✅' : '❌'}`);
    console.log(`    - Common Mistakes: ${hasCommonMistakes ? '✅' : '❌'}`);
    console.log(`    - Implementation: ${hasImplementation ? '✅' : '❌'}`);

    const navigationScore = [
      hasProperHierarchy ? 25 : 0,
      hasQuickReference ? 25 : 0,
      hasCommonMistakes ? 25 : 0,
      hasImplementation ? 25 : 0
    ].reduce((a, b) => a + b, 0);

    this.uxResults.push({
      type: 'navigation',
      score: navigationScore,
      details: {
        headings: headings.length,
        hasProperHierarchy,
        hasQuickReference,
        hasCommonMistakes,
        hasImplementation
      }
    });
  }

  async testCodeExamples() {
    console.log('\n💻 Testing code examples...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

    console.log(`  🔍 Found ${codeBlocks.length} code blocks`);

    let qualityScore = 0;
    let totalScore = codeBlocks.length * 100;

    codeBlocks.forEach((block, index) => {
      const lines = block.split('\n');
      const language = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');

      // Check for language specification
      if (language) {
        qualityScore += 20;
      }

      // Check for comments
      const commentLines = code.split('\n').filter(line =>
        line.trim().startsWith('//') || line.trim().startsWith('#') ||
        line.trim().startsWith('/*') || line.trim().startsWith('*')
      );
      if (commentLines.length > 0) {
        qualityScore += 20;
      }

      // Check for completeness (not just fragments)
      if (code.length > 50 && code.includes('{') && code.includes('}')) {
        qualityScore += 30;
      }

      // Check for Cloudflare-specific content
      if (code.toLowerCase().includes('cloudflare') ||
          code.toLowerCase().includes('worker') ||
          code.toLowerCase().includes('env.')) {
        qualityScore += 30;
      }
    });

    const exampleQuality = totalScore > 0 ? (qualityScore / totalScore) * 100 : 0;
    console.log(`  📊 Code example quality: ${exampleQuality.toFixed(1)}%`);

    if (exampleQuality >= 80) {
      console.log('  ✅ High-quality code examples');
    } else if (exampleQuality >= 60) {
      console.log('  ⚠️  Code examples need improvement');
    } else {
      console.log('  ❌ Poor code example quality');
      this.usabilityIssues.push('Improve code examples with better comments and completeness');
    }

    this.uxResults.push({
      type: 'code-examples',
      score: exampleQuality,
      details: {
        count: codeBlocks.length,
        qualityScore: exampleQuality
      }
    });
  }

  async testLearningProgression() {
    console.log('\n📈 Testing learning progression...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for progressive complexity
    const sections = content.split(/^##/m);
    const complexityScore = this.analyzeComplexityProgression(sections);

    console.log(`  📊 Complexity progression: ${complexityScore}/100`);

    // Check for prerequisites
    const hasPrerequisites = content.includes('Prerequisites') ||
                            content.includes('Required background') ||
                            content.includes('Before you start');

    // Check for beginner-friendly content
    const hasBeginnerSection = content.includes('Getting Started') ||
                              content.includes('Basic') ||
                              content.includes('Introduction');

    // Check for advanced content
    const hasAdvancedSection = content.includes('Advanced') ||
                              content.includes('Expert') ||
                              content.includes('Optimization');

    console.log(`  🎓 Learning structure:`);
    console.log(`    - Prerequisites: ${hasPrerequisites ? '✅' : '❌'}`);
    console.log(`    - Beginner content: ${hasBeginnerSection ? '✅' : '❌'}`);
    console.log(`    - Advanced content: ${hasAdvancedSection ? '✅' : '❌'}`);

    const learningScore = [
      complexityScore,
      hasPrerequisites ? 20 : 0,
      hasBeginnerSection ? 20 : 0,
      hasAdvancedSection ? 20 : 0
    ].reduce((a, b) => a + b, 0);

    this.uxResults.push({
      type: 'learning-progression',
      score: learningScore,
      details: {
        complexityScore,
        hasPrerequisites,
        hasBeginnerSection,
        hasAdvancedSection
      }
    });
  }

  async testAccessibility() {
    console.log('\n♿ Testing accessibility...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    let accessibilityScore = 100;

    // Check for alt text in images
    const imageTags = content.match(/!\[([^\]]*)\]/g) || [];
    const imagesWithoutAlt = imageTags.filter(img => img === '![]');
    if (imagesWithoutAlt.length > 0) {
      accessibilityScore -= 20;
      this.accessibilityIssues.push('Images missing alt text');
    }

    // Check for proper heading structure (no skipped levels)
    const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const headingLevels = headings.map(h => (h.match(/^#/) || [''])[0].length);
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        accessibilityScore -= 15;
        this.accessibilityIssues.push('Skipped heading levels detected');
        break;
      }
    }

    // Check for descriptive links
    const links = content.match(/\[([^\]]+)\]\([^)]+\)/g) || [];
    const genericLinks = links.filter(link =>
      link.match(/\b(click here|here|link|read more|learn more)\b/i)
    );
    if (genericLinks.length > 0) {
      accessibilityScore -= 15;
      this.accessibilityIssues.push('Generic link text found');
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
      this.accessibilityIssues.push('Information conveyed only through color');
    }

    console.log(`  ♿ Accessibility score: ${accessibilityScore}/100`);

    if (accessibilityScore >= 90) {
      console.log('  ✅ Excellent accessibility');
    } else if (accessibilityScore >= 70) {
      console.log('  ⚠️  Good accessibility with room for improvement');
    } else {
      console.log('  ❌ Accessibility needs significant improvement');
    }

    this.uxResults.push({
      type: 'accessibility',
      score: accessibilityScore,
      details: {
        imagesWithoutAlt: imagesWithoutAlt.length,
        genericLinks: genericLinks.length,
        colorOnlyIssues: colorOnlyIssues.length
      }
    });
  }

  async testPracticality() {
    console.log('\n🛠️  Testing practicality...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for practical examples
    const practicalIndicators = [
      'example',
      'step-by-step',
      'how to',
      'tutorial',
      'real-world',
      'use case',
      'scenario'
    ];

    const practicalCount = practicalIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator)
    ).length;

    console.log(`  📊 Practical indicators: ${practicalCount}/${practicalIndicators.length}`);

    // Check for copy-paste ready code
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const readyCode = codeBlocks.filter(block => {
      const code = block.split('\n').slice(1, -1).join('\n');
      return code.length > 100 && !code.includes('// TODO') && !code.includes('...');
    });

    console.log(`  💻 Ready-to-use code examples: ${readyCode.length}/${codeBlocks.length}`);

    // Check for troubleshooting content
    const hasTroubleshooting = content.includes('troubleshoot') ||
                              content.includes('debug') ||
                              content.includes('common issues') ||
                              content.includes('error handling');

    console.log(`  🔧 Troubleshooting content: ${hasTroubleshooting ? '✅' : '❌'}`);

    const practicalityScore = Math.min(100, (
      (practicalCount / practicalIndicators.length) * 40 +
      (readyCode.length / Math.max(1, codeBlocks.length)) * 40 +
      (hasTroubleshooting ? 20 : 0)
    ));

    this.uxResults.push({
      type: 'practicality',
      score: practicalityScore,
      details: {
        practicalIndicators: practicalCount,
        readyCodeExamples: readyCode.length,
        totalCodeExamples: codeBlocks.length,
        hasTroubleshooting
      }
    });
  }

  async testFindability() {
    console.log('\n🔍 Testing findability...');

    const skillMdPath = path.join(this.skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Check for SEO-friendly content
    const searchTerms = [
      'cloudflare',
      'workers',
      'pages',
      'r2',
      'd1',
      'kv',
      'deployment',
      'performance',
      'edge',
      'cdn',
      'serverless'
    ];

    const foundSearchTerms = searchTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );

    console.log(`  🔍 Search terms: ${foundSearchTerms.length}/${searchTerms.length}`);

    // Check for common problem statements
    const problemStatements = [
      'how to',
      'what is',
      'when to use',
      'why use',
      'best practices',
      'common mistakes',
      'optimization'
    ];

    const foundProblemStatements = problemStatements.filter(statement =>
      content.toLowerCase().includes(statement)
    );

    console.log(`  🎯 Problem statements: ${foundProblemStatements.length}/${problemStatements.length}`);

    // Check for clear value proposition
    const hasValueProp = content.includes('benefits') ||
                        content.includes('advantages') ||
                        content.includes('why') ||
                        content.includes('improves');

    console.log(`  💎 Value proposition: ${hasValueProp ? '✅' : '❌'}`);

    const findabilityScore = Math.min(100, (
      (foundSearchTerms.length / searchTerms.length) * 40 +
      (foundProblemStatements.length / problemStatements.length) * 30 +
      (hasValueProp ? 30 : 0)
    ));

    this.uxResults.push({
      type: 'findability',
      score: findabilityScore,
      details: {
        searchTerms: foundSearchTerms.length,
        problemStatements: foundProblemStatements.length,
        hasValueProp
      }
    });
  }

  calculateReadabilityScore(words, sentences, paragraphs) {
    // Simplified readability calculation
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSentencesPerParagraph = sentences.length / paragraphs.length;

    let score = 100;

    // Penalize very long sentences
    if (avgWordsPerSentence > 25) score -= 20;
    else if (avgWordsPerSentence > 20) score -= 10;

    // Penalize very long paragraphs
    if (avgSentencesPerParagraph > 10) score -= 20;
    else if (avgSentencesPerParagraph > 7) score -= 10;

    // Reward optimal ranges
    if (avgWordsPerSentence >= 12 && avgWordsPerSentence <= 18) score += 10;
    if (avgSentencesPerParagraph >= 3 && avgSentencesPerParagraph <= 6) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  identifyTechnicalTerms(content) {
    const technicalTerms = [
      'api', 'endpoint', 'middleware', 'authentication', 'authorization',
      'ssl', 'tls', 'cdn', 'dns', 'proxy', 'cache', 'header', 'payload',
      'json', 'xml', 'rest', 'graphql', 'websocket', 'cors', 'csrf',
      'xss', 'sqli', 'ddos', 'waf', 'rate limiting', 'throttling',
      'latency', 'bandwidth', 'throughput', 'scalability', 'redundancy',
      'failover', 'load balancing', 'autoscaling', 'microservices',
      'container', 'kubernetes', 'docker', 'ci/cd', 'devops'
    ];

    return technicalTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );
  }

  validateHeadingHierarchy(levels) {
    for (let i = 1; i < levels.length; i++) {
      // Don't allow skipping levels (e.g., h1 to h3)
      if (levels[i] - levels[i - 1] > 1) {
        return false;
      }
      // Don't allow going up more than one level at a time
      if (levels[i] < levels[i - 1] - 1) {
        return false;
      }
    }
    return true;
  }

  analyzeComplexityProgression(sections) {
    // Simple complexity analysis based on section characteristics
    let complexityScore = 50; // Base score

    sections.forEach((section, index) => {
      const codeBlocks = (section.match(/```/g) || []).length / 2;
      const technicalTerms = this.identifyTechnicalTerms(section).length;
      const sectionLength = section.length;

      // Early sections should be simpler
      const weight = index / sections.length;
      const sectionComplexity = (codeBlocks * 20 + technicalTerms * 5 + sectionLength / 1000 * 10);

      if (sectionComplexity > 50 * (1 + weight)) {
        complexityScore -= 10;
      }
    });

    return Math.max(0, Math.min(100, complexityScore));
  }

  generateUXReport() {
    console.log('\n' + '='.repeat(60));
    console.log('👥 USER EXPERIENCE TESTING REPORT');
    console.log('='.repeat(60));

    const totalChecks = this.uxResults.length;
    const avgScore = this.uxResults.reduce((sum, result) => sum + result.score, 0) / totalChecks;

    console.log(`\n📊 UX Summary:`);
    console.log(`  Overall Score: ${avgScore.toFixed(1)}/100`);
    console.log(`  Tests Run: ${totalChecks}`);

    console.log(`\n📈 Individual Scores:`);
    this.uxResults.forEach(result => {
      const scoreIcon = result.score >= 80 ? '✅' :
                       result.score >= 70 ? '⚠️' : '❌';
      console.log(`  ${scoreIcon} ${result.type}: ${result.score.toFixed(1)}/100`);
    });

    if (this.usabilityIssues.length > 0) {
      console.log(`\n🔧 Usability Issues (${this.usabilityIssues.length}):`);
      this.usabilityIssues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (this.accessibilityIssues.length > 0) {
      console.log(`\n♿ Accessibility Issues (${this.accessibilityIssues.length}):`);
      this.accessibilityIssues.forEach(issue => console.log(`  • ${issue}`));
    }

    console.log(`\n🎯 Overall Assessment:`);

    let assessment;
    if (avgScore >= 90) {
      assessment = '🏆 EXCELLENT - Outstanding user experience';
    } else if (avgScore >= 80) {
      assessment = '✅ GOOD - Good user experience with minor improvements possible';
    } else if (avgScore >= 70) {
      assessment = '⚠️  FAIR - User experience needs improvement';
    } else {
      assessment = '❌ POOR - Significant user experience issues';
    }

    console.log(`  ${assessment}`);

    // Learning effectiveness metrics
    console.log(`\n🎓 Learning Effectiveness:`);
    const learningResult = this.uxResults.find(r => r.type === 'learning-progression');
    if (learningResult) {
      console.log(`  Learning Progression: ${learningResult.score}/100`);
    }

    return {
      overallScore: avgScore,
      results: this.uxResults,
      usabilityIssues: this.usabilityIssues,
      accessibilityIssues: this.accessibilityIssues,
      ready: avgScore >= 75
    };
  }
}

// CLI interface
if (require.main === module) {
  const skillPath = process.argv[2] || process.cwd();
  const tester = new UserExperienceTester(skillPath);

  tester.testUserExperience()
    .then(report => {
      process.exit(report.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('UX testing failed:', error);
      process.exit(1);
    });
}

module.exports = UserExperienceTester;