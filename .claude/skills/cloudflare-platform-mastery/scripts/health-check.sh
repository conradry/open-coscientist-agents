#!/bin/bash

# Cloudflare Deployment Health Check Script
# Comprehensive deployment health validation

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
HEALTH_DIR="$PROJECT_ROOT/.health-checks"

# Default values
DOMAIN=""
WORKER_NAME=""
PROJECT_NAME=""
ENDPOINTS=()
TIMEOUT=30
RETRY_COUNT=3
RETRY_DELAY=5
VERBOSE=false
JSON_OUTPUT=false
SLACK_WEBHOOK=""
EMAIL_RECIPIENTS=()
MONITOR_DASHBOARD=true
PERFORMANCE_THRESHOLD=5000
ERROR_THRESHOLD=5
UPTIME_THRESHOLD=99.9
GEO_LOCATIONS=("us" "eu" "asia" "australia" "south-america")

# Health check categories
CHECK_CATEGORIES=("dns" "ssl" "performance" "security" "functionality" "accessibility")

# Logging function
log() {
    local message="$1"
    local level="${2:-info}"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')

    if [[ "$JSON_OUTPUT" == true ]]; then
        return
    fi

    case $level in
        error)
            echo -e "${RED}[ERROR $timestamp] $message${NC}" >&2
            ;;
        warning)
            echo -e "${YELLOW}[WARNING $timestamp] $message${NC}"
            ;;
        success)
            echo -e "${GREEN}[SUCCESS $timestamp] $message${NC}"
            ;;
        info)
            echo -e "${BLUE}[INFO $timestamp] $message${NC}"
            ;;
        debug)
            if [[ "$VERBOSE" == true ]]; then
                echo -e "${BLUE}[DEBUG $timestamp] $message${NC}"
            fi
            ;;
    esac
}

# Help function
show_help() {
    cat << EOF
Cloudflare Deployment Health Check Script

USAGE:
    $0 [OPTIONS] TARGET

ARGUMENTS:
    TARGET                  Domain, worker name, or project to check

OPTIONS:
    -e, --endpoint URL      Additional endpoint to check (can be used multiple times)
    -t, --timeout SECONDS   Request timeout (default: 30)
    -r, --retry COUNT       Number of retries (default: 3)
    -d, --delay SECONDS     Delay between retries (default: 5)
    --category CAT          Specific check category (dns, ssl, performance, security, functionality, accessibility)
    --performance-threshold MS Performance threshold in milliseconds (default: 5000)
    --error-threshold COUNT Error threshold for failures (default: 5)
    --uptime-threshold PERCENT Uptime threshold percentage (default: 99.9)
    --geo-locations LOC    Comma-separated list of geo locations (default: us,eu,asia,australia,south-america)
    --slack-webhook URL     Slack webhook for notifications
    --email EMAIL           Email recipient for notifications (can be used multiple times)
    --no-dashboard          Skip monitor dashboard generation
    --json                  Output results in JSON format
    --verbose               Enable verbose logging
    -h, --help              Show this help message

CHECK CATEGORIES:
    dns           - DNS resolution and configuration
    ssl           - SSL certificate validity and security
    performance   - Page load times and performance metrics
    security      - Security headers and vulnerability checks
    functionality - Application functionality tests
    accessibility - Accessibility compliance checks

EXAMPLES:
    $0 example.com                                    # Basic health check
    $0 my-worker --worker                             # Check Cloudflare Worker
    $0 example.com -e /api/health -e /api/users      # Check specific endpoints
    $0 example.com --category performance --verbose   # Performance check only
    $0 example.com --slack-webhook https://hooks.slack.com/... --email admin@example.com

GEO LOCATIONS:
    us, eu, asia, australia, south-america, africa

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--endpoint)
            ENDPOINTS+=("$2")
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retry)
            RETRY_COUNT="$2"
            shift 2
            ;;
        -d|--delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --category)
            if [[ ! " ${CHECK_CATEGORIES[*]} " =~ " $2 " ]]; then
                error "Invalid category: $2"
                error "Valid categories: ${CHECK_CATEGORIES[*]}"
                exit 1
            fi
            CHECK_CATEGORIES=("$2")
            shift 2
            ;;
        --performance-threshold)
            PERFORMANCE_THRESHOLD="$2"
            shift 2
            ;;
        --error-threshold)
            ERROR_THRESHOLD="$2"
            shift 2
            ;;
        --uptime-threshold)
            UPTIME_THRESHOLD="$2"
            shift 2
            ;;
        --geo-locations)
            IFS=',' read -ra GEO_LOCATIONS <<< "$2"
            shift 2
            ;;
        --slack-webhook)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        --email)
            EMAIL_RECIPIENTS+=("$2")
            shift 2
            ;;
        --no-dashboard)
            MONITOR_DASHBOARD=false
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --worker)
            WORKER_MODE=true
            shift
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
            if [[ -z "$DOMAIN" ]]; then
                DOMAIN="$1"
            else
                error "Multiple targets provided: $DOMAIN and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$DOMAIN" ]]; then
    error "Target (domain, worker, or project) is required"
    show_help
    exit 1
fi

# Auto-detect target type
if [[ "${WORKER_MODE:-false}" == true ]] || [[ "$DOMAIN" =~ \.workers\.dev$ ]] || [[ "$DOMAIN" =~ \.pages\.dev$ ]]; then
    WORKER_NAME="$DOMAIN"
    TARGET_TYPE="worker"
elif command -v wrangler &> /dev/null && wrangler whoami &> /dev/null 2>&1; then
    # Check if it's a Pages project
    if wrangler pages project list 2>/dev/null | grep -q "$DOMAIN"; then
        PROJECT_NAME="$DOMAIN"
        TARGET_TYPE="pages"
    # Check if it's a Worker
    elif wrangler deployment list 2>/dev/null | grep -q "$DOMAIN"; then
        WORKER_NAME="$DOMAIN"
        TARGET_TYPE="worker"
    else
        TARGET_TYPE="domain"
    fi
else
    TARGET_TYPE="domain"
fi

# Initialize health check results
declare -A HEALTH_RESULTS
declare -A METRICS
declare -a WARNINGS
declare -a ERRORS

# Initialize directories
init_directories() {
    mkdir -p "$HEALTH_DIR"
    mkdir -p "$PROJECT_ROOT/logs/health-checks"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v dig &> /dev/null; then
        missing_deps+=("dig")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Perform HTTP request with retries
http_request() {
    local url="$1"
    local method="${2:-GET}"
    local headers="${3:-}"
    local data="${4:-}"
    local expected_status="${5:-200}"

    local attempt=1
    local response=""
    local status_code=0
    local response_time=0

    while [[ $attempt -le $RETRY_COUNT ]]; do
        local start_time=$(date +%s%N)

        if [[ -n "$data" ]]; then
            response=$(curl -s -w "%{http_code}:%{time_total}" \
                -X "$method" \
                -H "User-Agent: Cloudflare-HealthCheck/1.0" \
                $headers \
                --max-time "$TIMEOUT" \
                --data "$data" \
                "$url" 2>/dev/null || echo "000:0")
        else
            response=$(curl -s -w "%{http_code}:%{time_total}" \
                -X "$method" \
                -H "User-Agent: Cloudflare-HealthCheck/1.0" \
                $headers \
                --max-time "$TIMEOUT" \
                "$url" 2>/dev/null || echo "000:0")
        fi

        status_code=$(echo "$response" | tail -c -4 | head -c 3)
        response_time=$(echo "$response" | tail -c -7 | head -c 3)
        response=$(echo "$response" | sed 's/[0-9]\{3\}:[0-9]\+\.[0-9]\+$//')

        local end_time=$(date +%s%N)
        local total_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds

        log "Attempt $attempt/$RETRY_COUNT: $method $url -> $status_code (${total_time}ms)" debug

        if [[ "$status_code" == "$expected_status" ]]; then
            echo "$response|$status_code|$total_time"
            return 0
        fi

        if [[ $attempt -lt $RETRY_COUNT ]]; then
            log "Retrying in $RETRY_DELAY seconds..." warning
            sleep "$RETRY_DELAY"
        fi

        ((attempt++))
    done

    echo "$response|$status_code|$total_time"
    return 1
}

# DNS health check
check_dns() {
    log "🔍 Checking DNS configuration..." info

    local dns_issues=()

    # Check domain resolution
    local dns_result=$(dig +short "$DOMAIN" A 2>/dev/null || echo "")
    if [[ -z "$dns_result" ]]; then
        dns_issues+=("Domain does not resolve to A records")
    else
        log "✓ Domain resolves to: $dns_result" success
        METRICS["dns_resolution"]="success"
    fi

    # Check DNS propagation across different servers
    local dns_servers=("8.8.8.8" "1.1.1.1" "208.67.222.222")
    local propagation_consistent=true

    for server in "${dns_servers[@]}"; do
        local server_result=$(dig @"$server" +short "$DOMAIN" A 2>/dev/null || echo "")
        if [[ "$server_result" != "$dns_result" ]]; then
            propagation_consistent=false
            dns_issues+=("DNS propagation inconsistent with server $server")
        fi
    done

    if [[ "$propagation_consistent" == true ]]; then
        log "✓ DNS propagation consistent across servers" success
        METRICS["dns_propagation"]="consistent"
    fi

    # Check CAA records if present
    local caa_result=$(dig +short "$DOMAIN" CAA 2>/dev/null || echo "")
    if [[ -n "$caa_result" ]]; then
        log "✓ CAA records found: $caa_result" success
        METRICS["caa_records"]="present"
    fi

    # Check SPF records
    local spf_result=$(dig +short "$DOMAIN" TXT 2>/dev/null | grep -i "v=spf1" || echo "")
    if [[ -n "$spf_result" ]]; then
        log "✓ SPF record found" success
        METRICS["spf_record"]="present"
    fi

    # Check DMARC records
    local dmarc_result=$(dig +short "_dmarc.$DOMAIN" TXT 2>/dev/null || echo "")
    if [[ -n "$dmarc_result" ]]; then
        log "✓ DMARC record found" success
        METRICS["dmarc_record"]="present"
    fi

    # Set DNS health status
    if [[ ${#dns_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["dns"]="healthy"
        log "✅ DNS health check passed" success
    else
        HEALTH_RESULTS["dns"]="unhealthy"
        for issue in "${dns_issues[@]}"; do
            ERRORS+=("DNS: $issue")
        done
        log "❌ DNS health check failed" error
    fi
}

# SSL certificate health check
check_ssl() {
    log "🔒 Checking SSL certificate..." info

    local ssl_issues=()
    local cert_info=""

    # Get certificate information
    local cert_result=$(echo | timeout $TIMEOUT openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null || echo "")

    if [[ -z "$cert_result" ]]; then
        ssl_issues+=("Cannot retrieve SSL certificate")
    else
        # Check certificate validity period
        local not_after=$(echo "$cert_result" | grep "notAfter=" | cut -d= -f2)
        local not_before=$(echo "$cert_result" | grep "notBefore=" | cut -d= -f2)

        if [[ -n "$not_after" ]]; then
            local expiry_timestamp=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
            local current_timestamp=$(date +%s)
            local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))

            if [[ $days_until_expiry -lt 7 ]]; then
                ssl_issues+=("SSL certificate expires in $days_until_expiry days")
            elif [[ $days_until_expiry -lt 30 ]]; then
                WARNINGS+=("SSL certificate expires in $days_until_expiry days")
            fi

            log "✓ SSL certificate expires in $days_until_expiry days" success
            METRICS["ssl_expiry_days"]="$days_until_expiry"
        fi

        # Check certificate chain
        local cert_chain_result=$(echo | timeout $TIMEOUT openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" -verify_return_error 2>/dev/null && echo "valid" || echo "invalid")

        if [[ "$cert_chain_result" == "valid" ]]; then
            log "✓ SSL certificate chain is valid" success
            METRICS["ssl_chain"]="valid"
        else
            ssl_issues+=("SSL certificate chain is invalid")
        fi

        # Check for weak ciphers
        local cipher_result=$(echo | timeout $TIMEOUT openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" -cipher 'ALL:eNULL' 2>/dev/null | grep "Cipher is" || echo "")

        if [[ "$cipher_result" =~ (NULL|EXP|ADH|AECDH|RC4) ]]; then
            ssl_issues+=("SSL connection uses weak ciphers")
        else
            log "✓ SSL connection uses strong ciphers" success
            METRICS["ssl_ciphers"]="strong"
        fi

        # Check TLS version
        local tls_version=$(echo | timeout $TIMEOUT openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" -tls1_2 2>/dev/null | grep "Protocol.*TLSv1.2" && echo "TLSv1.2" || echo "incompatible")

        if [[ "$tls_version" == "TLSv1.2" ]]; then
            log "✓ TLS 1.2 supported" success
            METRICS["tls_version"]="TLSv1.2+"
        else
            ssl_issues+=("TLS 1.2 not supported")
        fi
    fi

    # Set SSL health status
    if [[ ${#ssl_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["ssl"]="healthy"
        log "✅ SSL health check passed" success
    else
        HEALTH_RESULTS["ssl"]="unhealthy"
        for issue in "${ssl_issues[@]}"; do
            ERRORS+=("SSL: $issue")
        done
        log "❌ SSL health check failed" error
    fi
}

# Performance health check
check_performance() {
    log "⚡ Checking performance..." info

    local performance_issues=()
    local url="https://$DOMAIN"
    local total_response_time=0
    local successful_requests=0

    # Add default endpoints if none specified
    if [[ ${#ENDPOINTS[@]} -eq 0 ]]; then
        ENDPOINTS=("/")
    fi

    # Test each endpoint
    for endpoint in "${ENDPOINTS[@]}"; do
        local test_url="${url}${endpoint}"
        log "Testing endpoint: $test_url" debug

        for i in $(seq 1 $RETRY_COUNT); do
            local request_result=$(http_request "$test_url")
            IFS='|' read -r response status_code response_time <<< "$request_result"

            if [[ "$status_code" == "200" ]]; then
                total_response_time=$((total_response_time + response_time))
                ((successful_requests++))

                if [[ $response_time -gt $PERFORMANCE_THRESHOLD ]]; then
                    performance_issues+=("Slow response time for $endpoint: ${response_time}ms")
                fi
            else
                performance_issues+=("HTTP error for $endpoint: $status_code")
            fi

            sleep 1
        done
    done

    # Calculate average response time
    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time=$((total_response_time / successful_requests))
        METRICS["avg_response_time"]="$avg_response_time"
        METRICS["successful_requests"]="$successful_requests"

        log "✓ Average response time: ${avg_response_time}ms" success

        # Check performance threshold
        if [[ $avg_response_time -gt $PERFORMANCE_THRESHOLD ]]; then
            performance_issues+=("Average response time exceeds threshold: ${avg_response_time}ms > ${PERFORMANCE_THRESHOLD}ms")
        fi
    else
        performance_issues+=("No successful requests")
    fi

    # Geo-location performance test
    local geo_issues=()
    for location in "${GEO_LOCATIONS[@]}"; do
        local geo_url=$(get_geo_test_url "$location")
        if [[ -n "$geo_url" ]]; then
            log "Testing from $location..." debug
            local geo_result=$(http_request "$geo_url")
            IFS='|' read -r geo_response geo_status geo_time <<< "$geo_result"

            if [[ "$geo_status" != "200" ]]; then
                geo_issues+=("Location $location: HTTP $geo_status")
            elif [[ $geo_time -gt $((PERFORMANCE_THRESHOLD * 2)) ]]; then
                geo_issues+=("Location $location: Slow response ${geo_time}ms")
            fi
        fi
    done

    if [[ ${#geo_issues[@]} -gt 0 ]]; then
        for issue in "${geo_issues[@]}"; do
            WARNINGS+=("Performance (Geo): $issue")
        done
    fi

    # Set performance health status
    if [[ ${#performance_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["performance"]="healthy"
        log "✅ Performance health check passed" success
    else
        HEALTH_RESULTS["performance"]="degraded"
        for issue in "${performance_issues[@]}"; do
            ERRORS+=("Performance: $issue")
        done
        log "⚠️ Performance health check shows issues" warning
    fi
}

# Security health check
check_security() {
    log "🛡️ Checking security..." info

    local security_issues=()
    local url="https://$DOMAIN"

    # Check security headers
    local security_headers=(
        "X-Frame-Options"
        "X-Content-Type-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
        "Content-Security-Policy"
        "Referrer-Policy"
    )

    local headers_result=$(http_request "$url")
    IFS='|' read -r response status_code response_time <<< "$headers_result"

    for header in "${security_headers[@]}"; do
        if echo "$response" | grep -i "^$header:" &>/dev/null; then
            log "✓ Security header present: $header" success
            METRICS["security_header_$header"]="present"
        else
            security_issues+=("Missing security header: $header")
        fi
    done

    # Check for common vulnerabilities
    local test_endpoints=(
        "/.env"
        "/.git/config"
        "/wp-admin/"
        "/admin/"
        "/phpmyadmin/"
    )

    for test_endpoint in "${test_endpoints[@]}"; do
        local vuln_result=$(http_request "${url}${test_endpoint}")
        IFS='|' read -r vuln_response vuln_status vuln_time <<< "$vuln_result"

        # These endpoints should not be accessible
        if [[ "$vuln_status" =~ ^(200|301|302)$ ]]; then
            security_issues+=("Potentially exposed sensitive path: $test_endpoint")
        fi
    done

    # Check for information disclosure
    local info_disclosure=$(echo "$response" | grep -i -E "(server:|x-powered-by:|x-aspnet-version)" || echo "")
    if [[ -n "$info_disclosure" ]]; then
        security_issues+=("Information disclosure in headers: $info_disclosure")
    fi

    # Set security health status
    if [[ ${#security_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["security"]="healthy"
        log "✅ Security health check passed" success
    else
        HEALTH_RESULTS["security"]="unhealthy"
        for issue in "${security_issues[@]}"; do
            ERRORS+=("Security: $issue")
        done
        log "❌ Security health check failed" error
    fi
}

# Functionality health check
check_functionality() {
    log "🔧 Checking functionality..." info

    local functionality_issues=()
    local url="https://$DOMAIN"

    # Basic functionality checks
    local checks=(
        "/:Home page accessible"
        "/robots.txt:Robots.txt accessible"
        "/favicon.ico:Favicon accessible"
        "/sitemap.xml:Sitemap accessible (if exists)"
    )

    for check in "${checks[@]}"; do
        IFS=':' read -r endpoint description <<< "$check"
        local test_url="${url}${endpoint}"

        local func_result=$(http_request "$test_url" "GET" "" "" "200")
        IFS='|' read -r func_response func_status func_time <<< "$func_result"

        if [[ "$func_status" == "200" ]]; then
            log "✓ $description" success
            METRICS["functional_$endpoint"]="accessible"
        elif [[ "$endpoint" == "/sitemap.xml" ]] && [[ "$func_status" == "404" ]]; then
            log "ℹ Sitemap not found (optional)" debug
        else
            functionality_issues+=("$description not accessible (HTTP $func_status)")
        fi
    done

    # Check custom endpoints if specified
    for endpoint in "${ENDPOINTS[@]}"; do
        if [[ "$endpoint" != "/" ]]; then
            local test_url="${url}${endpoint}"
            local custom_result=$(http_request "$test_url")
            IFS='|' read -r custom_response custom_status custom_time <<< "$custom_result"

            if [[ "$custom_status" =~ ^(200|201|204)$ ]]; then
                log "✓ Custom endpoint accessible: $endpoint" success
                METRICS["functional_custom_$endpoint"]="accessible"
            else
                functionality_issues+=("Custom endpoint not accessible: $endpoint (HTTP $custom_status)")
            fi
        fi
    done

    # Set functionality health status
    if [[ ${#functionality_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["functionality"]="healthy"
        log "✅ Functionality health check passed" success
    else
        HEALTH_RESULTS["functionality"]="unhealthy"
        for issue in "${functionality_issues[@]}"; do
            ERRORS+=("Functionality: $issue")
        done
        log "❌ Functionality health check failed" error
    fi
}

# Accessibility health check
check_accessibility() {
    log "♿ Checking accessibility..." info

    local accessibility_issues=()
    local url="https://$DOMAIN"

    # Basic accessibility checks
    local html_result=$(http_request "$url")
    IFS='|' read -r html_response html_status html_time <<< "$html_result"

    if [[ "$html_status" == "200" ]]; then
        # Check for lang attribute
        if echo "$html_response" | grep -i 'html lang=' &>/dev/null; then
            log "✓ HTML lang attribute present" success
            METRICS["a11y_lang"]="present"
        else
            accessibility_issues+=("Missing HTML lang attribute")
        fi

        # Check for page title
        if echo "$html_response" | grep -i '<title>' &>/dev/null; then
            log "✓ Page title present" success
            METRICS["a11y_title"]="present"
        else
            accessibility_issues+=("Missing page title")
        fi

        # Check for meta description
        if echo "$html_response" | grep -i 'meta.*description' &>/dev/null; then
            log "✓ Meta description present" success
            METRICS["a11y_meta_description"]="present"
        else
            accessibility_issues+=("Missing meta description")
        fi

        # Check for alt attributes on images
        local images_without_alt=$(echo "$html_response" | grep -o '<img[^>]*>' | grep -v 'alt=' | wc -l || echo "0")
        if [[ "$images_without_alt" -gt 0 ]]; then
            accessibility_issues+=("$images_without_alt images without alt attributes")
        else
            log "✓ All images have alt attributes" success
            METRICS["a11y_image_alt"]="complete"
        fi

        # Check for heading structure
        if echo "$html_response" | grep -i '<h1' &>/dev/null; then
            log "✓ H1 heading present" success
            METRICS["a11y_h1"]="present"
        else
            accessibility_issues+=("Missing H1 heading")
        fi

        # Check for viewport meta tag
        if echo "$html_response" | grep -i 'meta.*viewport' &>/dev/null; then
            log "✓ Viewport meta tag present" success
            METRICS["a11y_viewport"]="present"
        else
            accessibility_issues+=("Missing viewport meta tag")
        fi
    else
        accessibility_issues+=("Cannot access page for accessibility check (HTTP $html_status)")
    fi

    # Set accessibility health status
    if [[ ${#accessibility_issues[@]} -eq 0 ]]; then
        HEALTH_RESULTS["accessibility"]="healthy"
        log "✅ Accessibility health check passed" success
    else
        HEALTH_RESULTS["accessibility"]="degraded"
        for issue in "${accessibility_issues[@]}"; do
            WARNINGS+=("Accessibility: $issue")
        done
        log "⚠️ Accessibility health check shows issues" warning
    fi
}

# Get geo test URL for performance testing
get_geo_test_url() {
    local location="$1"

    case $location in
        "us")
            echo "https://$DOMAIN"
            ;;
        "eu")
            echo "https://$DOMAIN"
            ;;
        "asia")
            echo "https://$DOMAIN"
            ;;
        *)
            echo "https://$DOMAIN"
            ;;
    esac
}

# Send notifications
send_notifications() {
    local overall_status="$1"
    local summary="$2"

    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        send_slack_notification "$overall_status" "$summary"
    fi

    # Send email notifications
    if [[ ${#EMAIL_RECIPIENTS[@]} -gt 0 ]]; then
        send_email_notifications "$overall_status" "$summary"
    fi
}

# Send Slack notification
send_slack_notification() {
    local status="$1"
    local summary="$2"

    local color="good"
    if [[ "$status" == "unhealthy" ]]; then
        color="danger"
    elif [[ "$status" == "degraded" ]]; then
        color="warning"
    fi

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Health Check Results for $DOMAIN",
            "text": "$summary",
            "fields": [
                {
                    "title": "Status",
                    "value": "$status",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
                    "short": true
                }
            ],
            "footer": "Cloudflare Health Check",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" &>/dev/null || log "Failed to send Slack notification" warning
}

# Send email notifications
send_email_notifications() {
    local status="$1"
    local summary="$2"

    for recipient in "${EMAIL_RECIPIENTS[@]}"; do
        if command -v mail &> /dev/null; then
            echo "$summary" | mail -s "Health Check Results for $DOMAIN: $status" "$recipient" || \
                log "Failed to send email to $recipient" warning
        else
            log "Email command not available, skipping email notification" warning
        fi
    done
}

# Generate monitor dashboard
generate_dashboard() {
    if [[ "$MONITOR_DASHBOARD" == false ]]; then
        return
    fi

    local dashboard_file="$HEALTH_DIR/dashboard-$(date +%Y%m%d-%H%M%S).html"

    cat > "$dashboard_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Check Dashboard - $DOMAIN</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; }
        .status-healthy { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
        .details { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Health Check Dashboard</h1>
            <p><strong>Target:</strong> $DOMAIN | <strong>Status:</strong> $(get_overall_status) | <span class="timestamp">$(date -u +%Y-%m-%dT%H:%M:%SZ)</span></p>
        </div>

        <div class="metrics">
EOF

    # Add metric cards
    for category in "${CHECK_CATEGORIES[@]}"; do
        local status="${HEALTH_RESULTS[$category]:-unknown}"
        local status_class="status-$(echo "$status" | sed 's/healthy/healthy/' | sed 's/degraded/warning/' | sed 's/unhealthy/error/' | sed 's/unknown/warning/')"

        cat >> "$dashboard_file" << EOF
            <div class="metric-card">
                <h3>$category</h3>
                <p class="$status_class">Status: $status</p>
EOF

        # Add category-specific metrics
        case $category in
            "dns")
                if [[ -n "${METRICS[dns_resolution]:-}" ]]; then
                    echo "<p>DNS Resolution: ${METRICS[dns_resolution]}</p>" >> "$dashboard_file"
                fi
                ;;
            "ssl")
                if [[ -n "${METRICS[ssl_expiry_days]:-}" ]]; then
                    echo "<p>SSL Expires In: ${METRICS[ssl_expiry_days]} days</p>" >> "$dashboard_file"
                fi
                ;;
            "performance")
                if [[ -n "${METRICS[avg_response_time]:-}" ]]; then
                    echo "<p>Avg Response Time: ${METRICS[avg_response_time]}ms</p>" >> "$dashboard_file"
                fi
                ;;
        esac

        cat >> "$dashboard_file" << EOF
            </div>
EOF
    done

    cat >> "$dashboard_file" << EOF
        </div>

        <div class="details">
            <h2>Detailed Results</h2>
EOF

    # Add errors and warnings
    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        cat >> "$dashboard_file" << EOF
            <h3>Errors</h3>
            <ul>
EOF
        for error in "${ERRORS[@]}"; do
            echo "<li class=\"status-error\">$error</li>" >> "$dashboard_file"
        done
        cat >> "$dashboard_file" << EOF
            </ul>
EOF
    fi

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        cat >> "$dashboard_file" << EOF
            <h3>Warnings</h3>
            <ul>
EOF
        for warning in "${WARNINGS[@]}"; do
            echo "<li class=\"status-warning\">$warning</li>" >> "$dashboard_file"
        done
        cat >> "$dashboard_file" << EOF
            </ul>
EOF
    fi

    cat >> "$dashboard_file" << EOF
        </div>
    </div>

    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>
EOF

    log "📊 Dashboard generated: $dashboard_file" success
}

# Calculate overall health status
get_overall_status() {
    local healthy_count=0
    local total_count=${#CHECK_CATEGORIES[@]}

    for category in "${CHECK_CATEGORIES[@]}"; do
        if [[ "${HEALTH_RESULTS[$category]:-unknown}" == "healthy" ]]; then
            ((healthy_count++))
        fi
    done

    local health_percentage=$((healthy_count * 100 / total_count))

    if [[ $health_percentage -eq 100 ]]; then
        echo "healthy"
    elif [[ $health_percentage -ge 70 ]]; then
        echo "degraded"
    else
        echo "unhealthy"
    fi
}

# Generate JSON output
generate_json_output() {
    local overall_status=$(get_overall_status)

    cat << EOF
{
    "target": "$DOMAIN",
    "target_type": "$TARGET_TYPE",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overall_status": "$overall_status",
    "categories": {
EOF

    local first=true
    for category in "${CHECK_CATEGORIES[@]}"; do
        if [[ "$first" == false ]]; then
            echo "," >> /tmp/json_output.tmp
        fi
        echo "        \"$category\": \"${HEALTH_RESULTS[$category]:-unknown}\"" >> /tmp/json_output.tmp
        first=false
    done

    cat << EOF
    },
    "metrics": {
EOF

    first=true
    for metric in "${!METRICS[@]}"; do
        if [[ "$first" == false ]]; then
            echo "," >> /tmp/json_output.tmp
        fi
        echo "        \"$metric\": \"${METRICS[$metric]}\"" >> /tmp/json_output.tmp
        first=false
    done

    cat << EOF
    },
    "errors": [
EOF

    first=true
    for error in "${ERRORS[@]}"; do
        if [[ "$first" == false ]]; then
            echo "," >> /tmp/json_output.tmp
        fi
        echo "        \"$error\"" >> /tmp/json_output.tmp
        first=false
    done

    cat << EOF
    ],
    "warnings": [
EOF

    first=true
    for warning in "${WARNINGS[@]}"; do
        if [[ "$first" == false ]]; then
            echo "," >> /tmp/json_output.tmp
        fi
        echo "        \"$warning\"" >> /tmp/json_output.tmp
        first=false
    done

    cat << EOF
    ],
    "configuration": {
        "timeout": $TIMEOUT,
        "retry_count": $RETRY_COUNT,
        "retry_delay": $RETRY_DELAY,
        "performance_threshold": $PERFORMANCE_THRESHOLD,
        "endpoints": [$(printf '"%s",' "${ENDPOINTS[@]}" | sed 's/,$//')]
    }
}
EOF

    if [[ -f /tmp/json_output.tmp ]]; then
        cat /tmp/json_output.tmp
        rm -f /tmp/json_output.tmp
    fi
}

# Main execution flow
main() {
    log "🚀 Starting health check for $DOMAIN..." info
    log "Target type: $TARGET_TYPE" debug
    log "Categories: ${CHECK_CATEGORIES[*]}" debug

    init_directories
    check_dependencies

    # Run health checks based on requested categories
    for category in "${CHECK_CATEGORIES[@]}"; do
        case $category in
            dns)
                check_dns
                ;;
            ssl)
                check_ssl
                ;;
            performance)
                check_performance
                ;;
            security)
                check_security
                ;;
            functionality)
                check_functionality
                ;;
            accessibility)
                check_accessibility
                ;;
        esac
    done

    # Calculate overall status
    local overall_status=$(get_overall_status)
    local error_count=${#ERRORS[@]}
    local warning_count=${#WARNINGS[@]}

    # Generate summary
    local summary="Health check completed. Status: $overall_status. Errors: $error_count, Warnings: $warning_count"

    if [[ "$JSON_OUTPUT" == true ]]; then
        generate_json_output
    else
        log "📊 Health Check Summary" info
        log "Overall Status: $overall_status" info
        log "Errors: $error_count" info
        log "Warnings: $warning_count" info

        if [[ $error_count -gt 0 ]]; then
            log "❌ Errors found:" error
            for error in "${ERRORS[@]}"; do
                log "  • $error" error
            done
        fi

        if [[ $warning_count -gt 0 ]]; then
            log "⚠️ Warnings:" warning
            for warning in "${WARNINGS[@]}"; do
                log "  • $warning" warning
            done
        fi

        if [[ "$overall_status" == "healthy" ]]; then
            log "✅ All health checks passed!" success
        fi
    fi

    # Generate dashboard
    generate_dashboard

    # Send notifications
    if [[ -n "$SLACK_WEBHOOK" ]] || [[ ${#EMAIL_RECIPIENTS[@]} -gt 0 ]]; then
        send_notifications "$overall_status" "$summary"
    fi

    # Set exit code based on health status
    if [[ "$overall_status" == "unhealthy" ]]; then
        exit 1
    elif [[ "$overall_status" == "degraded" ]]; then
        exit 2
    else
        exit 0
    fi
}

# Error handling
trap 'log "Script failed at line $LINENO" error' ERR

# Execute main function
main "$@"