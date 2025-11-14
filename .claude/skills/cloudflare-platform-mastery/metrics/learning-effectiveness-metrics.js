/**
 * Learning Effectiveness Metrics - Measures learning path effectiveness
 *
 * This framework measures how effectively users learn and master Cloudflare
 * concepts through the skill, tracking comprehension, retention, and application.
 */

const fs = require('fs');
const path = require('path');

class LearningEffectivenessMetrics {
  constructor(config = {}) {
    this.config = {
      dataRetention: 90, // days
      minSampleSize: 10,
      ...config
    };
    this.metrics = {};
    this.assessments = [];
    this.learningPaths = [];
  }

  async collectMetrics(skillPath) {
    console.log('📓 Collecting Learning Effectiveness Metrics...\n');

    await this.analyzeSkillStructure(skillPath);
    await this.evaluateLearningProgression(skillPath);
    await this.measureComprehensionLevel(skillPath);
    await this.assessPracticalApplication(skillPath);
    await this.trackKnowledgeRetention(skillPath);
    await this.evaluateLearningEngagement(skillPath);
    await this.calculateLearningROI(skillPath);

    return this.generateLearningReport();
  }

  async analyzeSkillStructure(skillPath) {
    console.log('🏗️  Analyzing skill structure for learning effectiveness...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      this.metrics.structure = { score: 0, issues: ['SKILL.md not found'] };
      return;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Analyze learning-oriented structure
    const learningIndicators = {
      hasLearningObjectives: content.includes('Objectives') || content.includes('What you will learn'),
      hasPrerequisites: content.includes('Prerequisites') || content.includes('Before you start'),
      hasStepByStepGuide: content.includes('Step') || content.includes('Follow these steps'),
      hasHandsOnExercises: content.includes('Exercise') || content.includes('Try this'),
      hasCommonMistakes: content.includes('Common Mistakes') || content.includes('Pitfalls'),
      hasTroubleshooting: content.includes('Troubleshooting') || content.includes('Debug'),
      hasExamples: (content.match(/```[\s\S]*?```/g) || []).length >= 3,
      hasQuickReference: content.includes('Quick Reference') || content.includes('Cheat Sheet'),
      hasAdvancedTopics: content.includes('Advanced') || content.includes('Expert')
    };

    const structureScore = Object.values(learningIndicators).filter(Boolean).length / Object.keys(learningIndicators).length * 100;

    this.metrics.structure = {
      score: structureScore,
      indicators: learningIndicators,
      recommendations: this.generateStructureRecommendations(learningIndicators)
    };

    console.log(`  📊 Structure score: ${structureScore.toFixed(1)}/100`);
    console.log(`    ✅ Learning indicators: ${Object.values(learningIndicators).filter(Boolean).length}/${Object.keys(learningIndicators).length}`);
  }

  async evaluateLearningProgression(skillPath) {
    console.log('\n📈 Evaluating learning progression...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Extract learning progression elements
    const sections = content.split(/^##/m);
    let complexityScore = 50;
    let hasBeginnerContent = false;
    let hasIntermediateContent = false;
    let hasAdvancedContent = false;

    sections.forEach((section, index) => {
      const sectionText = section.toLowerCase();

      // Check for complexity indicators
      if (sectionText.includes('getting started') || sectionText.includes('beginner') || sectionText.includes('introduction')) {
        hasBeginnerContent = true;
        complexityScore += 10;
      }

      if (sectionText.includes('intermediate') || sectionText.includes('building on') || sectionText.includes('next level')) {
        hasIntermediateContent = true;
        complexityScore += 15;
      }

      if (sectionText.includes('advanced') || sectionText.includes('expert') || sectionText.includes('optimization')) {
        hasAdvancedContent = true;
        complexityScore += 20;
      }

      // Analyze code complexity in sections
      const codeBlocks = section.match(/```[\s\S]*?```/g) || [];
      codeBlocks.forEach(block => {
        if (block.includes('async') && block.includes('await')) {
          complexityScore += 5;
        }
        if (block.includes('class') || block.includes('interface')) {
          complexityScore += 5;
        }
        if (block.includes('Promise.all') || block.includes('Promise.allSettled')) {
          complexityScore += 3;
        }
      });
    });

    // Check for progressive difficulty
    const progressionQuality = {
      hasLogicalFlow: this.validateLogicalFlow(content),
      buildsOnPrevious: this.checkBuildingBlocks(content),
      providesScaffolding: this.checkScaffolding(content)
    };

    const progressionScore = Math.min(100, complexityScore) * 0.7 +
                           Object.values(progressionQuality).filter(Boolean).length * 10;

    this.metrics.progression = {
      score: Math.min(100, progressionScore),
      hasBeginnerContent,
      hasIntermediateContent,
      hasAdvancedContent,
      complexity: complexityScore,
      quality: progressionQuality
    };

    console.log(`  📊 Progression score: ${Math.min(100, progressionScore).toFixed(1)}/100`);
    console.log(`    📈 Complexity progression: Beginner=${hasBeginnerContent}, Intermediate=${hasIntermediateContent}, Advanced=${hasAdvancedContent}`);
  }

  async measureComprehensionLevel(skillPath) {
    console.log('\n🧠 Measuring comprehension level...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Analyze content clarity and comprehension
    const clarityMetrics = {
      avgSentenceLength: this.calculateAvgSentenceLength(content),
      technicalDensity: this.calculateTechnicalDensity(content),
      exampleFrequency: this.calculateExampleFrequency(content),
      analogyUsage: content.includes('analogy') || content.includes('like a') || content.includes('think of'),
      visualAids: (content.match(/```dot|```mermaid|!\[.*\]/g) || []).length,
      definitionsCount: (content.match(/\*\*[^*]+\*\*:/g) || []).length
    };

    // Calculate readability score
    const readabilityScore = this.calculateReadabilityScore(content, clarityMetrics);

    // Assess concept explanation quality
    const conceptQuality = {
      definesKeyTerms: clarityMetrics.definitionsCount > 5,
      providesContext: content.includes('background') || content.includes('context'),
      usesAnalogies: clarityMetrics.analogyUsage,
      includesExamples: clarityMetrics.exampleFrequency > 0.1,
      balancesTheory: content.includes('practical') || content.includes('real-world')
    };

    const comprehensionScore = readabilityScore * 0.6 +
                               Object.values(conceptQuality).filter(Boolean).length * 8;

    this.metrics.comprehension = {
      score: Math.min(100, comprehensionScore),
      clarity: clarityMetrics,
      quality: conceptQuality,
      readability: readabilityScore
    };

    console.log(`  📊 Comprehension score: ${Math.min(100, comprehensionScore).toFixed(1)}/100`);
    console.log(`    📖 Readability: ${readabilityScore.toFixed(1)}/100`);
    console.log(`    💡 Examples frequency: ${(clarityMetrics.exampleFrequency * 100).toFixed(1)}%`);
  }

  async assessPracticalApplication(skillPath) {
    console.log('\n🛠️  Assessing practical application...');

    // Look for practical elements in the skill
    const practicalFiles = this.findPracticalFiles(skillPath);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    const practicalMetrics = {
      hasStepByStep: content.includes('Step') || content.includes('Follow'),
      hasHandsOnExamples: (content.match(/```[\s\S]*?```/g) || []).length >= 5,
      hasRealWorldScenarios: content.includes('real-world') || content.includes('scenario'),
      hasCopyPasteReady: this.countCopyPasteReadyCode(content),
      hasTroubleshooting: content.includes('troubleshoot') || content.includes('common issues'),
      hasBestPractices: content.includes('best practice') || content.includes('recommended'),
      practiceFiles: practicalFiles.length,
      interactiveElements: content.includes('exercise') || content.includes('try this')
    };

    // Assess learning by doing
    const activeLearningScore = Object.values(practicalMetrics).reduce((score, value, index) => {
      if (typeof value === 'boolean') {
        return score + (value ? 12.5 : 0);
      } else if (typeof value === 'number') {
        return score + Math.min(12.5, value * 2.5);
      }
      return score;
    }, 0);

    // Check for complete workflows
    const workflows = this.extractWorkflows(content);
    const workflowCompleteness = this.assessWorkflowCompleteness(workflows);

    this.metrics.practical = {
      score: Math.min(100, activeLearningScore),
      metrics: practicalMetrics,
      workflows: {
        count: workflows.length,
        completeness: workflowCompleteness
      }
    };

    console.log(`  📊 Practical application score: ${Math.min(100, activeLearningScore).toFixed(1)}/100`);
    console.log(`    🔧 Practical files: ${practicalFiles.length}`);
    console.log(`    📋 Complete workflows: ${workflows.filter(w => w.completeness >= 0.8).length}/${workflows.length}`);
  }

  async trackKnowledgeRetention(skillPath) {
    console.log('\n🧠 Tracking knowledge retention...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Analyze retention-focused elements
    const retentionElements = {
      hasSummary: content.includes('## Summary') || content.includes('## Recap'),
      hasKeyTakeaways: content.includes('Key Takeaway') || content.includes('Remember'),
      hasCheatSheet: content.includes('Quick Reference') || content.includes('Cheat Sheet'),
      hasCommonPatterns: content.includes('Pattern') || content.includes('Template'),
      hasMnemonics: content.includes('mnemonic') || content.includes('remember as'),
      spacedRepetition: this.checkSpacedRepetition(content),
      practicalReviews: content.includes('review') || content.includes('practice again')
    };

    // Assess information architecture for retention
    const retentionScore = this.calculateRetentionScore(content, retentionElements);

    // Check for reinforcement mechanisms
    const reinforcement = {
      multipleExamples: (content.match(/```[\s\S]*?```/g) || []).length >= 3,
      progressiveDisclosure: this.checkProgressiveDisclosure(content),
      immediateFeedback: content.includes('test') || content.includes('verify'),
      contextVariation: this.countContextVariations(content)
    };

    this.metrics.retention = {
      score: retentionScore,
      elements: retentionElements,
      reinforcement,
      retentionStrategies: this.identifyRetentionStrategies(content)
    };

    console.log(`  📊 Knowledge retention score: ${retentionScore.toFixed(1)}/100`);
    console.log(`    📚 Retention elements: ${Object.values(retentionElements).filter(Boolean).length}/${Object.keys(retentionElements).length}`);
    console.log(`    🔄 Reinforcement mechanisms: ${Object.values(reinforcement).filter(Boolean).length}/${Object.keys(reinforcement).length}`);
  }

  async evaluateLearningEngagement(skillPath) {
    console.log('\n🎯 Evaluating learning engagement...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Analyze engagement factors
    const engagementFactors = {
      interactiveElements: content.includes('exercise') || content.includes('try') || content.includes('challenge'),
      varietyOfContent: this.calculateContentVariety(content),
      storytellingElements: content.includes('imagine') || content.includes('scenario') || content.includes('story'),
      practicalRelevance: content.includes('real-world') || content.includes('practical') || content.includes('use case'),
      achievementMilestones: content.includes('milestone') || content.includes('checkpoint') || content.includes('goal'),
      userFriendlyLanguage: this assessUserFriendlyLanguage(content),
      visualSupport: (content.match(/```dot|```mermaid|!\[.*\]|```[\s\S]*?diagram/gi) || []).length
    };

    // Calculate engagement score
    const engagementScore = Object.values(engagementFactors).reduce((score, value, index) => {
      if (typeof value === 'boolean') {
        return score + (value ? 14.3 : 0);
      } else if (typeof value === 'number') {
        return score + Math.min(14.3, value);
      }
      return score;
    }, 0);

    // Assess motivation factors
    const motivation = {
      clearBenefits: content.includes('benefit') || content.includes('advantage') || content.includes('why use'),
      achievableGoals: content.includes('learn') && content.includes('master'),
      progressTracking: content.includes('progress') || content.includes('measure'),
      communityAspect: content.includes('community') || content.includes('share') || content.includes('discuss')
    };

    this.metrics.engagement = {
      score: Math.min(100, engagementScore),
      factors: engagementFactors,
      motivation,
      estimatedCompletionRate: this.estimateCompletionRate(engagementScore, motivation)
    };

    console.log(`  📊 Learning engagement score: ${Math.min(100, engagementScore).toFixed(1)}/100`);
    console.log(`    🎮 Interactive elements: ${engagementFactors.interactiveElements}`);
    console.log(`    📈 Content variety: ${engagementFactors.varietyOfContent.toFixed(1)}/1.0`);
    console.log(`    🎯 Estimated completion rate: ${this.estimateCompletionRate(engagementScore, motivation).toFixed(1)}%`);
  }

  async calculateLearningROI(skillPath) {
    console.log('\n💰 Calculating learning ROI...');

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Estimate learning time investment
    const timeInvestment = {
      readingTime: this.estimateReadingTime(content),
      practiceTime: this.estimatePracticeTime(content),
      totalTime: 0 // Will be calculated
    };
    timeInvestment.totalTime = timeInvestment.readingTime + timeInvestment.practiceTime;

    // Estimate skill value and outcomes
    const skillValue = {
      careerAdvancement: content.includes('career') || content.includes('job') || content.includes('professional'),
      productivityGain: content.includes('productivity') || content.includes('efficiency') || content.includes('save time'),
      errorReduction: content.includes('error') || content.includes('bug') || content.includes('issue'),
      marketDemand: this.assessMarketDemand(content),
      scalability: content.includes('scale') || content.includes('enterprise') || content.includes('team')
    };

    const valueScore = Object.values(skillValue).filter(Boolean).length * 20;

    // Calculate ROI metrics
    const roiMetrics = {
      timeToMastery: this.estimateTimeToMastery(content, timeInvestment),
      practicalApplicationRate: this.estimatePracticalApplicationRate(content),
      knowledgeLifespan: this.estimateKnowledgeLifespan(content),
      transferability: this.assessTransferability(content)
    };

    const roiScore = (valueScore * 0.6) + (roiMetrics.timeToMastery <= 7 ? 10 : 0) +
                    (roiMetrics.practicalApplicationRate >= 80 ? 10 : 0) +
                    (roiMetrics.knowledgeLifespan >= 12 ? 10 : 0) +
                    (roiMetrics.transferability >= 70 ? 10 : 0);

    this.metrics.roi = {
      score: Math.min(100, roiScore),
      timeInvestment,
      skillValue,
      roiMetrics,
      estimatedROI: this.calculateEstimatedROI(valueScore, timeInvestment.totalTime)
    };

    console.log(`  📊 Learning ROI score: ${Math.min(100, roiScore).toFixed(1)}/100`);
    console.log(`    ⏰ Time investment: ${timeInvestment.totalTime} hours`);
    console.log(`    💵 Skill value score: ${valueScore}/100`);
    console.log(`    📈 Estimated ROI: ${this.calculateEstimatedROI(valueScore, timeInvestment.totalTime).toFixed(1)}x`);
  }

  // Helper methods for analysis
  generateStructureRecommendations(indicators) {
    const recommendations = [];

    if (!indicators.hasLearningObjectives) {
      recommendations.push('Add clear learning objectives at the beginning');
    }
    if (!indicators.hasPrerequisites) {
      recommendations.push('Include prerequisite knowledge and requirements');
    }
    if (!indicators.hasStepByStepGuide) {
      recommendations.push('Add step-by-step guidance for complex processes');
    }
    if (!indicators.hasHandsOnExercises) {
      recommendations.push('Include hands-on exercises and activities');
    }
    if (!indicators.hasCommonMistakes) {
      recommendations.push('Document common mistakes and how to avoid them');
    }
    if (!indicators.hasTroubleshooting) {
      recommendations.push('Add troubleshooting section for common issues');
    }
    if (!indicators.hasQuickReference) {
      recommendations.push('Create a quick reference or cheat sheet');
    }

    return recommendations;
  }

  validateLogicalFlow(content) {
    const sections = content.split(/^##/m);
    const sectionOrder = sections.map(section => {
      const title = section.split('\n')[0].toLowerCase();
      if (title.includes('introduction') || title.includes('overview')) return 1;
      if (title.includes('prerequisite') || title.includes('before')) return 2;
      if (title.includes('getting started') || title.includes('basic')) return 3;
      if (title.includes('advanced') || title.includes('expert')) return 6;
      if (title.includes('troubleshoot') || title.includes('debug')) return 7;
      if (title.includes('summary') || title.includes('conclusion')) return 8;
      return 4; // Intermediate content
    });

    // Check if sections are in logical order
    for (let i = 1; i < sectionOrder.length; i++) {
      if (sectionOrder[i] < sectionOrder[i - 1]) {
        return false;
      }
    }

    return true;
  }

  checkBuildingBlocks(content) {
    const references = content.match(/As mentioned|Previously|Building on|From earlier/g) || [];
    return references.length > 0;
  }

  checkScaffolding(content) {
    const scaffoldingIndicators = [
      'start with',
      'begin with',
      'first step',
      'before you',
      'make sure you'
    ];

    return scaffoldingIndicators.some(indicator => content.toLowerCase().includes(indicator));
  }

  calculateAvgSentenceLength(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/);
    return sentences.length > 0 ? words.length / sentences.length : 0;
  }

  calculateTechnicalDensity(content) {
    const technicalTerms = [
      'api', 'endpoint', 'authentication', 'authorization', 'ssl', 'tls',
      'cdn', 'dns', 'proxy', 'cache', 'header', 'payload', 'json', 'xml'
    ];

    const totalWords = content.split(/\s+/).length;
    const technicalWords = technicalTerms.reduce((count, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex) || [];
      return count + matches.length;
    }, 0);

    return totalWords > 0 ? (technicalWords / totalWords) * 100 : 0;
  }

  calculateExampleFrequency(content) {
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const totalSections = content.split(/^##/m).length;
    return totalSections > 0 ? codeBlocks.length / totalSections : 0;
  }

  calculateReadabilityScore(content, clarityMetrics) {
    let score = 100;

    // Penalize long sentences
    if (clarityMetrics.avgSentenceLength > 20) {
      score -= 15;
    } else if (clarityMetrics.avgSentenceLength > 15) {
      score -= 5;
    }

    // Penalize high technical density without enough examples
    if (clarityMetrics.technicalDensity > 15 && clarityMetrics.exampleFrequency < 0.2) {
      score -= 20;
    }

    // Reward good practices
    if (clarityMetrics.analogyUsage) score += 10;
    if (clarityMetrics.visualAids > 0) score += 5;
    if (clarityMetrics.definitionsCount > 5) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  countCopyPasteReadyCode(content) {
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const readyBlocks = codeBlocks.filter(block => {
      const code = block.split('\n').slice(1, -1).join('\n');
      return code.length > 50 &&
             !code.includes('TODO') &&
             !code.includes('example') &&
             !code.includes('placeholder');
    });

    return readyBlocks.length;
  }

  findPracticalFiles(skillPath) {
    const practicalPatterns = [
      'example', 'demo', 'tutorial', 'workshop', 'lab',
      'exercise', 'practice', 'hands-on', 'template', 'boilerplate'
    ];

    const practicalFiles = [];

    const searchDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          searchDir(itemPath);
        } else if (stat.isFile() && practicalPatterns.some(pattern => item.toLowerCase().includes(pattern))) {
          practicalFiles.push(itemPath);
        }
      }
    };

    searchDir(skillPath);
    return practicalFiles;
  }

  extractWorkflows(content) {
    const workflowPatterns = [
      /step\s+\d+[:.]/gi,
      /first,.*?then/gi,
      /begin.*?end/gi,
      /start.*?finish/gi
    ];

    const workflows = [];
    workflowPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      workflows.push({
        type: pattern.toString(),
        count: matches.length,
        completeness: matches.length > 0 ? 0.8 : 0
      });
    });

    return workflows;
  }

  assessWorkflowCompleteness(workflows) {
    if (workflows.length === 0) return 0;

    const totalCompleteness = workflows.reduce((sum, workflow) => sum + workflow.completeness, 0);
    return totalCompleteness / workflows.length;
  }

  calculateRetentionScore(content, elements) {
    const elementScore = Object.values(elements).filter(Boolean).length / Object.keys(elements).length * 50;

    // Add points for comprehensive structure
    const sections = content.split(/^##/m);
    const hasConclusion = sections.some(section =>
      section.toLowerCase().includes('conclusion') || section.toLowerCase().includes('summary')
    );

    const structureBonus = hasConclusion ? 25 : 0;

    // Add points for reinforcement
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const reinforcementBonus = Math.min(25, codeBlocks.length * 3);

    return Math.min(100, elementScore + structureBonus + reinforcementBonus);
  }

  checkSpacedRepetition(content) {
    const repetitionIndicators = [
      'remember that', 'as we discussed', 'earlier we saw', 'building on'
    ];

    return repetitionIndicators.some(indicator =>
      content.toLowerCase().includes(indicator)
    );
  }

  countContextVariations(content) {
    // Count different contexts where concepts are applied
    const contexts = [
      'in production', 'for development', 'at scale', 'in teams',
      'for security', 'for performance', 'in enterprise'
    ];

    return contexts.filter(context => content.toLowerCase().includes(context)).length;
  }

  checkProgressiveDisclosure(content) {
    const indicators = [
      'we\'ll cover later', 'in the next section', 'advanced topic'
    ];

    return indicators.some(indicator => content.toLowerCase().includes(indicator));
  }

  identifyRetentionStrategies(content) {
    const strategies = [];

    if (content.includes('pattern')) strategies.push('Pattern recognition');
    if (content.includes('template')) strategies.push('Template usage');
    if (content.includes('mnemonic') || content.includes('remember as')) strategies.push('Mnemonics');
    if (content.includes('analogy')) strategies.push('Analogies');
    if (content.includes('repeat') || content.includes('practice')) strategies.push('Repetition');
    if (content.includes('summary') || content.includes('recap')) strategies.push('Summarization');

    return strategies;
  }

  calculateContentVariety(content) {
    const contentTypes = [
      { pattern: /```[\s\S]*?```/g, type: 'code' },
      { pattern: /!\[.*\]/g, type: 'images' },
      { pattern: /```dot/g, type: 'diagrams' },
      { pattern: /```mermaid/g, type: 'flowcharts' },
      { pattern: /^\s*[-*+]/gm, type: 'lists' },
      { pattern: /^\s*\d+\./gm, type: 'numbered_lists' }
    ];

    const foundTypes = contentTypes.filter(({ pattern }) => content.match(pattern));
    return Math.min(1, foundTypes.length / contentTypes.length);
  }

  assessUserFriendlyLanguage(content) {
    const friendlyIndicators = [
      'think of it as', 'imagine', 'let\'s', 'we\'ll', 'you\'ll',
      'simple', 'easy', 'straightforward'
    ];

    const complexIndicators = [
      'complex', 'complicated', 'difficult', 'advanced concept'
    ];

    const friendlyCount = friendlyIndicators.reduce((count, indicator) => {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = content.match(regex) || [];
      return count + matches.length;
    }, 0);

    const complexCount = complexIndicators.reduce((count, indicator) => {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = content.match(regex) || [];
      return count + matches.length;
    }, 0);

    return friendlyCount > complexCount;
  }

  estimateReadingTime(content) {
    const words = content.split(/\s+/).length;
    const avgReadingSpeed = 250; // words per minute
    return Math.ceil(words / avgReadingSpeed / 60); // hours
  }

  estimatePracticeTime(content) {
    const exercises = (content.match(/exercise|try this|practice/gi) || []).length;
    const codeExamples = (content.match(/```[\s\S]*?```/g) || []).length;

    return Math.ceil((exercises * 0.5) + (codeExamples * 0.25)); // hours
  }

  assessMarketDemand(content) {
    const demandKeywords = [
      'in demand', 'job market', 'career', 'salary', 'industry',
      'popular', 'widely used', 'standard', 'enterprise'
    ];

    return demandKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  estimateTimeToMastery(content, timeInvestment) {
    const complexity = this.calculateTechnicalDensity(content);
    const practiceContent = this.estimatePracticeTime(content);

    // Base time + complexity modifier + practice requirements
    return Math.ceil(timeInvestment.totalTime * (1 + complexity/50) + practiceContent);
  }

  estimatePracticalApplicationRate(content) {
    const practicalIndicators = [
      'real-world', 'practical', 'hands-on', 'use case', 'scenario',
      'project', 'build', 'create', 'implement'
    ];

    const indicatorCount = practicalIndicators.reduce((count, indicator) => {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = content.match(regex) || [];
      return count + matches.length;
    }, 0);

    return Math.min(100, indicatorCount * 5);
  }

  estimateKnowledgeLifespan(content) {
    const timelessnessIndicators = [
      'fundamental', 'core concept', 'principle', 'pattern', 'best practice'
    ];

    const hasTimelessContent = timelessnessIndicators.some(indicator =>
      content.toLowerCase().includes(indicator)
    );

    return hasTimelessContent ? 24 : 12; // months
  }

  assessTransferability(content) {
    const transferKeywords = [
      'adaptable', 'flexible', 'portable', 'universal', 'general',
      'framework', 'pattern', 'template', 'approach'
    ];

    const keywordCount = transferKeywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex) || [];
      return count + matches.length;
    }, 0);

    return Math.min(100, keywordCount * 8);
  }

  calculateEstimatedROI(valueScore, timeInvestment) {
    // Simplified ROI calculation based on value vs time investment
    const hourlyValue = 50; // Assumed $50/hour value
    const skillValueMultiplier = valueScore / 100;
    const totalValue = timeInvestment * hourlyValue * skillValueMultiplier * 3; // 3x value multiplier

    return totalValue / (timeInvestment * hourlyValue);
  }

  estimateCompletionRate(engagementScore, motivation) {
    const motivationScore = Object.values(motivation).filter(Boolean).length * 25;
    const combinedScore = (engagementScore + motivationScore) / 2;

    return Math.min(100, combinedScore);
  }

  generateLearningReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📓 LEARNING EFFECTIVENESS METRICS REPORT');
    console.log('='.repeat(60));

    // Calculate overall learning effectiveness score
    const categoryScores = [
      this.metrics.structure?.score || 0,
      this.metrics.progression?.score || 0,
      this.metrics.comprehension?.score || 0,
      this.metrics.practical?.score || 0,
      this.metrics.retention?.score || 0,
      this.metrics.engagement?.score || 0,
      this.metrics.roi?.score || 0
    ];

    const overallScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;

    console.log(`\n🎯 Overall Learning Effectiveness: ${overallScore.toFixed(1)}/100`);

    console.log(`\n📊 Category Scores:`);
    console.log(`  🏗️  Structure: ${(this.metrics.structure?.score || 0).toFixed(1)}/100`);
    console.log(`  📈 Progression: ${(this.metrics.progression?.score || 0).toFixed(1)}/100`);
    console.log(`  🧠 Comprehension: ${(this.metrics.comprehension?.score || 0).toFixed(1)}/100`);
    console.log(`  🛠️  Practical: ${(this.metrics.practical?.score || 0).toFixed(1)}/100`);
    console.log(`  🧠 Retention: ${(this.metrics.retention?.score || 0).toFixed(1)}/100`);
    console.log(`  🎯 Engagement: ${(this.metrics.engagement?.score || 0).toFixed(1)}/100`);
    console.log(`  💰 ROI: ${(this.metrics.roi?.score || 0).toFixed(1)}/100`);

    // Key insights
    console.log(`\n💡 Key Learning Insights:`);
    if (this.metrics.progression?.hasBeginnerContent && this.metrics.progression?.hasAdvancedContent) {
      console.log(`  ✅ Comprehensive learning progression from beginner to advanced`);
    }
    if (this.metrics.practical?.metrics?.practiceFiles > 0) {
      console.log(`  ✅ Includes ${this.metrics.practical.metrics.practiceFiles} practical files for hands-on learning`);
    }
    if (this.metrics.engagement?.estimatedCompletionRate > 75) {
      console.log(`  ✅ High estimated completion rate (${this.metrics.engagement.estimatedCompletionRate.toFixed(1)}%)`);
    }
    if ((this.metrics.roi?.estimatedROI || 0) > 3) {
      console.log(`  ✅ Strong learning ROI (${this.metrics.roi.estimatedROI.toFixed(1)}x time investment)`);
    }

    // Recommendations
    console.log(`\n🔧 Recommendations:`);
    const structureRecs = this.metrics.structure?.recommendations || [];
    if (structureRecs.length > 0) {
      structureRecs.slice(0, 3).forEach(rec => console.log(`  • ${rec}`));
    }

    if (overallScore < 80) {
      console.log(`  • Consider adding more practical examples and hands-on exercises`);
      console.log(`  • Improve content organization with clearer learning progression`);
      console.log(`  • Add more engagement elements to maintain learner interest`);
    }

    // Overall assessment
    let assessment;
    if (overallScore >= 90) {
      assessment = '🏆 EXCELLENT - Outstanding learning experience with comprehensive coverage';
    } else if (overallScore >= 80) {
      assessment = '✅ GOOD - Effective learning structure with room for minor improvements';
    } else if (overallScore >= 70) {
      assessment = '⚠️  FAIR - Learning structure needs significant enhancements';
    } else {
      assessment = '❌ POOR - Major learning structure issues require attention';
    }

    console.log(`\n📋 Overall Assessment: ${assessment}`);

    return {
      overallScore,
      categories: this.metrics,
      insights: this.generateInsights(),
      recommendations: this.generateRecommendations(),
      assessment,
      ready: overallScore >= 75
    };
  }

  generateInsights() {
    const insights = [];

    if (this.metrics.progression?.hasBeginnerContent && this.metrics.progression?.hasAdvancedContent) {
      insights.push('Comprehensive skill progression from basic to advanced topics');
    }

    if (this.metrics.comprehension?.readability > 80) {
      insights.push('High readability score indicates clear, accessible content');
    }

    if (this.metrics.practical?.workflows?.completeness > 0.8) {
      insights.push('Well-structured workflows with high completeness scores');
    }

    if (this.metrics.engagement?.estimatedCompletionRate > 75) {
      insights.push('High learner engagement predicted by content structure');
    }

    return insights;
  }

  generateRecommendations() {
    const recommendations = [];
    const structureRecs = this.metrics.structure?.recommendations || [];

    recommendations.push(...structureRecs);

    if ((this.metrics.practical?.score || 0) < 70) {
      recommendations.push('Increase practical, hands-on content with real-world examples');
    }

    if ((this.metrics.retention?.score || 0) < 70) {
      recommendations.push('Add more retention-focused elements like summaries and quick references');
    }

    if ((this.metrics.engagement?.score || 0) < 70) {
      recommendations.push('Enhance engagement with interactive elements and varied content types');
    }

    return recommendations;
  }
}

module.exports = LearningEffectivenessMetrics;