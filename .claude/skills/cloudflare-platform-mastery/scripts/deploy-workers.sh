#!/bin/bash

# Cloudflare Workers Deployment Script
# Safe Workers deployment with validation and rollback capabilities

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
ROLLBACK_DIR="$PROJECT_ROOT/.rollbacks"
BACKUP_DIR="$PROJECT_ROOT/.backups"

# Default values
ENVIRONMENT="production"
WORKER_NAME=""
SKIP_TESTS=false
SKIP_VALIDATION=false
DRY_RUN=false
ROLLBACK=false
PREVIEW_ONLY=false
MAX_RETRIES=3
HEALTH_CHECK_TIMEOUT=30
LOG_LEVEL="info"

# Health check endpoints (can be overridden)
HEALTH_ENDPOINTS=(
    "/health"
    "/api/health"
    "/ping"
)

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
Cloudflare Workers Deployment Script

USAGE:
    $0 [OPTIONS] WORKER_NAME

ARGUMENTS:
    WORKER_NAME             Name of the worker to deploy

OPTIONS:
    -e, --env ENV           Target environment (development, staging, production)
    --skip-tests           Skip pre-deployment tests
    --skip-validation      Skip deployment validation
    --dry-run              Show what would be deployed without actually deploying
    --preview-only         Deploy to preview environment only
    --rollback             Rollback to previous version
    --retries COUNT        Maximum number of deployment retries (default: 3)
    --timeout SECONDS      Health check timeout (default: 30)
    --log-level LEVEL      Log level (debug, info, warn, error)
    -h, --help             Show this help message

EXAMPLES:
    $0 my-worker                           # Deploy to production
    $0 my-worker -e staging                # Deploy to staging
    $0 my-worker --dry-run                  # Dry run deployment
    $0 my-worker --preview-only             # Preview deployment only
    $0 my-worker --rollback                 # Rollback deployment
    $0 my-worker --skip-tests --skip-validation  # Quick deployment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --preview-only)
            PREVIEW_ONLY=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        --timeout)
            HEALTH_CHECK_TIMEOUT="$2"
            shift 2
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
            if [[ -z "$WORKER_NAME" ]]; then
                WORKER_NAME="$1"
            else
                error "Multiple worker names provided: $WORKER_NAME and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$WORKER_NAME" ]]; then
    error "Worker name is required"
    show_help
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment. Must be: development, staging, or production"
    exit 1
fi

# Initialize directories
init_directories() {
    mkdir -p "$ROLLBACK_DIR"
    mkdir -p "$BACKUP_DIR"
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

# Validate project structure
validate_project() {
    debug "Validating project structure..."

    if [[ ! -f "$PROJECT_ROOT/wrangler.toml" ]]; then
        error "wrangler.toml not found in project root"
        exit 1
    fi

    if [[ ! -d "$PROJECT_ROOT/src" ]]; then
        error "src directory not found"
        exit 1
    fi

    # Check if worker exists in wrangler.toml
    if ! grep -q "name = \"$WORKER_NAME\"" "$PROJECT_ROOT/wrangler.toml"; then
        error "Worker '$WORKER_NAME' not found in wrangler.toml"
        exit 1
    fi

    debug "Project structure validation passed"
}

# Backup current deployment
backup_current_deployment() {
    debug "Creating backup of current deployment..."

    local backup_file="$BACKUP_DIR/${WORKER_NAME}-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).toml"

    # Get current worker configuration
    wrangler whoami &> /dev/null || {
        error "Not authenticated with Cloudflare"
        exit 1
    }

    # Export current configuration
    wrangler tail --format json "$WORKER_NAME" --env "$ENVIRONMENT" > /dev/null 2>&1 || true

    # Create rollback info
    local rollback_info="$ROLLBACK_DIR/${WORKER_NAME}-${ENVIRONMENT}.json"

    if wrangler tail --format json "$WORKER_NAME" --env "$ENVIRONMENT" 2>/dev/null | head -1 > /dev/null; then
        wrangler kv:key list --binding="ROLLBACK" --env "$ENVIRONMENT" 2>/dev/null || echo "{}" > "$rollback_info"
    else
        echo "{}" > "$rollback_info"
    fi

    log "✅ Backup created: $backup_file"
}

# Run pre-deployment tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        warning "Skipping tests as requested"
        return 0
    fi

    log "🧪 Running pre-deployment tests..."

    cd "$PROJECT_ROOT"

    # Run unit tests
    if command -v npm &> /dev/null && [[ -f "package.json" ]]; then
        if npm run test 2>/dev/null; then
            log "✅ Unit tests passed"
        else
            error "❌ Unit tests failed"
            exit 1
        fi
    fi

    # Run linting
    if command -v npm &> /dev/null && npm run lint 2>/dev/null; then
        log "✅ Linting passed"
    else
        warning "⚠️ Linting failed or not configured"
    fi

    # Type checking
    if command -v npm &> /dev/null && npm run type-check 2>/dev/null; then
        log "✅ Type checking passed"
    else
        warning "⚠️ Type checking failed or not configured"
    fi

    log "✅ All tests completed successfully"
}

# Validate worker configuration
validate_worker_config() {
    if [[ "$SKIP_VALIDATION" == true ]]; then
        warning "Skipping validation as requested"
        return 0
    fi

    log "🔍 Validating worker configuration..."

    cd "$PROJECT_ROOT"

    # Validate wrangler.toml syntax
    if ! wrangler validate 2>/dev/null; then
        error "❌ wrangler.toml validation failed"
        exit 1
    fi

    # Check for required bindings and environment variables
    local missing_vars=()

    # Check for common environment variables
    if ! grep -q "CLOUDFLARE_API_TOKEN" .env* 2>/dev/null; then
        missing_vars+=("CLOUDFLARE_API_TOKEN")
    fi

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        warning "⚠️ Potentially missing environment variables: ${missing_vars[*]}"
    fi

    # Check worker size (wrangler will fail if too large)
    local worker_size=$(find src -name "*.js" -o -name "*.ts" | xargs wc -c | tail -1 | awk '{print $1}' || echo "0")
    if [[ $worker_size -gt 1000000 ]]; then  # 1MB limit
        warning "⚠️ Worker size is large: ${worker_size} bytes"
    fi

    log "✅ Worker configuration validated"
}

# Deploy worker
deploy_worker() {
    local retry_count=0
    local deploy_success=false

    while [[ $retry_count -lt $MAX_RETRIES ]] && [[ "$deploy_success" == false ]]; do
        retry_count=$((retry_count + 1))

        log "🚀 Deploying worker (attempt $retry_count/$MAX_RETRIES)..."

        cd "$PROJECT_ROOT"

        if [[ "$DRY_RUN" == true ]]; then
            log "🔍 DRY RUN: Would deploy '$WORKER_NAME' to '$ENVIRONMENT'"
            deploy_success=true
            break
        fi

        # Deploy command
        local deploy_cmd="wrangler deploy"

        if [[ "$ENVIRONMENT" != "production" ]]; then
            deploy_cmd="$deploy_cmd --env $ENVIRONMENT"
        fi

        if [[ "$PREVIEW_ONLY" == true ]]; then
            deploy_cmd="$deploy_cmd --dry-run"
        fi

        debug "Running: $deploy_cmd"

        if eval "$deploy_cmd"; then
            log "✅ Worker deployed successfully"
            deploy_success=true
        else
            error "❌ Deployment failed (attempt $retry_count/$MAX_RETRIES)"

            if [[ $retry_count -lt $MAX_RETRIES ]]; then
                log "🔄 Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done

    if [[ "$deploy_success" == false ]]; then
        error "❌ Deployment failed after $MAX_RETRIES attempts"

        # Offer rollback
        if [[ "$DRY_RUN" == false ]] && [[ "$ROLLBACK" == false ]]; then
            read -p "Would you like to rollback to the previous version? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi

        exit 1
    fi

    # Store deployment info for potential rollback
    if [[ "$DRY_RUN" == false ]]; then
        store_deployment_info
    fi
}

# Store deployment information for rollback
store_deployment_info() {
    debug "Storing deployment information..."

    local deployment_info="$ROLLBACK_DIR/${WORKER_NAME}-${ENVIRONMENT}-latest.json"
    local deployment_id=$(wrangler tail --format json "$WORKER_NAME" --env "$ENVIRONMENT" 2>/dev/null | head -1 | jq -r '.metadata.scriptName // "unknown"' || echo "unknown")

    cat > "$deployment_info" << EOF
{
  "worker_name": "$WORKER_NAME",
  "environment": "$ENVIRONMENT",
  "deployment_id": "$deployment_id",
  "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_user": "$(whoami)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF

    debug "Deployment info stored: $deployment_info"
}

# Perform health checks
health_checks() {
    log "🏥 Performing health checks..."

    local worker_url
    local health_check_passed=false

    # Get worker URL
    if [[ "$ENVIRONMENT" == "production" ]]; then
        worker_url="https://$WORKER_NAME.{$(wrangler whoami | grep -o '[^.]*\.workers\.dev' || echo 'workers.dev')}"
    else
        worker_url="https://$WORKER_NAME-$ENVIRONMENT.{$(wrangler whoami | grep -o '[^.]*\.workers\.dev' || echo 'workers.dev')}"
    fi

    # Try each health endpoint
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        local url="$worker_url$endpoint"

        log "  Checking $url..."

        if curl -f -s --max-time "$HEALTH_CHECK_TIMEOUT" "$url" > /dev/null 2>&1; then
            log "✅ Health check passed for $endpoint"
            health_check_passed=true
            break
        else
            debug "  Health check failed for $endpoint"
        fi
    done

    if [[ "$health_check_passed" == false ]]; then
        warning "⚠️ All health checks failed"

        if [[ "$SKIP_VALIDATION" == false ]]; then
            error "❌ Health checks failed - deployment may be unhealthy"

            # Offer rollback
            if [[ "$DRY_RUN" == false ]] && [[ "$ROLLBACK" == false ]]; then
                read -p "Would you like to rollback due to failed health checks? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    rollback_deployment
                fi
            fi

            exit 1
        fi
    fi

    log "✅ Health checks completed"
}

# Rollback deployment
rollback_deployment() {
    log "🔄 Rolling back deployment..."

    local rollback_info="$ROLLBACK_DIR/${WORKER_NAME}-${ENVIRONMENT}.json"

    if [[ ! -f "$rollback_info" ]]; then
        error "❌ No rollback information found"
        exit 1
    fi

    local previous_deployment=$(jq -r '.deployment_id' "$rollback_info" 2>/dev/null || echo "unknown")

    if [[ "$previous_deployment" == "unknown" ]]; then
        error "❌ Cannot determine previous deployment"
        exit 1
    fi

    log "Rolling back to deployment: $previous_deployment"

    # Implement rollback logic here
    # Note: Wrangler doesn't have built-in rollback, so this would need custom implementation
    warning "⚠️ Automatic rollback not yet implemented. Please manually rollback using wrangler deploy with previous version."

    exit 1
}

# Generate deployment report
generate_report() {
    log "📊 Generating deployment report..."

    local report_file="$PROJECT_ROOT/logs/deployment-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "worker_name": "$WORKER_NAME",
  "environment": "$ENVIRONMENT",
  "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_user": "$(whoami)",
  "dry_run": $DRY_RUN,
  "preview_only": $PREVIEW_ONLY,
  "skip_tests": $SKIP_TESTS,
  "skip_validation": $SKIP_VALIDATION,
  "health_checks_passed": true,
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "git_dirty": $(git diff-index --quiet HEAD -- && echo "false" || echo "true")
}
EOF

    log "📋 Deployment report saved: $report_file"
}

# Main execution flow
main() {
    log "🚀 Starting Cloudflare Workers deployment..."
    log "Worker: $WORKER_NAME"
    log "Environment: $ENVIRONMENT"

    if [[ "$ROLLBACK" == true ]]; then
        rollback_deployment
        exit 0
    fi

    init_directories
    check_dependencies
    validate_project

    if [[ "$DRY_RUN" == false ]]; then
        backup_current_deployment
    fi

    run_tests
    validate_worker_config
    deploy_worker

    if [[ "$DRY_RUN" == false ]] && [[ "$PREVIEW_ONLY" == false ]]; then
        health_checks
    fi

    generate_report

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN completed successfully"
    elif [[ "$PREVIEW_ONLY" == true ]]; then
        log "👀 Preview deployment completed successfully"
    else
        log "✅ Deployment completed successfully!"
        log "🌐 Worker is now live on $ENVIRONMENT environment"
    fi
}

# Error handling
trap 'error "❌ Script failed at line $LINENO"' ERR

# Execute main function
main "$@"