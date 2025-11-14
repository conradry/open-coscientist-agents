/**
 * AI Response Processing and Formatting
 *
 * Comprehensive response handling for different AI models and use cases
 */

/**
 * Response Handler Class
 */
export class ResponseHandler {
  constructor(options = {}) {
    this.options = {
      enableFormatting: true,
      enableValidation: true,
      enableCaching: true,
      enableMetrics: true,
      defaultFormat: 'json',
      ...options
    };

    this.formatters = new Map();
    this.validators = new Map();
    this.cache = new Map();
    this.metrics = new Map();
  }

  /**
   * Process AI response with formatting and validation
   */
  async processResponse(response, options = {}) {
    const {
      format = this.options.defaultFormat,
      validate = this.options.enableValidation,
      formatOptions = {},
      metadata = {}
    } = options;

    try {
      let processed = response;

      // Format response
      if (this.options.enableFormatting) {
        processed = await this.formatResponse(processed, format, formatOptions);
      }

      // Validate response
      if (validate && this.options.enableValidation) {
        const validation = await this.validateResponse(processed, format);
        if (!validation.valid) {
          throw new Error(`Response validation failed: ${validation.errors.join(', ')}`);
        }
        processed.validation = validation;
      }

      // Cache response
      if (this.options.enableCaching && metadata.cacheKey) {
        this.cache.set(metadata.cacheKey, {
          response: processed,
          timestamp: Date.now(),
          ttl: metadata.cacheTtl || 3600
        });
      }

      // Log metrics
      if (this.options.enableMetrics) {
        this.logMetrics({
          format,
          success: true,
          processingTime: metadata.processingTime,
          model: metadata.model,
          ...metadata
        });
      }

      return {
        success: true,
        data: processed,
        format,
        metadata
      };

    } catch (error) {
      if (this.options.enableMetrics) {
        this.logMetrics({
          format,
          success: false,
          error: error.message,
          ...metadata
        });
      }

      throw error;
    }
  }

  /**
   * Format response based on specified format
   */
  async formatResponse(response, format, options = {}) {
    const formatter = this.formatters.get(format);
    if (formatter) {
      return await formatter(response, options);
    }

    // Default formatters
    switch (format) {
      case 'json':
        return this.formatAsJson(response, options);
      case 'text':
        return this.formatAsText(response, options);
      case 'markdown':
        return this.formatAsMarkdown(response, options);
      case 'html':
        return this.formatAsHtml(response, options);
      case 'csv':
        return this.formatAsCsv(response, options);
      case 'xml':
        return this.formatAsXml(response, options);
      case 'stream':
        return this.formatAsStream(response, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Format response as JSON
   */
  formatAsJson(response, options = {}) {
    const {
      pretty = false,
      includeMetadata = false,
      customFields = []
    } = options;

    let formatted = {
      success: true,
      data: this.extractData(response),
      timestamp: new Date().toISOString()
    };

    if (includeMetadata) {
      formatted.metadata = this.extractMetadata(response);
    }

    // Add custom fields
    customFields.forEach(field => {
      formatted[field.name] = response[field.source] || field.value;
    });

    return JSON.stringify(formatted, null, pretty ? 2 : 0);
  }

  /**
   * Format response as plain text
   */
  formatAsText(response, options = {}) {
    const {
      includeMetadata = false,
      separator = '\\n',
      prefix = '',
      suffix = ''
    } = options;

    let text = prefix;

    // Extract main content
    if (typeof response === 'string') {
      text += response;
    } else if (response.response) {
      text += response.response;
    } else if (response.data) {
      text += typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }

    if (includeMetadata) {
      text += separator + '--- Metadata ---' + separator;
      const metadata = this.extractMetadata(response);
      Object.entries(metadata).forEach(([key, value]) => {
        text += `${key}: ${value}${separator}`;
      });
    }

    return text + suffix;
  }

  /**
   * Format response as Markdown
   */
  formatAsMarkdown(response, options = {}) {
    const {
      title = 'AI Response',
      includeMetadata = true,
      codeBlocks = true
    } = options;

    let markdown = `# ${title}\\n\\n`;

    // Main content
    const content = this.extractData(response);
    if (typeof content === 'string') {
      // Check if content looks like code
      if (codeBlocks && this.looksLikeCode(content)) {
        const language = this.detectLanguage(content);
        markdown += `\\`\\`\\`${language}\\n${content}\\n\\`\\`\\`\\n\\n`;
      } else {
        markdown += `${content}\\n\\n`;
      }
    } else {
      markdown += `\\`\\`\\`json\\n${JSON.stringify(content, null, 2)}\\n\\`\\`\\`\\n\\n`;
    }

    // Metadata
    if (includeMetadata) {
      markdown += '## Response Metadata\\n\\n';
      const metadata = this.extractMetadata(response);
      Object.entries(metadata).forEach(([key, value]) => {
        markdown += `- **${key}**: ${value}\\n`;
      });
    }

    return markdown;
  }

  /**
   * Format response as HTML
   */
  formatAsHtml(response, options = {}) {
    const {
      title = 'AI Response',
      includeMetadata = true,
      theme = 'default'
    } = options;

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${this.getHtmlTheme(theme)}</style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${title}</h1>
        </header>
        <main class="response-content">`;

    const content = this.extractData(response);
    if (typeof content === 'string') {
      if (this.looksLikeCode(content)) {
        html += `<pre><code class="code-block">${this.escapeHtml(content)}</code></pre>`;
      } else {
        html += `<div class="text-content">${this.formatAsHtmlParagraphs(content)}</div>`;
      }
    } else {
      html += `<pre><code class="json-block">${this.escapeHtml(JSON.stringify(content, null, 2))}</code></pre>`;
    }

    html += `</main>`;

    if (includeMetadata) {
      html += `<aside class="metadata">
        <h2>Metadata</h2>
        <dl>`;

      const metadata = this.extractMetadata(response);
      Object.entries(metadata).forEach(([key, value]) => {
        html += `<dt>${key}</dt><dd>${this.escapeHtml(String(value))}</dd>`;
      });

      html += `</dl></aside>`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Format response as CSV
   */
  formatAsCsv(response, options = {}) {
    const {
      headers = [],
      delimiter = ',',
      includeHeader = true
    } = options;

    const data = this.extractData(response);
    let csv = '';

    // Handle array data
    if (Array.isArray(data)) {
      if (includeHeader && headers.length === 0) {
        // Auto-detect headers from first object
        headers.push(...Object.keys(data[0] || {}));
      }

      if (includeHeader) {
        csv += headers.join(delimiter) + '\\n';
      }

      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        csv += values.join(delimiter) + '\\n';
      });

      return csv;
    }

    // Handle single object
    if (typeof data === 'object' && data !== null) {
      const objectHeaders = headers.length > 0 ? headers : Object.keys(data);

      if (includeHeader) {
        csv += objectHeaders.join(delimiter) + '\\n';
      }

      const values = objectHeaders.map(header => {
        const value = data[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csv += values.join(delimiter) + '\\n';

      return csv;
    }

    // Handle primitive value
    return `"${String(data).replace(/"/g, '""')}"`;
  }

  /**
   * Format response as XML
   */
  formatAsXml(response, options = {}) {
    const {
      rootElement = 'response',
      includeMetadata = true
    } = options;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\\n<${rootElement}>\\n`;

    // Add timestamp
    xml += `  <timestamp>${new Date().toISOString()}</timestamp>\\n`;

    // Add data
    xml += `  <data>\\n`;
    xml += this.objectToXml(this.extractData(response), '    ');
    xml += `  </data>\\n`;

    // Add metadata
    if (includeMetadata) {
      xml += `  <metadata>\\n`;
      const metadata = this.extractMetadata(response);
      xml += this.objectToXml(metadata, '    ');
      xml += `  </metadata>\\n`;
    }

    xml += `</${rootElement}>`;
    return xml;
  }

  /**
   * Format response for streaming
   */
  formatAsStream(response, options = {}) {
    const {
      chunkSize = 1024,
      delimiter = '\\n',
      prefix = 'data: ',
      suffix = '\\n\\n'
    } = options;

    const content = this.extractData(response);
    const text = typeof content === 'string' ? content : JSON.stringify(content);

    return {
      stream: true,
      chunks: this.createStreamChunks(text, chunkSize),
      delimiter,
      prefix,
      suffix,
      totalChunks: Math.ceil(text.length / chunkSize)
    };
  }

  /**
   * Validate response format
   */
  async validateResponse(response, format) {
    const validator = this.validators.get(format);
    if (validator) {
      return await validator(response);
    }

    // Default validation
    switch (format) {
      case 'json':
        return this.validateJson(response);
      case 'text':
        return this.validateText(response);
      case 'csv':
        return this.validateCsv(response);
      default:
        return { valid: true, errors: [] };
    }
  }

  /**
   * Extract data from response
   */
  extractData(response) {
    if (typeof response === 'string') {
      return response;
    }

    if (response.response) {
      return response.response;
    }

    if (response.data) {
      return response.data;
    }

    if (response.choices && response.choices[0]) {
      return response.choices[0].message?.content || response.choices[0].text;
    }

    return response;
  }

  /**
   * Extract metadata from response
   */
  extractMetadata(response) {
    const metadata = {};

    // Token usage
    if (response.usage) {
      metadata.promptTokens = response.usage.prompt_tokens;
      metadata.completionTokens = response.usage.completion_tokens;
      metadata.totalTokens = response.usage.total_tokens;
    }

    // Model information
    if (response.model) {
      metadata.model = response.model;
    }

    // Timing information
    if (response.processingTime) {
      metadata.processingTime = response.processingTime;
    }

    // Response ID
    if (response.id) {
      metadata.id = response.id;
    }

    // Object ID
    if (response.object) {
      metadata.object = response.object;
    }

    // Finish reason
    if (response.finish_reason) {
      metadata.finishReason = response.finish_reason;
    }

    return metadata;
  }

  /**
   * Check if content looks like code
   */
  looksLikeCode(content) {
    const codePatterns = [
      /function\\s+\\w+\\s*\\(/,
      /class\\s+\\w+/,
      /import\\s+.*from/,
      /#include\\s*</,
      /def\\s+\\w+\\s*\\(/,
      /public\\s+class/,
      /<\\?php/,
      /#!/usr/bin/env/,
      /```[\\w]*\\n/,
      /\\{[\\s\\S]*\\}/
    ];

    return codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect programming language
   */
  detectLanguage(code) {
    const languagePatterns = {
      'javascript': [/function\\s+/, /const\\s+/, /let\\s+/, /=>/],
      'python': [/def\\s+/, /import\\s+/, /print\\s*\\(/, /class\\s+:/],
      'java': [/public\\s+class/, /public\\s+static\\s+void/, /System\\.out/],
      'cpp': [/#include\\s*</, /std::/, /using\\s+namespace/],
      'php': [/<\\?php/, /\\$\\w+/, /echo\\s+/],
      'ruby': [/def\\s+/, /class\\s+</, /puts\\s+/],
      'go': [/package\\s+main/, /func\\s+/, /import\\s+\\(/],
      'rust': [/fn\\s+/, /let\\s+mut/, /use\\s+std::/],
      'sql': [/SELECT\\s+/, /FROM\\s+/, /WHERE\\s+/i]
    };

    for (const [language, patterns] of Object.entries(languagePatterns)) {
      if (patterns.some(pattern => pattern.test(code))) {
        return language;
      }
    }

    return 'text';
  }

  /**
   * Get HTML theme styles
   */
  getHtmlTheme(theme) {
    const themes = {
      default: `
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; }
        .response-content { margin-bottom: 30px; }
        .code-block { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; overflow-x: auto; }
        .text-content { line-height: 1.6; color: #333; }
        .metadata { background: #f8f9fa; padding: 20px; border-radius: 6px; }
        .metadata h2 { margin-top: 0; color: #666; }
        .metadata dt { font-weight: bold; color: #333; }
        .metadata dd { margin: 5px 0 15px; color: #666; }
      `,
      dark: `
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #e0e0e0; }
        .container { max-width: 800px; margin: 0 auto; background: #2d2d2d; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
        h1 { color: #ffffff; margin-bottom: 30px; }
        .response-content { margin-bottom: 30px; }
        .code-block { background: #1e1e1e; border: 1px solid #444; border-radius: 4px; padding: 15px; overflow-x: auto; }
        .text-content { line-height: 1.6; color: #e0e0e0; }
        .metadata { background: #1e1e1e; padding: 20px; border-radius: 6px; }
        .metadata h2 { margin-top: 0; color: #ffffff; }
        .metadata dt { font-weight: bold; color: #ffffff; }
        .metadata dd { margin: 5px 0 15px; color: #b0b0b0; }
      `
    };

    return themes[theme] || themes.default;
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format text as HTML paragraphs
   */
  formatAsHtmlParagraphs(text) {
    return text
      .split('\\n\\n')
      .map(paragraph => `<p>${paragraph.replace(/\\n/g, '<br>')}</p>`)
      .join('\\n');
  }

  /**
   * Convert object to XML
   */
  objectToXml(obj, indent = '') {
    if (typeof obj !== 'object' || obj === null) {
      return `${indent}<value>${obj}</value>\\n`;
    }

    let xml = '';
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        xml += `${indent}<item index="${index}">\\n`;
        xml += this.objectToXml(item, indent + '  ');
        xml += `${indent}</item>\\n`;
      });
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          xml += `${indent}<${key}>\\n`;
          xml += this.objectToXml(value, indent + '  ');
          xml += `${indent}</${key}>\\n`;
        } else {
          xml += `${indent}<${key}>${value}</${key}>\\n`;
        }
      });
    }

    return xml;
  }

  /**
   * Create streaming chunks
   */
  createStreamChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Validate JSON response
   */
  validateJson(response) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      return { valid: true, errors: [], data: parsed };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Validate text response
   */
  validateText(response) {
    const errors = [];
    if (typeof response !== 'string') {
      errors.push('Response is not a string');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate CSV response
   */
  validateCsv(response) {
    const errors = [];
    const text = typeof response === 'string' ? response : String(response);

    if (!text.includes(',')) {
      errors.push('Response does not contain CSV delimiters');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Log performance metrics
   */
  logMetrics(data) {
    const key = `${data.format}:${data.model || 'unknown'}`;
    const current = this.metrics.get(key) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalProcessingTime: 0,
      errors: []
    };

    current.totalRequests++;
    if (data.success) {
      current.successfulRequests++;
      current.totalProcessingTime += data.processingTime || 0;
    } else {
      current.errors.push({
        timestamp: Date.now(),
        error: data.error
      });
    }

    this.metrics.set(key, current);
  }
}

/**
 * Response Builder for structured responses
 */
export class ResponseBuilder {
  constructor() {
    this.response = {
      success: true,
      timestamp: new Date().toISOString(),
      data: null,
      metadata: {},
      errors: []
    };
  }

  setData(data) {
    this.response.data = data;
    return this;
  }

  addMetadata(key, value) {
    this.response.metadata[key] = value;
    return this;
  }

  addError(message, code = null) {
    this.response.errors.push({ message, code });
    this.response.success = false;
    return this;
  }

  setSuccess(success) {
    this.response.success = success;
    return this;
  }

  build() {
    return this.response;
  }
}

// Export default handler instance
export const defaultHandler = new ResponseHandler();