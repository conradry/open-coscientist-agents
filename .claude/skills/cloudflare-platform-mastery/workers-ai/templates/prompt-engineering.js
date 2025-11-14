/**
 * Prompt Engineering Patterns and Templates
 *
 * Comprehensive prompt engineering strategies for optimal AI responses
 */

/**
 * Prompt Template System
 */
export class PromptTemplate {
  constructor(template, variables = {}) {
    this.template = template;
    this.variables = variables;
  }

  /**
   * Fill template with variables
   */
  fill(variables = {}) {
    let prompt = this.template;

    // Replace {{variable}} patterns
    Object.entries({ ...this.variables, ...variables }).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      prompt = prompt.replace(regex, value);
    });

    return prompt;
  }

  /**
   * Validate required variables
   */
  validate() {
    const required = this.extractRequiredVariables();
    return required.every(var => this.variables[var]);
  }

  /**
   * Extract variables from template
   */
  extractRequiredVariables() {
    const regex = /{{\\s*([^}]+)\\s*}}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(this.template)) !== null) {
      variables.push(match[1].trim());
    }

    return variables;
  }
}

/**
 * Pre-built Prompt Templates
 */
export const PROMPT_TEMPLATES = {
  // System Prompts
  SYSTEM: {
    helpfulAssistant: new PromptTemplate(`
You are a helpful AI assistant. Your role is to provide accurate, helpful, and thoughtful responses.

Guidelines:
- Be clear and concise
- Provide factual information when possible
- Acknowledge limitations when unsure
- Be friendly and professional
- Ask clarifying questions when needed

Context: {{context}}
Current task: {{task}}
    `),

    codeAssistant: new PromptTemplate(`
You are an expert programming assistant with deep knowledge of multiple programming languages and best practices.

Guidelines:
- Write clean, efficient, and well-documented code
- Follow language-specific conventions and best practices
- Explain complex concepts clearly
- Provide error handling and edge case considerations
- Suggest optimizations when relevant

Language: {{language}}
Framework: {{framework}}
Task: {{task}}
Requirements: {{requirements}}
    `),

    creativeWriter: new PromptTemplate(`
You are a creative writer with expertise in various genres and styles.

Guidelines:
- Be imaginative and engaging
- Maintain consistent tone and voice
- Create vivid descriptions and compelling narratives
- Adapt style to the genre and audience
- Show rather than tell when possible

Genre: {{genre}}
Audience: {{audience}}
Topic: {{topic}}
Style: {{style}}
    `),

    analyst: new PromptTemplate(`
You are a data analyst and strategic thinker who excels at breaking down complex information and providing actionable insights.

Guidelines:
- Think step-by-step and show your reasoning
- Consider multiple perspectives and edge cases
- Base conclusions on evidence and logic
- Identify patterns and trends
- Provide clear, actionable recommendations

Data/Context: {{data}}
Analysis Goal: {{goal}}
Timeframe: {{timeframe}}
    `),

    translator: new PromptTemplate(`
You are a professional translator with expertise in multiple languages and cultural contexts.

Guidelines:
- Maintain the original meaning and tone
- Adapt idioms and cultural references appropriately
- Consider the target audience and context
- Preserve formatting and structure when relevant
- Handle technical terms accurately

Source Language: {{source_lang}}
Target Language: {{target_lang}}
Context: {{context}}
Text: {{text}}
    `)
  },

  // Task-Specific Prompts
  TASKS: {
    summarization: new PromptTemplate(`
Summarize the following text according to the specified requirements.

Original Text Length: {{original_length}}
Target Summary Length: {{summary_length}}
Focus Areas: {{focus_areas}}
Tone: {{tone}}

Text to Summarize:
{{text}}

Summary:
    `),

    classification: new PromptTemplate(`
Classify the following text according to the provided categories.

Available Categories: {{categories}}
Classification Criteria: {{criteria}}
Confidence Level: {{confidence}}

Text: "{{text}}"

Classification:
    `),

    extraction: new PromptTemplate(`
Extract the specified information from the following text.

Information to Extract: {{extraction_items}}
Format: {{format}}
Context: {{context}}

Text:
{{text}}

Extracted Information:
    `),

    comparison: new PromptTemplate(`
Compare and contrast the following items according to the specified criteria.

Items to Compare: {{items}}
Comparison Criteria: {{criteria}}
Comparison Format: {{format}}
Focus Areas: {{focus_areas}}

Analysis:
{{analysis}}

Comparison:
    `),

    problemSolving: new PromptTemplate(`
Solve the following problem using a systematic approach.

Problem Statement: {{problem}}
Constraints: {{constraints}}
Available Resources: {{resources}}
Expected Output: {{expected_output}}

Please provide:
1. Problem Analysis
2. Proposed Solution(s)
3. Implementation Steps
4. Potential Challenges
5. Alternative Approaches

Solution:
    `),

    codeReview: new PromptTemplate(`
Review the following code for quality, security, and best practices.

Language: {{language}}
Code Type: {{code_type}}
Review Focus Areas: {{focus_areas}}

Code:
{{code}}

Please provide:
1. Overall Assessment
2. Security Issues
3. Performance Considerations
4. Best Practices Violations
5. Improvement Suggestions
6. Code Quality Rating (1-10)

Review:
    `),

    contentCreation: new PromptTemplate(`
Create high-quality content based on the following specifications.

Content Type: {{content_type}}
Target Audience: {{audience}}
Key Points to Cover: {{key_points}}
Tone of Voice: {{tone}}
Length: {{length}}
Style Guidelines: {{style_guidelines}}

Additional Requirements: {{additional_requirements}}

Content:
    `),

    questionAnswering: new PromptTemplate(`
Answer the following question based on the provided context.

Question: {{question}}
Context: {{context}}
Answer Type: {{answer_type}}
Detail Level: {{detail_level}}

Instructions:
- Use only the provided context for factual information
- Indicate when the answer cannot be determined from the context
- Provide clear, direct answers
- Include relevant details from the context

Answer:
    `),

    creativeBrainstorming: new PromptTemplate(`
Generate creative ideas based on the following prompt.

Topic/Challenge: {{topic}}
Creative Constraints: {{constraints}}
Inspiration Sources: {{inspiration}}
Number of Ideas: {{num_ideas}}
Idea Categories: {{categories}}

Instructions:
- Think outside the box
- Combine different concepts
- Consider practical implementation
- Include both conventional and innovative ideas

Brainstorming Session:
    `)
  },

  // Chain of Thought Prompts
  CHAIN_OF_THOUGHT: {
    reasoning: new PromptTemplate(`
Think step-by-step to solve this problem. Show your reasoning process.

Problem: {{problem}}

Let's break this down:
1.

2.

3.

Final Answer:
    `),

    analysis: new PromptTemplate(`
Analyze this situation by breaking it down into logical components.

Situation: {{situation}}

Step 1: Identify the key elements
-

Step 2: Analyze relationships between elements
-

Step 3: Consider implications and consequences
-

Step 4: Synthesize findings
-

Conclusion:
    `),

    debugging: new PromptTemplate(`
Help debug this issue by following a systematic approach.

Issue: {{issue}}
Code: {{code}}
Error Message: {{error}}

Step 1: Understand the problem
-

Step 2: Identify potential causes
-

Step 3: Test hypotheses
-

Step 4: Propose solutions
-

Step 5: Verify the fix
-

Solution:
    `)
  }
};

/**
 * Prompt Optimization Strategies
 */
export class PromptOptimizer {
  constructor() {
    this.successMetrics = new Map();
  }

  /**
   * Optimize prompt for specific model
   */
  optimizePrompt(template, modelType, taskType) {
    let optimized = template;

    switch (modelType) {
      case 'instruct':
        optimized = this.addInstructFormatting(optimized, taskType);
        break;
      case 'completion':
        optimized = this.addCompletionFormatting(optimized, taskType);
        break;
      case 'chat':
        optimized = this.addChatFormatting(optimized, taskType);
        break;
    }

    return optimized;
  }

  /**
   * Add instruction formatting
   */
  addInstructFormatting(prompt, taskType) {
    const formatMap = {
      'summarization': 'INSTRUCTION: ',
      'classification': 'TASK: ',
      'generation': 'PROMPT: ',
      'analysis': 'ANALYZE: ',
      'default': 'Please respond to the following: '
    };

    const prefix = formatMap[taskType] || formatMap.default;
    return `${prefix}${prompt}`;
  }

  /**
   * Add completion formatting
   */
  addCompletionFormatting(prompt, taskType) {
    // For completion models, ensure clear continuation point
    if (!prompt.endsWith(':') && !prompt.endsWith('.')) {
      return `${prompt}:`;
    }
    return prompt;
  }

  /**
   * Add chat formatting
   */
  addChatFormatting(prompt, taskType) {
    // Format for chat models with clear roles
    return `[INST] ${prompt} [/INST]`;
  }

  /**
   * Add few-shot examples
   */
  addFewShotExamples(prompt, examples) {
    const examplesText = examples.map(ex =>
      `Input: ${ex.input}\\nOutput: ${ex.output}`
    ).join('\\n\\n');

    return `Here are some examples:\\n\\n${examplesText}\\n\\nNow, respond to this:\\n\\n${prompt}`;
  }

  /**
   * Add constraints and guidelines
   */
  addConstraints(prompt, constraints) {
    const constraintsText = Object.entries(constraints)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\\n');

    return `${prompt}\\n\\nConstraints:\\n${constraintsText}`;
  }

  /**
   * Track prompt performance
   */
  trackPerformance(promptId, success, quality, latency) {
    const current = this.successMetrics.get(promptId) || {
      attempts: 0,
      successes: 0,
      totalQuality: 0,
      totalLatency: 0
    };

    current.attempts++;
    if (success) current.successes++;
    current.totalQuality += quality;
    current.totalLatency += latency;

    this.successMetrics.set(promptId, {
      ...current,
      successRate: current.successes / current.attempts,
      avgQuality: current.totalQuality / current.attempts,
      avgLatency: current.totalLatency / current.attempts
    });
  }
}

/**
 * Prompt Security and Safety
 */
export class PromptSecurity {
  /**
   * Detect and prevent prompt injection
   */
  sanitizePrompt(prompt) {
    // Remove potential injection patterns
    const injectionPatterns = [
      /ignore\\s+previous\\s+instructions/gi,
      /system\\s*:/gi,
      /\\[INST\\].*?\\[\\/INST\\]/gs,
      /\\[\\/.+?\\]/gs,
      /<<.+?>>/g
    ];

    let sanitized = prompt;
    injectionPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Validate prompt content
   */
  validatePrompt(prompt, rules = {}) {
    const {
      maxLength = 10000,
      minLength = 10,
      allowedPatterns = [],
      blockedPatterns = []
    } = rules;

    const issues = [];

    if (prompt.length < minLength) {
      issues.push(`Prompt too short (minimum ${minLength} characters)`);
    }

    if (prompt.length > maxLength) {
      issues.push(`Prompt too long (maximum ${maxLength} characters)`);
    }

    // Check for blocked patterns
    blockedPatterns.forEach(pattern => {
      if (new RegExp(pattern, 'i').test(prompt)) {
        issues.push(`Contains blocked content: ${pattern}`);
      }
    });

    // Check required patterns
    allowedPatterns.forEach(pattern => {
      if (!new RegExp(pattern, 'i').test(prompt)) {
        issues.push(`Missing required content: ${pattern}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Add safety guidelines to prompts
   */
  addSafetyGuidelines(prompt, context = {}) {
    const { sensitiveContent = false, privacyLevel = 'standard' } = context;

    let safetyPrompt = prompt;

    if (sensitiveContent) {
      safetyPrompt = `\\n\\nIMPORTANT: Handle sensitive information with appropriate care and follow all relevant privacy regulations.\\n\\n${prompt}`;
    }

    if (privacyLevel === 'high') {
      safetyPrompt = `\\n\\nPRIVACY NOTICE: Do not include any personal identifiable information in your response.\\n\\n${prompt}`;
    }

    return safetyPrompt;
  }
}

/**
 * Prompt Testing Framework
 */
export class PromptTester {
  constructor() {
    this.testSuites = new Map();
  }

  /**
   * Create test suite for prompt
   */
  createTestSuite(promptId, testCases) {
    this.testSuites.set(promptId, {
      testCases,
      results: [],
      lastRun: null
    });
  }

  /**
   * Run test suite
   */
  async runTestSuite(promptId, testFunction) {
    const suite = this.testSuites.get(promptId);
    if (!suite) throw new Error(`Test suite not found: ${promptId}`);

    const results = [];

    for (const testCase of suite.testCases) {
      try {
        const result = await testFunction(testCase);
        results.push({
          ...testCase,
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          ...testCase,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    suite.results = results;
    suite.lastRun = new Date().toISOString();

    return {
      totalTests: suite.testCases.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Generate test cases automatically
   */
  generateTestCases(template, variations = {}) {
    const { numCases = 5, complexity = 'medium' } = variations;
    const testCases = [];

    for (let i = 0; i < numCases; i++) {
      testCase.push({
        id: `auto_${i}`,
        input: this.generateTestCaseInput(template, complexity),
        expected: this.generateExpectedOutput(template),
        metadata: {
          complexity,
          autoGenerated: true,
          variation: i
        }
      });
    }

    return testCases;
  }
}

// Export instances
export const promptOptimizer = new PromptOptimizer();
export const promptSecurity = new PromptSecurity();
export const promptTester = new PromptTester();

/**
 * Quick-start prompt templates
 */
export const QUICK_START = {
  // Simple classification
  simpleClassification: `
Classify this text: {{text}}

Categories: {{categories}}

Answer:
  `,

  // Basic summarization
  simpleSummarization: `
Summarize this: {{text}}

Summary:
  `,

  // Code generation
  codeGeneration: `
Write {{language}} code to: {{task}}

Code:
  `,

  // Question answering
  questionAnswer: `
Answer this question: {{question}}

Context: {{context}}

Answer:
  `,

  // Creative writing
  creativeWriting: `
Write a {{genre}} about {{topic}}.

Story:
  `
};