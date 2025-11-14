#!/bin/bash

# Cloudflare Project Setup Script
# Initializes new Cloudflare project with best practices and security

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Default values
PROJECT_NAME=""
PROJECT_TYPE=""
DOMAIN=""
ENVIRONMENT="development"
REGION="auto"
ENABLE_D1=false
ENABLE_R2=false
ENABLE_KV=false
ENABLE_DURABLE_OBJECTS=false
ENABLE_ANALYTICS=true

# Help function
show_help() {
    cat << EOF
Cloudflare Project Setup Script

USAGE:
    $0 [OPTIONS]

REQUIRED:
    -n, --name NAME          Project name
    -t, --type TYPE          Project type (worker, pages, full-stack)

OPTIONAL:
    -d, --domain DOMAIN      Custom domain
    -e, --env ENV           Environment (development, staging, production)
    -r, --region REGION      Deployment region (default: auto)
    --enable-d1             Enable D1 database
    --enable-r2             Enable R2 storage
    --enable-kv             Enable KV storage
    --enable-durable-objects Enable Durable Objects
    --disable-analytics     Disable analytics
    -h, --help              Show this help message

EXAMPLES:
    $0 -n myapp -t worker --enable-d1 --enable-kv
    $0 -n mysite -t pages -d example.com -e production
    $0 -n api -t full-stack --enable-d1 --enable-r2 --enable-durable-objects

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        -t|--type)
            PROJECT_TYPE="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        --enable-d1)
            ENABLE_D1=true
            shift
            ;;
        --enable-r2)
            ENABLE_R2=true
            shift
            ;;
        --enable-kv)
            ENABLE_KV=true
            shift
            ;;
        --enable-durable-objects)
            ENABLE_DURABLE_OBJECTS=true
            shift
            ;;
        --disable-analytics)
            ENABLE_ANALYTICS=false
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate required arguments
if [[ -z "$PROJECT_NAME" ]]; then
    error "Project name is required. Use -n or --name"
fi

if [[ -z "$PROJECT_TYPE" ]]; then
    error "Project type is required. Use -t or --type (worker, pages, full-stack)"
fi

if [[ ! "$PROJECT_TYPE" =~ ^(worker|pages|full-stack)$ ]]; then
    error "Invalid project type. Must be: worker, pages, or full-stack"
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment. Must be: development, staging, or production"
fi

# Check dependencies
check_dependencies() {
    info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        error "Wrangler CLI is not installed. Install with: npm install -g wrangler"
    fi

    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi

    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi

    log "Dependencies check passed"
}

# Authenticate with Cloudflare
authenticate_cloudflare() {
    info "Authenticating with Cloudflare..."

    if ! wrangler whoami &> /dev/null; then
        log "Not authenticated. Starting login flow..."
        wrangler auth login
    else
        log "Already authenticated with Cloudflare"
    fi
}

# Create project structure
create_project_structure() {
    log "Creating project structure for $PROJECT_NAME..."

    mkdir -p "$PROJECT_NAME"
    cd "$PROJECT_NAME"

    # Create standard directories
    mkdir -p {src,tests,scripts,docs,config}

    # Create environment-specific directories
    mkdir -p "config/$ENVIRONMENT"

    # Create source directories based on project type
    case $PROJECT_TYPE in
        worker)
            mkdir -p src/{workers,middleware,utils}
            ;;
        pages)
            mkdir -p src/{pages,functions,styles,assets}
            ;;
        full-stack)
            mkdir -p src/{api,workers,pages,functions,styles,assets,utils}
            ;;
    esac

    # Create test directories
    mkdir -p tests/{unit,integration,e2e}

    log "Project structure created"
}

# Initialize package.json
init_package_json() {
    log "Initializing package.json..."

    cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "Cloudflare $PROJECT_TYPE project",
  "main": "src/index.js",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "type-check": "tsc --noEmit"
  },
  "keywords": ["cloudflare", "$PROJECT_TYPE"],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.45.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "typescript": "^5.1.6",
    "wrangler": "^3.19.0"
  },
  "dependencies": {
    "hono": "^3.11.0"
  }
}
EOF

    npm install
    log "Package.json initialized and dependencies installed"
}

# Create Wrangler configuration
create_wrangler_config() {
    log "Creating Wrangler configuration..."

    local config_file="wrangler.toml"

    cat > "$config_file" << EOF
name = "$PROJECT_NAME"
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Environment configuration
env = { }

# Development environment
[env.development]
name = "$PROJECT_NAME-dev"

# Staging environment
[env.staging]
name = "$PROJECT_NAME-staging"

# Production environment
[env.production]
name = "$PROJECT_NAME"
EOF

    # Add domain configuration if provided
    if [[ -n "$DOMAIN" ]]; then
        cat >> "$config_file" << EOF

# Custom domain
routes = [
    { pattern = "$DOMAIN", zone_name = "$DOMAIN" }
]
EOF
    fi

    # Add D1 database configuration
    if [[ "$ENABLE_D1" == true ]]; then
        cat >> "$config_file" << EOF

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "$PROJECT_NAME-db"
database_id = "\${D1_DATABASE_ID}"

[env.development.d1_databases]
binding = "DB"
database_name = "$PROJECT_NAME-db-dev"
database_id = "\${D1_DATABASE_ID_DEV}"

[env.staging.d1_databases]
binding = "DB"
database_name = "$PROJECT_NAME-db-staging"
database_id = "\${D1_DATABASE_ID_STAGING}"
EOF
    fi

    # Add KV namespace configuration
    if [[ "$ENABLE_KV" == true ]]; then
        cat >> "$config_file" << EOF

# KV Storage
[[kv_namespaces]]
binding = "CACHE"
id = "\${KV_NAMESPACE_ID}"
preview_id = "\${KV_NAMESPACE_PREVIEW_ID}"

[[kv_namespaces]]
binding = "SESSIONS"
id = "\${SESSIONS_KV_NAMESPACE_ID}"
preview_id = "\${SESSIONS_KV_NAMESPACE_PREVIEW_ID}"
EOF
    fi

    # Add R2 bucket configuration
    if [[ "$ENABLE_R2" == true ]]; then
        cat >> "$config_file" << EOF

# R2 Storage
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "$PROJECT_NAME-assets"
EOF
    fi

    # Add Durable Objects configuration
    if [[ "$ENABLE_DURABLE_OBJECTS" == true ]]; then
        cat >> "$config_file" << EOF

# Durable Objects
[[durable_objects.bindings]]
name = "DURABLE_OBJECT"
class_name = "DurableObject"
script_name = "$PROJECT_NAME"
EOF
    fi

    # Add analytics configuration
    if [[ "$ENABLE_ANALYTICS" == true ]]; then
        cat >> "$config_file" << EOF

# Analytics Engine
[[analytics_engine_datasets]]
binding = "ANALYTICS"

[env.production.analytics_engine_datasets]
binding = "ANALYTICS"
EOF
    fi

    log "Wrangler configuration created"
}

# Create environment files
create_env_files() {
    log "Creating environment files..."

    # .env.example
    cat > .env.example << EOF
# Cloudflare API Credentials
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# D1 Database (if enabled)
D1_DATABASE_ID=your_d1_database_id_here
D1_DATABASE_ID_DEV=your_d1_database_id_dev_here
D1_DATABASE_ID_STAGING=your_d1_database_id_staging_here

# KV Namespaces (if enabled)
KV_NAMESPACE_ID=your_kv_namespace_id_here
KV_NAMESPACE_PREVIEW_ID=your_kv_namespace_preview_id_here
SESSIONS_KV_NAMESPACE_ID=your_sessions_kv_namespace_id_here
SESSIONS_KV_NAMESPACE_PREVIEW_ID=your_sessions_kv_namespace_preview_id_here

# Custom Domain (if configured)
CUSTOM_DOMAIN=$DOMAIN

# Environment-specific variables
NODE_ENV=$ENVIRONMENT
LOG_LEVEL=info
EOF

    # .env.local for local development
    cp .env.example .env.local

    log "Environment files created"
}

# Create main application files
create_main_files() {
    log "Creating main application files..."

    case $PROJECT_TYPE in
        worker)
            create_worker_files
            ;;
        pages)
            create_pages_files
            ;;
        full-stack)
            create_fullstack_files
            ;;
    esac
}

create_worker_files() {
    cat > src/index.js << 'EOF'
/**
 * Cloudflare Worker
 * Main entry point for the worker application
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Main routes
app.get('/', (c) => {
  return c.json({
    message: 'Hello from Cloudflare Worker!',
    project: PROJECT_NAME
  });
});

// API routes
app.route('/api', app);

export default {
  fetch: app.fetch,
};
EOF
}

create_pages_files() {
    cat > src/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$PROJECT_NAME</title>
    <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
    <div id="app">
        <h1>Welcome to $PROJECT_NAME</h1>
        <p>Deployed on Cloudflare Pages</p>
    </div>
    <script src="/scripts/main.js"></script>
</body>
</html>
EOF

    mkdir -p src/styles
    cat > src/styles/main.css << EOF
/* Main styles for $PROJECT_NAME */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 2rem;
    background-color: #f8f9fa;
}

#app {
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
}

h1 {
    color: #f48120;
    margin-bottom: 1rem;
}
EOF

    mkdir -p src/scripts
    cat > src/scripts/main.js << EOF
// Main application script
console.log('$PROJECT_NAME loaded successfully!');

// Add your client-side JavaScript here
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initialized');
});
EOF
}

create_fullstack_files() {
    # Create API worker
    mkdir -p src/api
    cat > src/api/index.js << 'EOF'
/**
 * API Worker for Full-Stack Application
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// API Routes
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (c) => {
  // Example API endpoint
  return c.json({ users: [] });
});

export default app;
EOF

    # Create Pages frontend
    create_pages_files
}

# Create D1 database initialization
create_d1_setup() {
    if [[ "$ENABLE_D1" == true ]]; then
        log "Setting up D1 database..."

        # Create migrations directory
        mkdir -p migrations

        # Create initial migration
        cat > migrations/0001_initial_schema.sql << EOF
-- Initial database schema for $PROJECT_NAME

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    user_id INTEGER,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
EOF

        log "D1 database setup created"
    fi
}

# Create CI/CD configuration
create_cicd_config() {
    log "Creating CI/CD configuration..."

    # GitHub Actions workflow
    mkdir -p .github/workflows

    cat > .github/workflows/deploy.yml << EOF
name: Deploy to Cloudflare

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Run linting
      run: npm run lint

    - name: Type check
      run: npm run type-check

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Deploy to Cloudflare
      run: wrangler deploy --env production
      env:
        CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Deploy to Cloudflare
      run: wrangler deploy --env staging
      env:
        CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
EOF

    log "CI/CD configuration created"
}

# Create development scripts
create_dev_scripts() {
    log "Creating development scripts..."

    # Development script
    cat > scripts/dev.sh << 'EOF'
#!/bin/bash
# Development server script
wrangler dev --env development
EOF

    # Deployment script
    cat > scripts/deploy.sh << EOF
#!/bin/bash
# Deployment script
ENVIRONMENT=\${1:-production}

echo "Deploying to \$ENVIRONMENT..."
wrangler deploy --env \$ENVIRONMENT
EOF

    # Database migration script
    if [[ "$ENABLE_D1" == true ]]; then
        cat > scripts/migrate.sh << EOF
#!/bin/bash
# Database migration script
ENVIRONMENT=\${1:-development}

echo "Running migrations for \$ENVIRONMENT..."
wrangler d1 migrations apply $PROJECT_NAME-db --env \$ENVIRONMENT
EOF
    fi

    # Make scripts executable
    chmod +x scripts/*.sh

    log "Development scripts created"
}

# Create documentation
create_documentation() {
    log "Creating documentation..."

    cat > README.md << EOF
# $PROJECT_NAME

A Cloudflare $PROJECT_TYPE project with best practices and modern tooling.

## Features

- ✅ Modern JavaScript/TypeScript support
- ✅ Hot reload development server
- ✅ Automated testing and CI/CD
- ✅ Environment-based deployments
EOF

    if [[ "$ENABLE_D1" == true ]]; then
        echo "- ✅ D1 database with migrations" >> README.md
    fi

    if [[ "$ENABLE_R2" == true ]]; then
        echo "- ✅ R2 storage integration" >> README.md
    fi

    if [[ "$ENABLE_KV" == true ]]; then
        echo "- ✅ KV storage for caching" >> README.md
    fi

    if [[ "$ENABLE_DURABLE_OBJECTS" == true ]]; then
        echo "- ✅ Durable Objects for stateful applications" >> README.md
    fi

    cat >> README.md << EOF

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env.local
   # Edit .env.local with your values
   \`\`\`

3. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Run tests:
   \`\`\`bash
   npm test
   \`\`\`

## Deployment

Deploy to production:
\`\`\`bash
npm run deploy
\`\`\`

Deploy to staging:
\`\`\`bash
wrangler deploy --env staging
\`\`\`

## Environment

- **Development**: Local development with hot reload
- **Staging**: Preview environment for testing
- **Production**: Live production environment

## Project Structure

\`\`\`
$PROJECT_NAME/
├── src/                 # Source code
├── tests/               # Test files
├── scripts/             # Utility scripts
├── docs/                # Documentation
├── config/              # Configuration files
├── migrations/          # Database migrations (if D1 enabled)
├── wrangler.toml        # Wrangler configuration
└── package.json         # Node.js dependencies
\`\`\`

## Learn More

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Hono Framework](https://hono.dev/)
EOF

    log "Documentation created"
}

# Initialize git repository
init_git() {
    log "Initializing git repository..."

    git init

    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
.wrangler/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed

# Coverage reports
coverage/
.nyc_output/

# Temporary folders
tmp/
temp/

# Wrangler
wrangler.toml.bak
EOF

    git add .
    git commit -m "Initial commit: Set up Cloudflare $PROJECT_TYPE project"

    log "Git repository initialized"
}

# Main execution flow
main() {
    log "Starting Cloudflare project setup..."
    log "Project: $PROJECT_NAME"
    log "Type: $PROJECT_TYPE"
    log "Environment: $ENVIRONMENT"

    check_dependencies
    authenticate_cloudflare
    create_project_structure
    init_package_json
    create_wrangler_config
    create_env_files
    create_main_files
    create_d1_setup
    create_cicd_config
    create_dev_scripts
    create_documentation
    init_git

    log "✅ Cloudflare project setup completed successfully!"
    log "📁 Project created in: $(pwd)"
    log ""
    log "Next steps:"
    log "1. cd $PROJECT_NAME"
    log "2. Edit .env.local with your configuration"
    log "3. Run 'npm run dev' to start development"
    log "4. Run 'npm test' to run tests"

    if [[ "$ENABLE_D1" == true ]]; then
        log "5. Run './scripts/migrate.sh' to initialize the database"
    fi
}

# Execute main function
main "$@"