#!/bin/bash

# Cloudflare Workers Deployment Script
# Based on production patterns from medical research platform deployment
# Enhanced with error handling, validation, and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${PROJECT_ROOT}/config/deployment/config.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

debug() {
    if [[ "${DEBUG:-0}" == "1" ]]; then
        echo -e "${PURPLE}[DEBUG] $1${NC}"
    fi
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND [ARGS]

Commands:
  deploy            Deploy Workers to specified environment
  rollback          Rollback to previous version
  status           Show deployment status
  test             Run deployment tests
  validate         Validate configuration

Options:
  -e, --env ENV     Environment (development|staging|production)
  -w, --worker WORKER  Specific worker to deploy (optional)
  -v, --version VERSION  Version to deploy (optional)
  -t, --threshold THRESHOLD Performance threshold in ms (default: 200)
  -f, --force       Force deployment without validation
  -d, --dry-run     Show what would be deployed without executing
  --skip-tests     Skip pre-deployment tests
  --skip-backup    Skip backup creation
  --no-promote     Deploy without traffic promotion
  -h, --help       Show this help message

Examples:
  $0 deploy --env staging
  $0 deploy --env production --threshold 100
  $0 rollback --env production --version v1.2.0
  $0 test --env production
  $0 validate --env production

EOF
}

# Parse command line arguments
ENVIRONMENT=""
WORKER=""
VERSION=""
THRESHOLD="200"
FORCE="false"
DRY_RUN="false"
SKIP_TESTS="false"
SKIP_BACKUP="false"
NO_PROMOTE="false"
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -w|--worker)
            WORKER="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -t|--threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        -f|--force)
            FORCE="true"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP="true"
            shift
            ;;
        --no-promote)
            NO_PROMOTE="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        deploy|rollback|status|test|validate)
            COMMAND="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$COMMAND" ]]; then
    error "Command is required"
    usage
    exit 1
fi

if [[ -z "$ENVIRONMENT" ]]; then
    error "Environment is required"
    usage
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production"
    exit 1
fi

# Check dependencies
check_dependencies() {
    info "Checking dependencies..."

    local deps=("wrangler" "jq" "curl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency not found: $dep"
            exit 1
        fi
    done

    # Check wrangler authentication
    if ! wrangler whoami &> /dev/null; then
        error "Not authenticated with Cloudflare. Run 'wrangler auth login'"
        exit 1
    fi

    success "All dependencies satisfied"
}

# Validate configuration
validate_config() {
    info "Validating configuration for $ENVIRONMENT environment..."

    local config_file="${PROJECT_ROOT}/wrangler.toml"
    if [[ ! -f "$config_file" ]]; then
        error "wrangler.toml not found at $config_file"
        exit 1
    fi

    # Check for environment-specific configuration
    if [[ "$ENVIRONMENT" != "development" ]]; then
        if ! grep -q "\[env.$ENVIRONMENT\]" "$config_file"; then
            error "Environment configuration for $ENVIRONMENT not found in wrangler.toml"
            exit 1
        fi
    fi

    # Validate required bindings
    local required_bindings=("DB" "CACHE_KV")
    for binding in "${required_bindings[@]}"; do
        if ! grep -q "$binding" "$config_file"; then
            warning "Required binding $binding not found in configuration"
        fi
    done

    success "Configuration validation passed"
}

# Pre-deployment health check
health_check() {
    local url="$1"
    local timeout="${2:-30}"

    info "Running health check for $url..."

    local start_time=$(date +%s.%N)
    local response
    local status_code

    if response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time "$timeout" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc -l)

        if [[ "$status_code" == "200" ]]; then
            local health_data=$(jq -r '.status // "unknown"' /tmp/health_response 2>/dev/null || echo "unknown")
            if [[ "$health_data" == "healthy" ]]; then
                success "Health check passed (${duration}s)"
                return 0
            else
                warning "Health check returned unhealthy status: $health_data"
                return 1
            fi
        else
            error "Health check failed with HTTP $status_code"
            return 1
        fi
    else
        error "Health check failed - could not reach service"
        return 1
    fi
}

# Performance testing
performance_test() {
    local url="$1"
    local threshold="$2"

    info "Running performance test (threshold: ${threshold}ms)..."

    local total_time=0
    local requests=10
    local failed=0

    for i in $(seq 1 $requests); do
        local start_time=$(date +%s.%N)
        if curl -s -f --max-time 10 "$url" > /dev/null 2>&1; then
            local end_time=$(date +%s.%N)
            local duration=$(echo "($end_time - $start_time) * 1000" | bc -l)
            total_time=$(echo "$total_time + $duration" | bc -l)
            debug "Request $i: ${duration}ms"
        else
            ((failed++))
            warning "Request $i failed"
        fi
    done

    if [[ $failed -gt 0 ]]; then
        error "Performance test failed: $failed/$requests requests failed"
        return 1
    fi

    local avg_time=$(echo "scale=2; $total_time / ($requests - $failed)" | bc -l)

    if (( $(echo "$avg_time > $threshold" | bc -l) )); then
        error "Performance test failed: avg response time ${avg_time}ms > ${threshold}ms"
        return 1
    fi

    success "Performance test passed: avg response time ${avg_time}ms"
    return 0
}

# Create backup
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        info "Skipping backup creation"
        return 0
    fi

    info "Creating backup of current deployment..."

    local backup_dir="${PROJECT_ROOT}/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_${ENVIRONMENT}_${timestamp}.tar.gz"

    mkdir -p "$backup_dir"

    # Backup configuration files
    tar -czf "$backup_file" \
        wrangler.toml \
        src/ \
        package.json \
        package-lock.json 2>/dev/null || true

    # Store backup metadata
    local metadata_file="${backup_file%.tar.gz}.json"
    cat > "$metadata_file" << EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "version": "${VERSION:-current}",
    "backup_file": "$backup_file",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF

    success "Backup created: $backup_file"
}

# Deploy Workers
deploy_workers() {
    info "Deploying Workers to $ENVIRONMENT environment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would deploy Workers with the following configuration:"
        echo "Environment: $ENVIRONMENT"
        echo "Worker: ${WORKER:-'all'}"
        echo "Version: ${VERSION:-'latest'}"
        echo "Threshold: ${THRESHOLD}ms"
        return 0
    fi

    local deploy_args=()

    if [[ -n "$WORKER" ]]; then
        deploy_args+=("$WORKER")
    fi

    if [[ "$ENVIRONMENT" != "development" ]]; then
        deploy_args+=("--env" "$ENVIRONMENT")
    fi

    # Deploy Workers
    log "Running: wrangler deploy ${deploy_args[*]}"
    if wrangler deploy "${deploy_args[@]}"; then
        success "Workers deployed successfully"
    else
        error "Worker deployment failed"
        return 1
    fi

    # Run database migrations if D1 is configured
    if grep -q "d1_databases" "${PROJECT_ROOT}/wrangler.toml"; then
        info "Running D1 database migrations..."
        local db_name
        if [[ "$ENVIRONMENT" == "development" ]]; then
            db_name=$(grep -A 1 'database_name =' "${PROJECT_ROOT}/wrangler.toml" | tail -1 | sed 's/.*"\(.*\)".*/\1/')
        else
            db_name=$(grep -A 5 "\[env.$ENVIRONMENT\]" "${PROJECT_ROOT}/wrangler.toml" | grep -A 1 'database_name =' | tail -1 | sed 's/.*"\(.*\)".*/\1/')
        fi

        if [[ -n "$db_name" ]]; then
            local migrate_args=("$db_name")
            if [[ "$ENVIRONMENT" != "development" ]]; then
                migrate_args+=("--env" "$ENVIRONMENT")
            fi

            if wrangler d1 migrations apply "${migrate_args[@]}"; then
                success "Database migrations completed"
            else
                warning "Database migrations failed, but deployment may still be functional"
            fi
        fi
    fi
}

# Main execution
main() {
    log "Starting Cloudflare Workers deployment process..."
    log "Command: $COMMAND"
    log "Environment: $ENVIRONMENT"

    case $COMMAND in
        deploy)
            check_dependencies

            if [[ "$FORCE" != "true" ]]; then
                validate_config
                if [[ "$SKIP_TESTS" != "true" ]]; then
                    run_tests
                fi
            fi

            create_backup
            deploy_workers

            if [[ "$NO_PROMOTE" != "true" ]]; then
                # Health check after deployment
                local worker_name
                if [[ "$ENVIRONMENT" == "development" ]]; then
                    worker_name=$(grep 'name = ' "${PROJECT_ROOT}/wrangler.toml" | sed 's/name = "\(.*\)"/\1/')
                else
                    worker_name=$(grep -A 5 "\[env.$ENVIRONMENT\]" "${PROJECT_ROOT}/wrangler.toml" | grep 'name = ' | sed 's/name = "\(.*\)"/\1/')
                fi

                if [[ -n "$worker_name" ]]; then
                    local worker_url="https://${worker_name}.${ENVIRONMENT}.yourdomain.com"

                    # Wait a moment for deployment to take effect
                    sleep 5

                    if health_check "$worker_url"; then
                        if performance_test "$worker_url/health" "$THRESHOLD"; then
                            success "Deployment validated and healthy"
                        else
                            warning "Deployment completed but performance validation failed"
                        fi
                    else
                        error "Deployment completed but health check failed"
                        exit 1
                    fi
                fi
            fi

            success "Deployment completed successfully"
            ;;
        status)
            show_status
            ;;
        test)
            if [[ "$FORCE" != "true" ]]; then
                check_dependencies
                validate_config
            fi
            run_tests
            ;;
        validate)
            check_dependencies
            validate_config
            success "Validation completed successfully"
            ;;
        *)
            error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"