/**
 * Cloudflare Container Registry Dockerfile Template Generator
 *
 * This template generates production-ready Dockerfiles optimized for
 * Cloudflare Container Registry and Workers integration.
 */

const fs = require('fs');
const path = require('path');

class DockerfileTemplate {
  constructor(options = {}) {
    this.options = {
      baseImage: 'alpine:3.18',
      nodeVersion: '18-alpine',
      pythonVersion: '3.11-slim',
      workDir: '/app',
      user: 'appuser',
      port: 3000,
      multiStage: true,
      optimize: true,
      security: true,
      ...options
    };
  }

  generateNodeAppTemplate(appConfig = {}) {
    const config = {
      packageManager: 'npm',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      healthCheckPath: '/health',
      ...appConfig
    };

    let dockerfile = '';

    if (this.options.multiStage) {
      dockerfile += this.generateNodeMultiStage(config);
    } else {
      dockerfile += this.generateNodeSingleStage(config);
    }

    return this.addSecurityOptimizations(dockerfile);
  }

  generateNodeMultiStage(config) {
    return `# Multi-stage build for Node.js application
# Build stage
FROM node:${this.options.nodeVersion} AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR ${this.options.workDir}

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY yarn.lock* ./

# Install dependencies based on package manager
${this.getDependencyInstallCommand(config.packageManager, 'production')}

# Copy source code
COPY . .

# Build application
RUN ${config.buildCommand}

# Production stage
FROM node:${this.options.nodeVersion}-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S ${this.options.user} && \
    adduser -S ${this.options.user} -u 1001

# Set working directory
WORKDIR ${this.options.workDir}

# Copy dependencies from builder
COPY --from=builder --chown=${this.options.user}:${this.options.user} \
    ${this.options.workDir}/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=${this.options.user}:${this.options.user} \
    ${this.options.workDir}/dist ./dist
COPY --from=builder --chown=${this.options.user}:${this.options.user} \
    ${this.options.workDir}/public ./public
COPY --from=builder --chown=${this.options.user}:${this.options.user} \
    ${this.options.workDir}/package*.json ./

# Switch to non-root user
USER ${this.options.user}

# Expose port
EXPOSE ${this.options.port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${this.options.port}${config.healthCheckPath} || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]`;
  }

  generatePythonAppTemplate(appConfig = {}) {
    const config = {
      requirementsFile: 'requirements.txt',
      appModule: 'app.main',
      gunicornWorkers: 1,
      healthCheckPath: '/health',
      ...appConfig
    };

    return this.addSecurityOptimizations(`# Multi-stage build for Python application
# Build stage
FROM python:${this.options.pythonVersion} AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR ${this.options.workDir}

# Copy requirements and install dependencies
COPY ${config.requirementsFile} .
RUN pip install --no-cache-dir --user -r ${config.requirementsFile}

# Production stage
FROM python:${this.options.pythonVersion} AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash ${this.options.user}

# Set working directory
WORKDIR ${this.options.workDir}

# Copy dependencies from builder
COPY --from=builder /root/.local /home/${this.options.user}/.local

# Copy application code
COPY --chown=${this.options.user}:${this.options.user} . .

# Make sure scripts in .local are usable
ENV PATH=/home/${this.options.user}/.local/bin:$PATH

# Switch to non-root user
USER ${this.options.user}

# Expose port
EXPOSE ${this.options.port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${this.options.port}${config.healthCheckPath} || exit 1

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:${this.options.port}", "--workers", "${config.gunicornWorkers}", "${config.appModule}:app"]`);
  }

  generateStaticSiteTemplate(config = {}) {
    const {
      buildCommand = 'npm run build',
      outputDir = 'dist',
      nginxConfig = true
    } = config;

    if (nginxConfig) {
      return `# Static site with nginx
FROM node:18-alpine AS builder

WORKDIR ${this.options.workDir}
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN ${buildCommand}

FROM nginx:alpine AS production

# Copy custom nginx config if exists
COPY nginx.conf /etc/nginx/nginx.conf || true

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files
COPY --from=builder ${this.options.workDir}/${outputDir}/ /usr/share/nginx/html/

# Add startup script for Cloudflare Workers compatibility
COPY --from=builder ${this.options.workDir}/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]`;
    }

    return `# Simple static site server
FROM node:18-alpine AS builder

WORKDIR ${this.options.workDir}
COPY package*.json ./
RUN npm ci

COPY . .
RUN ${buildCommand}

FROM node:18-alpine AS production

# Install serve
RUN npm install -g serve

WORKDIR ${this.options.workDir}
COPY --from=builder ${this.options.workDir}/${outputDir} ./

EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]`;
  }

  getDependencyInstallCommand(packageManager, type = 'production') {
    const commands = {
      npm: type === 'production'
        ? 'RUN npm ci --only=production && npm cache clean --force'
        : 'RUN npm ci',
      yarn: type === 'production'
        ? 'RUN yarn install --production && yarn cache clean'
        : 'RUN yarn install',
      pnpm: type === 'production'
        ? 'RUN pnpm install --prod && pnpm store prune'
        : 'RUN pnpm install'
    };
    return commands[packageManager] || commands.npm;
  }

  addSecurityOptimizations(dockerfile) {
    if (!this.options.security) return dockerfile;

    return `${dockerfile}

# Security optimizations
RUN find ${this.options.workDir} -type f -executable -exec chmod -x {} + || true && \\
    find ${this.options.workDir} -type d -exec chmod 755 {} + || true && \\
    chown -R ${this.options.user}:${this.options.user} ${this.options.workDir}`;
  }

  // Generate optimized Dockerfile for Cloudflare Container Registry
  generateCFOptimizedTemplate(type, config = {}) {
    const templates = {
      'node': () => this.generateNodeAppTemplate(config),
      'python': () => this.generatePythonAppTemplate(config),
      'static': () => this.generateStaticSiteTemplate(config),
      'go': () => this.generateGoAppTemplate(config),
      'rust': () => this.generateRustAppTemplate(config),
      'java': () => this.generateJavaAppTemplate(config)
    };

    const template = templates[type];
    if (!template) {
      throw new Error(`Unsupported application type: ${type}`);
    }

    let dockerfile = template();

    // Add Cloudflare-specific optimizations
    dockerfile += `

# Cloudflare Container Registry optimizations
LABEL maintainer="Cloudflare Container Template" \\
      version="1.0" \\
      description="Optimized for Cloudflare Container Registry"

# Set environment variables for Cloudflare Workers integration
ENV CLOUDFLARE_WORKERS_INTEGRATION=true \\
    PORT=8080 \\
    HOST=0.0.0.0 \\
    NODE_ENV=production

# Add metadata for Cloudflare Workers discovery
WORKDIR ${this.options.workDir}
RUN echo '{"service": "${config.serviceName || 'app'}", "version": "${config.version || '1.0.0}"}' > /app/metadata.json`;

    return dockerfile;
  }

  generateGoAppTemplate(config = {}) {
    const { mainFile = 'main.go', buildCommand = 'go build -o app' } = config;

    return `# Multi-stage build for Go application
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN ${buildCommand}

# Production stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1001 -S ${this.options.user} && \\
    adduser -u 1001 -S ${this.options.user} -G ${this.options.user}

WORKDIR ${this.options.workDir}

# Copy binary from builder
COPY --from=builder /build/app /app

# Change ownership
RUN chown ${this.options.user}:${this.options.user} /app

USER ${this.options.user}

EXPOSE ${this.options.port}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD wget --no-verbose --tries=1 --spider http://localhost:${this.options.port}/health || exit 1

CMD ["/app"]`;
  }

  generateRustAppTemplate(config = {}) {
    return `# Multi-stage build for Rust application
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev

WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Copy source code
COPY src ./src

# Build application
RUN cargo build --release

# Production stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S ${this.options.user} && \\
    adduser -u 1001 -S ${this.options.user} -G ${this.options.user}

WORKDIR ${this.options.workDir}

# Copy binary from builder
COPY --from=builder /app/target/release/app /app

# Change ownership
RUN chown ${this.options.user}:${this.options.user} /app

USER ${this.options.user}

EXPOSE ${this.options.port}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD wget --no-verbose --tries=1 --spider http://localhost:${this.options.port}/health || exit 1

CMD ["/app"]`;
  }

  generateJavaAppTemplate(config = {}) {
    const {
      javaVersion = '21',
      buildTool = 'maven',
      mainClass = 'com.example.Application'
    } = config;

    return `# Multi-stage build for Java application
FROM openjdk:${javaVersion}-jdk-alpine AS builder

# Install build dependencies
RUN apk add --no-cache maven gradle

WORKDIR /build

# Copy build files
${buildTool === 'maven'
  ? 'COPY pom.xml ./\nRUN mvn dependency:go-offline\nCOPY src ./src\nRUN mvn clean package -DskipTests'
  : 'COPY build.gradle settings.gradle ./\nCOPY src ./src\nRUN gradle build --no-daemon'
}

# Production stage
FROM openjdk:${javaVersion}-jre-alpine

# Install runtime dependencies
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S ${this.options.user} && \\
    adduser -u 1001 -S ${this.options.user} -G ${this.options.user}

WORKDIR ${this.options.workDir}

# Copy application JAR from builder
COPY --from=builder /build/target/*.jar app.jar || COPY --from=builder /build/build/libs/*.jar app.jar

# Change ownership
RUN chown ${this.options.user}:${this.options.user} app.jar

USER ${this.options.user}

EXPOSE ${this.options.port}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:${this.options.port}/actuator/health || exit 1

CMD ["java", "-jar", "app.jar"]`;
  }

  // Save generated Dockerfile to filesystem
  saveTemplate(type, outputPath, config = {}) {
    const dockerfile = this.generateCFOptimizedTemplate(type, config);
    fs.writeFileSync(outputPath, dockerfile);
    console.log(`Dockerfile generated: ${outputPath}`);
    return dockerfile;
  }

  // Generate .dockerignore file
  generateDockerignore(projectsType = 'node') {
    const commonIgnores = [
      'node_modules',
      '.git',
      '.gitignore',
      'README.md',
      'Dockerfile',
      'docker-compose.yml',
      '.dockerignore',
      '.env',
      'coverage',
      '.nyc_output',
      '.vscode',
      '.idea'
    ];

    const projectSpecificIgnores = {
      node: ['dist', 'build', '.next', '.nuxt'],
      python: ['__pycache__', '*.pyc', '.pytest_cache', '.mypy_cache'],
      java: ['target', '.gradle'],
      go: ['*.exe', '*.exe~', '*.dll', '*.so', '*.dylib'],
      rust: ['target', '**/*.rs.bk']
    };

    const ignores = [
      ...commonIgnores,
      ...(projectSpecificIgnores[projectsType] || [])
    ];

    return ignores.join('\n') + '\n';
  }
}

module.exports = {
  DockerfileTemplate,

  // Helper function for quick usage
  createDockerfile: (type, config = {}) => {
    const template = new DockerfileTemplate();
    return template.generateCFOptimizedTemplate(type, config);
  }
};