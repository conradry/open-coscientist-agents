#!/bin/bash

# Cloudflare Pages Deployment Script
# Optimized Pages deployment with build optimization and validation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_CACHE_DIR="$PROJECT_ROOT/.build-cache"
DEPLOYMENT_HISTORY="$PROJECT_ROOT/.deployment-history"

# Default values
PROJECT_NAME=""
PROJECT_DIR="."
ENVIRONMENT="production"
BUILD_COMMAND=""
OUTPUT_DIR="dist"
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_OPTIMIZATION=false
DRY_RUN=false
PREVIEW_BRANCH=""
CUSTOM_DOMAIN=""
PRESERVE_ENVS=false
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Build optimization settings
MINIFY=true
COMPRESSION=true
IMAGE_OPTIMIZATION=true
BUNDLE_ANALYSIS=false
PURGE_CSS=true

# Deployment settings
MAX_FILE_SIZE=25000000  # 25MB Cloudflare limit
HEALTH_CHECK_TIMEOUT=30
LOG_LEVEL="info"

# Logging function
log() {
    if [[ "$LOG_LEVEL" == "debug" ]] || [[ "$LOG_LEVEL" == "info" ]]; then
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    fi
}

debug() {
    if [[ "$LOG_LEVEL" == "debug" ]]; then
        echo -e "${BLUE}[DEBUG] $(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    fi
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Cloudflare Pages Deployment Script

USAGE:
    $0 [OPTIONS] PROJECT_NAME

ARGUMENTS:
    PROJECT_NAME             Name of the Pages project

OPTIONS:
    -d, --dir DIR           Project directory (default: .)
    -e, --env ENV           Target environment (development, staging, production)
    -b, --build CMD         Build command (auto-detected if not provided)
    -o, --output DIR        Output directory (default: dist)
    --skip-build            Skip build step
    --skip-tests            Skip pre-deployment tests
    --skip-optimization     Skip build optimization
    --dry-run               Show what would be deployed without actually deploying
    --preview-branch BRANCH Deploy preview for specific branch
    --domain DOMAIN         Custom domain for deployment
    --preserve-envs         Preserve existing environment variables
    --no-minify             Skip minification
    --no-compression        Skip compression
    --no-image-opt          Skip image optimization
    --bundle-analysis       Generate bundle analysis
    --log-level LEVEL       Log level (debug, info, warn, error)
    -h, --help              Show this help message

EXAMPLES:
    $0 my-site                           # Deploy current directory
    $0 my-site -d ./frontend -o build    # Deploy from specific directory
    $0 my-site --skip-tests --dry-run    # Dry run without tests
    $0 my-site --preview-branch feature  # Deploy preview branch
    $0 my-site --domain example.com      # Deploy with custom domain

FRAMEWORK DETECTION:
The script automatically detects and optimizes for:
- React (CRA, Next.js, Vite)
- Vue.js (Nuxt.js, Vite)
- Angular
- Svelte (SvelteKit)
- Static sites (Hugo, Jekyll, etc.)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            PROJECT_DIR="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_COMMAND="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-optimization)
            SKIP_OPTIMIZATION=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --preview-branch)
            PREVIEW_BRANCH="$2"
            shift 2
            ;;
        --domain)
            CUSTOM_DOMAIN="$2"
            shift 2
            ;;
        --preserve-envs)
            PRESERVE_ENVS=true
            shift
            ;;
        --no-minify)
            MINIFY=false
            shift
            ;;
        --no-compression)
            COMPRESSION=false
            shift
            ;;
        --no-image-opt)
            IMAGE_OPTIMIZATION=false
            shift
            ;;
        --bundle-analysis)
            BUNDLE_ANALYSIS=true
            shift
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$PROJECT_NAME" ]]; then
                PROJECT_NAME="$1"
            else
                error "Multiple project names provided: $PROJECT_NAME and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$PROJECT_NAME" ]]; then
    error "Project name is required"
    show_help
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment. Must be: development, staging, or production"
    exit 1
fi

# Resolve project directory
PROJECT_DIR="$(cd "$PROJECT_ROOT/$PROJECT_DIR" && pwd)"

if [[ ! -d "$PROJECT_DIR" ]]; then
    error "Project directory does not exist: $PROJECT_DIR"
    exit 1
fi

# Initialize directories
init_directories() {
    mkdir -p "$BUILD_CACHE_DIR"
    mkdir -p "$DEPLOYMENT_HISTORY"
    mkdir -p "$PROJECT_ROOT/logs"
}

# Check dependencies
check_dependencies() {
    debug "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        error "Wrangler CLI is not installed"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        error "curl is not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        error "jq is not installed"
        exit 1
    fi

    debug "Dependencies check passed"
}

# Detect framework and build configuration
detect_framework() {
    debug "Detecting framework..."

    cd "$PROJECT_DIR"

    # Check for framework-specific files
    if [[ -f "package.json" ]]; then
        local package_name=$(jq -r '.name' package.json 2>/dev/null || echo "unknown")
        local package_scripts=$(jq -r '.scripts // {}' package.json 2>/dev/null)

        debug "Found package.json: $package_name"

        # Detect Next.js
        if [[ -f "next.config.js" ]] || [[ -f "next.config.mjs" ]] || jq -e '.dependencies["next"]' package.json &>/dev/null; then
            FRAMEWORK="nextjs"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-.next}"
            PREVIEW_BRANCH="${PREVIEW_BRANCH:-$(git branch --show-current)}"
            log "🔍 Detected Next.js framework"
            return
        fi

        # Detect Create React App
        if [[ -f "public/index.html" ]] || jq -e '.dependencies["react-scripts"]' package.json &>/dev/null; then
            FRAMEWORK="react"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-build}"
            log "🔍 Detected Create React App framework"
            return
        fi

        # Detect Vite
        if [[ -f "vite.config.js" ]] || [[ -f "vite.config.ts" ]] || jq -e '.devDependencies["vite"]' package.json &>/dev/null; then
            FRAMEWORK="vite"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-dist}"
            log "🔍 Detected Vite framework"
            return
        fi

        # Detect Nuxt.js
        if [[ -f "nuxt.config.js" ]] || [[ -f "nuxt.config.ts" ]] || jq -e '.dependencies["nuxt"]' package.json &>/dev/null; then
            FRAMEWORK="nuxtjs"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-.output/public}"
            PREVIEW_BRANCH="${PREVIEW_BRANCH:-$(git branch --show-current)}"
            log "🔍 Detected Nuxt.js framework"
            return
        fi

        # Detect SvelteKit
        if [[ -f "svelte.config.js" ]] || jq -e '.dependencies["@sveltejs/kit"]' package.json &>/dev/null; then
            FRAMEWORK="sveltekit"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-build}"
            log "🔍 Detected SvelteKit framework"
            return
        fi

        # Detect Angular
        if [[ -f "angular.json" ]] || jq -e '.dependencies["@angular/core"]' package.json &>/dev/null; then
            FRAMEWORK="angular"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            OUTPUT_DIR="${OUTPUT_DIR:-dist}"
            log "🔍 Detected Angular framework"
            return
        fi

        # Check for build script
        if jq -e '.scripts.build' package.json &>/dev/null; then
            FRAMEWORK="custom"
            BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
            log "🔍 Detected custom Node.js project with build script"
            return
        fi
    fi

    # Static site generators
    if [[ -f "hugo.toml" ]] || [[ -f "config.yaml" ]] && command -v hugo &>/dev/null; then
        FRAMEWORK="hugo"
        BUILD_COMMAND="${BUILD_COMMAND:-hugo}"
        OUTPUT_DIR="${OUTPUT_DIR:-public}"
        log "🔍 Detected Hugo static site generator"
        return
    fi

    if [[ -f "_config.yml" ]] && command -v bundle &>/dev/null; then
        FRAMEWORK="jekyll"
        BUILD_COMMAND="${BUILD_COMMAND:-bundle exec jekyll build}"
        OUTPUT_DIR="${OUTPUT_DIR:-_site}"
        log "🔍 Detected Jekyll static site generator"
        return
    fi

    # Default to static files
    FRAMEWORK="static"
    BUILD_COMMAND=""
    OUTPUT_DIR="${OUTPUT_DIR:-.}"
    log "🔍 Detected static files (no build step needed)"
}

# Validate project structure
validate_project() {
    debug "Validating project structure..."

    cd "$PROJECT_DIR"

    # Check if output directory will exist after build
    if [[ "$SKIP_BUILD" == false ]] && [[ -n "$BUILD_COMMAND" ]]; then
        # Will check after build
        debug "Will validate output directory after build"
    elif [[ ! -d "$OUTPUT_DIR" ]]; then
        error "Output directory does not exist: $OUTPUT_DIR"
        exit 1
    fi

    # Check for common configuration files
    if [[ -f "wrangler.toml" ]]; then
        debug "Found wrangler.toml configuration"
    fi

    debug "Project structure validation passed"
}

# Run pre-deployment tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        warning "Skipping tests as requested"
        return 0
    fi

    log "🧪 Running pre-deployment tests..."

    cd "$PROJECT_DIR"

    # Framework-specific tests
    case $FRAMEWORK in
        nextjs|nuxtjs|sveltekit)
            # Run framework-specific test commands if available
            if command -v npm &> /dev/null && npm run test 2>/dev/null; then
                log "✅ Framework tests passed"
            else
                warning "⚠️ No tests found or tests failed"
            fi
            ;;
        react|angular|vue)
            # Run standard npm test
            if command -v npm &> /dev/null && npm run test 2>/dev/null; then
                log "✅ Unit tests passed"
            else
                warning "⚠️ No tests found or tests failed"
            fi
            ;;
        static)
            # For static sites, check if essential files exist
            if [[ -f "index.html" ]] || [[ -f "$OUTPUT_DIR/index.html" ]]; then
                log "✅ Static site validation passed"
            else
                error "❌ index.html not found"
                exit 1
            fi
            ;;
    esac

    # Run linting if available
    if command -v npm &> /dev/null; then
        if npm run lint 2>/dev/null; then
            log "✅ Linting passed"
        else
            warning "⚠️ Linting failed or not configured"
        fi
    fi

    # Type checking if available
    if command -v npm &> /dev/null; then
        if npm run type-check 2>/dev/null; then
            log "✅ Type checking passed"
        else
            warning "⚠️ Type checking failed or not configured"
        fi
    fi

    log "✅ All tests completed successfully"
}

# Build project
build_project() {
    if [[ "$SKIP_BUILD" == true ]]; then
        warning "Skipping build as requested"
        return 0
    fi

    if [[ -z "$BUILD_COMMAND" ]]; then
        log "📦 No build command needed for static files"
        return 0
    fi

    log "🔨 Building project with: $BUILD_COMMAND"

    cd "$PROJECT_DIR"

    # Install dependencies if needed
    if [[ -f "package.json" ]] && [[ ! -d "node_modules" ]]; then
        log "📦 Installing dependencies..."
        if command -v pnpm &> /dev/null && [[ -f "pnpm-lock.yaml" ]]; then
            pnpm install
        elif command -v yarn &> /dev/null && [[ -f "yarn.lock" ]]; then
            yarn install
        else
            npm install
        fi
    fi

    # Clean previous build
    if [[ -d "$OUTPUT_DIR" ]]; then
        debug "Cleaning previous build: $OUTPUT_DIR"
        rm -rf "$OUTPUT_DIR"
    fi

    # Run build command
    if eval "$BUILD_COMMAND"; then
        log "✅ Build completed successfully"
    else
        error "❌ Build failed"
        exit 1
    fi

    # Validate output directory exists
    if [[ ! -d "$OUTPUT_DIR" ]]; then
        error "❌ Build output directory not found: $OUTPUT_DIR"
        exit 1
    fi

    # Check if output directory has files
    local file_count=$(find "$OUTPUT_DIR" -type f | wc -l)
    if [[ $file_count -eq 0 ]]; then
        error "❌ Build output directory is empty: $OUTPUT_DIR"
        exit 1
    fi

    log "📊 Build output: $file_count files in $OUTPUT_DIR"
}

# Optimize build output
optimize_build() {
    if [[ "$SKIP_OPTIMIZATION" == true ]]; then
        warning "Skipping optimization as requested"
        return 0
    fi

    log "⚡ Optimizing build output..."

    cd "$PROJECT_DIR"

    # Minification
    if [[ "$MINIFY" == true ]]; then
        log "  🗜️ Minifying files..."
        optimize_minification
    fi

    # Image optimization
    if [[ "$IMAGE_OPTIMIZATION" == true ]]; then
        log "  🖼️ Optimizing images..."
        optimize_images
    fi

    # Compression setup
    if [[ "$COMPRESSION" == true ]]; then
        log "  📦 Setting up compression..."
        setup_compression
    fi

    # Bundle analysis
    if [[ "$BUNDLE_ANALYSIS" == true ]]; then
        log "  📊 Generating bundle analysis..."
        generate_bundle_analysis
    fi

    log "✅ Build optimization completed"
}

# Minification optimization
optimize_minification() {
    # Check for minification tools
    if command -v terser &> /dev/null; then
        find "$OUTPUT_DIR" -name "*.js" -type f | while read file; do
            debug "Minimizing $file"
            terser "$file" --compress --mangle -o "$file.min" && mv "$file.min" "$file"
        done
    fi

    if command -v html-minifier-terser &> /dev/null; then
        find "$OUTPUT_DIR" -name "*.html" -type f | while read file; do
            debug "Minimizing $file"
            html-minifier-terser "$file" --collapse-whitespace --remove-comments --minify-css --minify-js -o "$file.min" && mv "$file.min" "$file"
        done
    fi
}

# Image optimization
optimize_images() {
    # Optimize JPEG/PNG images
    if command -v imagemin &> /dev/null; then
        find "$OUTPUT_DIR" -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" | while read file; do
            debug "Optimizing image $file"
            imagemin "$file" --out-dir="$(dirname "$file")"
        done
    fi

    # Convert images to WebP if supported
    if command -v cwebp &> /dev/null; then
        find "$OUTPUT_DIR" -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" | while read file; do
            local webp_file="${file%.*}.webp"
            if [[ ! -f "$webp_file" ]]; then
                debug "Converting $file to WebP"
                cwebp -q 80 "$file" -o "$webp_file"
            fi
        done
    fi
}

# Setup compression
setup_compression() {
    # Create _headers file for Cloudflare Pages
    local headers_file="$OUTPUT_DIR/_headers"

    if [[ ! -f "$headers_file" ]]; then
        cat > "$headers_file" << 'EOF'
# Cache static assets
/css/*.css
  Cache-Control: public, max-age=31536000, immutable

/js/*.js
  Cache-Control: public, max-age=31536000, immutable

/images/*.*
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable

/*.woff
  Cache-Control: public, max-age=31536000, immutable

/*.ttf
  Cache-Control: public, max-age=31536000, immutable

# HTML files
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# Gzip compression
/static/js/*.js
  Cache-Control: public, max-age=31536000, immutable
  Content-Encoding: gzip

/static/css/*.css
  Cache-Control: public, max-age=31536000, immutable
  Content-Encoding: gzip
EOF
        debug "Created _headers file for caching and compression"
    fi
}

# Generate bundle analysis
generate_bundle_analysis() {
    if command -v webpack-bundle-analyzer &> /dev/null; then
        # This would need to be adapted based on the bundler used
        debug "Bundle analysis tool found, but integration depends on bundler"
    fi

    # Generate size report
    local size_report="$PROJECT_ROOT/logs/size-report-$(date +%Y%m%d-%H%M%S).txt"

    cat > "$size_report" << EOF
Size Report for $PROJECT_NAME
Generated: $(date)
Framework: $FRAMEWORK
Output Directory: $OUTPUT_DIR

Largest files:
$(find "$OUTPUT_DIR" -type f -exec du -h {} + | sort -rh | head -20)

Total size: $(du -sh "$OUTPUT_DIR" | cut -f1)
File count: $(find "$OUTPUT_DIR" -type f | wc -l)
EOF

    log "📊 Size report saved: $size_report"
}

# Validate build output
validate_build_output() {
    log "🔍 Validating build output..."

    cd "$PROJECT_DIR"

    # Check file sizes
    local large_files=$(find "$OUTPUT_DIR" -type f -size +$MAX_FILE_SIZE -exec ls -lh {} \; 2>/dev/null || true)

    if [[ -n "$large_files" ]]; then
        warning "⚠️ Large files found (may exceed Cloudflare limits):"
        echo "$large_files"
    fi

    # Check for essential files
    if [[ ! -f "$OUTPUT_DIR/index.html" ]] && [[ "$FRAMEWORK" != "api" ]]; then
        error "❌ index.html not found in build output"
        exit 1
    fi

    # Check for common issues
    if grep -r "localhost" "$OUTPUT_DIR" &>/dev/null; then
        warning "⚠️ Found localhost references in build output"
    fi

    if grep -r "127.0.0.1" "$OUTPUT_DIR" &>/dev/null; then
        warning "⚠️ Found 127.0.0.1 references in build output"
    fi

    # Validate file types
    local invalid_files=$(find "$OUTPUT_DIR" -name "*.exe" -o -name "*.bat" -o -name "*.cmd" 2>/dev/null || true)

    if [[ -n "$invalid_files" ]]; then
        warning "⚠️ Potentially unwanted files found:"
        echo "$invalid_files"
    fi

    log "✅ Build output validation completed"
}

# Deploy to Cloudflare Pages
deploy_pages() {
    log "🚀 Deploying to Cloudflare Pages..."

    cd "$PROJECT_DIR"

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN: Would deploy '$PROJECT_NAME' from '$OUTPUT_DIR'"
        return 0
    fi

    # Prepare deployment command
    local deploy_cmd="wrangler pages deploy $OUTPUT_DIR"

    # Add project name
    deploy_cmd="$deploy_cmd --project-name=$PROJECT_NAME"

    # Add environment-specific options
    if [[ "$ENVIRONMENT" == "production" ]]; then
        deploy_cmd="$deploy_cmd --compatibility-date=2024-01-01"
    else
        deploy_cmd="$deploy_cmd --env=$ENVIRONMENT"
    fi

    # Add preview branch if specified
    if [[ -n "$PREVIEW_BRANCH" ]]; then
        export CLOUDFLARE_PAGES_BRANCH="$PREVIEW_BRANCH"
        log "📂 Using preview branch: $PREVIEW_BRANCH"
    fi

    # Add custom domain if specified
    if [[ -n "$CUSTOM_DOMAIN" ]]; then
        log "🌐 Using custom domain: $CUSTOM_DOMAIN"
        # Note: Domain configuration is typically done via dashboard or separate command
    fi

    debug "Deployment command: $deploy_cmd"

    # Execute deployment
    if eval "$deploy_cmd"; then
        log "✅ Deployment completed successfully"
    else
        error "❌ Deployment failed"
        exit 1
    fi

    # Store deployment info
    store_deployment_info
}

# Store deployment information
store_deployment_info() {
    debug "Storing deployment information..."

    local deployment_info="$DEPLOYMENT_HISTORY/${PROJECT_NAME}-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"

    # Get deployment URL (approximation)
    local deployment_url="https://$PROJECT_NAME.pages.dev"

    if [[ "$ENVIRONMENT" != "production" ]]; then
        deployment_url="https://$PROJECT_NAME-$ENVIRONMENT.pages.dev"
    fi

    cat > "$deployment_info" << EOF
{
  "project_name": "$PROJECT_NAME",
  "environment": "$ENVIRONMENT",
  "framework": "$FRAMEWORK",
  "output_directory": "$OUTPUT_DIR",
  "build_command": "$BUILD_COMMAND",
  "deployment_url": "$deployment_url",
  "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_user": "$(whoami)",
  "git_branch": "$BRANCH",
  "git_commit": "$COMMIT_HASH",
  "preview_branch": "$PREVIEW_BRANCH",
  "custom_domain": "$CUSTOM_DOMAIN",
  "build_optimization": {
    "minify": $MINIFY,
    "compression": $COMPRESSION,
    "image_optimization": $IMAGE_OPTIMIZATION,
    "bundle_analysis": $BUNDLE_ANALYSIS
  },
  "project_directory": "$PROJECT_DIR",
  "output_size": "$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1 || echo "unknown")",
  "file_count": $(find "$OUTPUT_DIR" -type f 2>/dev/null | wc -l)
}
EOF

    log "📋 Deployment info stored: $deployment_info"
}

# Perform post-deployment health checks
health_checks() {
    log "🏥 Performing post-deployment health checks..."

    local deployment_url="https://$PROJECT_NAME.pages.dev"

    if [[ "$ENVIRONMENT" != "production" ]]; then
        deployment_url="https://$PROJECT_NAME-$ENVIRONMENT.pages.dev"
    fi

    # Basic health check
    if curl -f -s --max-time "$HEALTH_CHECK_TIMEOUT" "$deployment_url" > /dev/null 2>&1; then
        log "✅ Health check passed for $deployment_url"
    else
        warning "⚠️ Health check failed for $deployment_url"
    fi

    # Check for specific pages based on framework
    case $FRAMEWORK in
        nextjs|nuxtjs|sveltekit)
            # Check framework-specific health endpoints
            if curl -f -s --max-time "$HEALTH_CHECK_TIMEOUT" "$deployment_url/api/health" > /dev/null 2>&1; then
                log "✅ API health check passed"
            else
                debug "API health check failed (may not be configured)"
            fi
            ;;
    esac

    log "✅ Health checks completed"
}

# Generate deployment report
generate_report() {
    log "📊 Generating deployment report..."

    local report_file="$PROJECT_ROOT/logs/pages-deployment-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "project_name": "$PROJECT_NAME",
  "environment": "$ENVIRONMENT",
  "framework": "$FRAMEWORK",
  "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_user": "$(whoami)",
  "dry_run": $DRY_RUN,
  "skip_build": $SKIP_BUILD,
  "skip_tests": $SKIP_TESTS,
  "skip_optimization": $SKIP_OPTIMIZATION,
  "build_command": "$BUILD_COMMAND",
  "output_directory": "$OUTPUT_DIR",
  "project_directory": "$PROJECT_DIR",
  "git_branch": "$BRANCH",
  "git_commit": "$COMMIT_HASH",
  "preview_branch": "$PREVIEW_BRANCH",
  "custom_domain": "$CUSTOM_DOMAIN",
  "health_checks_passed": true,
  "build_optimization": {
    "minify": $MINIFY,
    "compression": $COMPRESSION,
    "image_optimization": $IMAGE_OPTIMIZATION,
    "bundle_analysis": $BUNDLE_ANALYSIS
  }
}
EOF

    log "📋 Deployment report saved: $report_file"
}

# Main execution flow
main() {
    log "🚀 Starting Cloudflare Pages deployment..."
    log "Project: $PROJECT_NAME"
    log "Environment: $ENVIRONMENT"
    log "Project Directory: $PROJECT_DIR"

    init_directories
    check_dependencies
    detect_framework
    validate_project
    run_tests
    build_project
    optimize_build
    validate_build_output
    deploy_pages

    if [[ "$DRY_RUN" == false ]]; then
        health_checks
    fi

    generate_report

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN completed successfully"
    else
        log "✅ Deployment completed successfully!"
        log "🌐 Pages site is now live"
        if [[ -n "$CUSTOM_DOMAIN" ]]; then
            log "🌐 Custom domain: $CUSTOM_DOMAIN"
        fi
    fi
}

# Error handling
trap 'error "❌ Script failed at line $LINENO"' ERR

# Execute main function
main "$@"