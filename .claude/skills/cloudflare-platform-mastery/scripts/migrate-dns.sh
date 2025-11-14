#!/bin/bash

# Cloudflare DNS Migration Script
# Zero-downtime DNS migration from other providers

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
MIGRATION_DIR="$PROJECT_ROOT/.dns-migration"
BACKUP_DIR="$MIGRATION_DIR/backups"

# Default values
DOMAIN=""
SOURCE_PROVIDER=""
API_TOKEN=""
EMAIL=""
API_KEY=""
DRY_RUN=false
VERIFY_ONLY=false
FORCE=false
TTL=300  # 5 minutes for zero-downtime
SERIAL_INCREMENT=1
LOG_LEVEL="info"
PROGRESS_FILE=""

# DNS providers configuration
declare -A PROVIDERS=(
    ["cloudflare"]="cloudflare"
    ["route53"]="route53"
    ["godaddy"]="godaddy"
    ["namecheap"]="namecheap"
    ["bluehost"]="bluehost"
    ["digitalocean"]="digitalocean"
    ["vultr"]="vultr"
    ["linode"]="linode"
    ["google"]="google"
)

# Required record types for migration
REQUIRED_RECORD_TYPES=(
    "A"
    "AAAA"
    "CNAME"
    "MX"
    "TXT"
    "SRV"
    "NS"
    "CAA"
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

# Progress tracking
track_progress() {
    local stage="$1"
    local message="$2"
    local timestamp=$(date +%s)

    if [[ -n "$PROGRESS_FILE" ]]; then
        echo "{\"stage\": \"$stage\", \"message\": \"$message\", \"timestamp\": $timestamp}" >> "$PROGRESS_FILE"
    fi

    log "[$stage] $message"
}

# Help function
show_help() {
    cat << EOF
Cloudflare DNS Migration Script

USAGE:
    $0 [OPTIONS] DOMAIN

ARGUMENTS:
    DOMAIN                  Domain to migrate

REQUIRED OPTIONS:
    -s, --source PROVIDER   Source DNS provider
    -t, --token TOKEN       Cloudflare API token

PROVIDER-SPECIFIC OPTIONS:
    Route53:
        --aws-key KEY       AWS access key
        --aws-secret SECRET AWS secret key
        --aws-region REGION AWS region (default: us-east-1)

    GoDaddy:
        --godaddy-key KEY   GoDaddy API key
        --godaddy-secret SECRET GoDaddy API secret

    Namecheap:
        --namecheap-key KEY Namecheap API key
        --namecheap-user USER Namecheap username

    DigitalOcean:
        --do-token TOKEN   DigitalOcean API token

    Google DNS:
        --google-key FILE  Path to Google service account key file

GENERAL OPTIONS:
    -e, --email EMAIL       Cloudflare account email
    --ttl SECONDS           TTL for new records (default: 300)
    --dry-run               Show what would be migrated without making changes
    --verify-only           Verify existing setup without migration
    --force                 Skip confirmation prompts
    --log-level LEVEL       Log level (debug, info, warn, error)
    --progress-file FILE    File to track migration progress
    -h, --help              Show this help message

SUPPORTED PROVIDERS:
    cloudflare, route53, godaddy, namecheap, bluehost,
    digitalocean, vultr, linode, google

EXAMPLES:
    $0 example.com -s route53 -t cf_token --aws-key key --aws-secret secret
    $0 example.com -s godaddy -t cf_token --godaddy-key key --godaddy-secret secret
    $0 example.com -s digitalocean -t cf_token --do-token token --dry-run

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--source)
            SOURCE_PROVIDER="$2"
            shift 2
            ;;
        -t|--token)
            API_TOKEN="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL="$2"
            shift 2
            ;;
        --ttl)
            TTL="$2"
            shift 2
            ;;
        --aws-key)
            AWS_ACCESS_KEY="$2"
            shift 2
            ;;
        --aws-secret)
            AWS_SECRET_KEY="$2"
            shift 2
            ;;
        --aws-region)
            AWS_REGION="$2"
            shift 2
            ;;
        --godaddy-key)
            GODADDY_API_KEY="$2"
            shift 2
            ;;
        --godaddy-secret)
            GODADDY_API_SECRET="$2"
            shift 2
            ;;
        --namecheap-key)
            NAMECHEAP_API_KEY="$2"
            shift 2
            ;;
        --namecheap-user)
            NAMECHEAP_API_USER="$2"
            shift 2
            ;;
        --do-token)
            DIGITALOCEAN_TOKEN="$2"
            shift 2
            ;;
        --google-key)
            GOOGLE_KEY_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --progress-file)
            PROGRESS_FILE="$2"
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
            if [[ -z "$DOMAIN" ]]; then
                DOMAIN="$1"
            else
                error "Multiple domains provided: $DOMAIN and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$DOMAIN" ]]; then
    error "Domain is required"
    show_help
    exit 1
fi

if [[ -z "$SOURCE_PROVIDER" ]]; then
    error "Source provider is required"
    show_help
    exit 1
fi

if [[ -z "${PROVIDERS[$SOURCE_PROVIDER]:-}" ]]; then
    error "Unsupported source provider: $SOURCE_PROVIDER"
    error "Supported providers: ${!PROVIDERS[*]}"
    exit 1
fi

if [[ -z "$API_TOKEN" ]]; then
    error "Cloudflare API token is required"
    show_help
    exit 1
fi

# Initialize directories
init_directories() {
    mkdir -p "$MIGRATION_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_ROOT/logs"

    if [[ -n "$PROGRESS_FILE" ]]; then
        > "$PROGRESS_FILE"  # Initialize progress file
    fi
}

# Check dependencies
check_dependencies() {
    debug "Checking dependencies..."

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

    # Provider-specific dependencies
    case $SOURCE_PROVIDER in
        route53)
            if ! command -v aws &> /dev/null; then
                missing_deps+=("aws-cli")
            fi
            ;;
        google)
            if ! command -v gcloud &> /dev/null; then
                missing_deps+=("gcloud")
            fi
            ;;
    esac

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error "Missing dependencies: ${missing_deps[*]}"
        error "Please install the missing tools and try again"
        exit 1
    fi

    debug "Dependencies check passed"
}

# Validate domain format
validate_domain() {
    debug "Validating domain format: $DOMAIN"

    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        error "Invalid domain format: $DOMAIN"
        exit 1
    fi

    debug "Domain format validation passed"
}

# Validate API credentials
validate_credentials() {
    debug "Validating API credentials..."

    # Test Cloudflare API token
    local cf_test=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")

    if echo "$cf_test" | jq -e '.success' > /dev/null 2>&1; then
        debug "Cloudflare API token is valid"
    else
        error "Invalid Cloudflare API token"
        exit 1
    fi

    # Test source provider credentials
    case $SOURCE_PROVIDER in
        route53)
            validate_route53_credentials
            ;;
        godaddy)
            validate_godaddy_credentials
            ;;
        namecheap)
            validate_namecheap_credentials
            ;;
        digitalocean)
            validate_digitalocean_credentials
            ;;
        google)
            validate_google_credentials
            ;;
    esac

    debug "API credentials validation passed"
}

# Validate Route53 credentials
validate_route53_credentials() {
    if [[ -z "${AWS_ACCESS_KEY:-}" ]] || [[ -z "${AWS_SECRET_KEY:-}" ]]; then
        error "AWS access key and secret key are required for Route53"
        exit 1
    fi

    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_KEY"
    export AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}"

    if aws route53 list-hosted-zones --max-items 1 > /dev/null 2>&1; then
        debug "Route53 credentials are valid"
    else
        error "Invalid Route53 credentials"
        exit 1
    fi
}

# Validate GoDaddy credentials
validate_godaddy_credentials() {
    if [[ -z "${GODADDY_API_KEY:-}" ]] || [[ -z "${GODADDY_API_SECRET:-}" ]]; then
        error "GoDaddy API key and secret are required"
        exit 1
    fi

    local test_response=$(curl -s -X GET "https://api.godaddy.com/v1/domains?limit=1" \
        -H "Authorization: sso-key $GODADDY_API_KEY:$GODADDY_API_SECRET" \
        -H "Accept: application/json")

    if [[ -n "$test_response" ]]; then
        debug "GoDaddy credentials are valid"
    else
        error "Invalid GoDaddy credentials"
        exit 1
    fi
}

# Validate Namecheap credentials
validate_namecheap_credentials() {
    if [[ -z "${NAMECHEAP_API_KEY:-}" ]] || [[ -z "${NAMECHEAP_API_USER:-}" ]]; then
        error "Namecheap API key and username are required"
        exit 1
    fi

    debug "Namecheap credentials format appears valid (no API test available)"
}

# Validate DigitalOcean credentials
validate_digitalocean_credentials() {
    if [[ -z "${DIGITALOCEAN_TOKEN:-}" ]]; then
        error "DigitalOcean API token is required"
        exit 1
    fi

    local test_response=$(curl -s -X GET "https://api.digitalocean.com/v2/account" \
        -H "Authorization: Bearer $DIGITALOCEAN_TOKEN")

    if echo "$test_response" | jq -e '.account' > /dev/null 2>&1; then
        debug "DigitalOcean credentials are valid"
    else
        error "Invalid DigitalOcean credentials"
        exit 1
    fi
}

# Validate Google Cloud credentials
validate_google_credentials() {
    if [[ -z "${GOOGLE_KEY_FILE:-}" ]]; then
        error "Google Cloud service account key file is required"
        exit 1
    fi

    if [[ ! -f "$GOOGLE_KEY_FILE" ]]; then
        error "Google Cloud service account key file not found: $GOOGLE_KEY_FILE"
        exit 1
    fi

    export GOOGLE_APPLICATION_CREDENTIALS="$GOOGLE_KEY_FILE"

    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null 2>&1; then
        debug "Google Cloud credentials are valid"
    else
        error "Invalid Google Cloud credentials"
        exit 1
    fi
}

# Get zone ID from Cloudflare
get_cloudflare_zone_id() {
    track_progress "zone_lookup" "Looking up Cloudflare zone ID for $DOMAIN"

    local zone_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")

    local zone_id=$(echo "$zone_response" | jq -r '.result[0].id // empty')

    if [[ -z "$zone_id" ]]; then
        error "Zone not found in Cloudflare: $DOMAIN"
        error "Please add the domain to Cloudflare before running migration"
        exit 1
    fi

    echo "$zone_id"
}

# Export DNS records from source provider
export_dns_records() {
    track_progress "export_start" "Exporting DNS records from $SOURCE_PROVIDER"

    local export_file="$MIGRATION_DIR/${DOMAIN}-export-$(date +%Y%m%d-%H%M%S).json"

    case $SOURCE_PROVIDER in
        route53)
            export_route53_records "$export_file"
            ;;
        godaddy)
            export_godaddy_records "$export_file"
            ;;
        namecheap)
            export_namecheap_records "$export_file"
            ;;
        digitalocean)
            export_digitalocean_records "$export_file"
            ;;
        google)
            export_google_records "$export_file"
            ;;
        *)
            error "Export not implemented for provider: $SOURCE_PROVIDER"
            exit 1
            ;;
    esac

    track_progress "export_complete" "DNS records exported to $export_file"
    echo "$export_file"
}

# Export Route53 records
export_route53_records() {
    local export_file="$1"

    local zone_id=$(aws route53 list-hosted-zones --query "HostedZones[?Name==\`$DOMAIN.\`].Id" --output text | sed 's/.*\///')

    if [[ -z "$zone_id" ]]; then
        error "Zone not found in Route53: $DOMAIN"
        exit 1
    fi

    aws route53 list-resource-record-sets \
        --hosted-zone-id "$zone_id" \
        --output json > "$export_file"

    # Transform to standard format
    local temp_file=$(mktemp)
    jq '
    {
        domain: "'$DOMAIN'",
        provider: "route53",
        zone_id: "'$zone_id'",
        records: .ResourceRecordSets[] | select(.Type != "SOA") | {
            name: .Name | sub("\\.$"; ""),
            type: .Type,
            ttl: .TTL,
            value: (if .ResourceRecords then .ResourceRecords[].Value else .AliasTarget.DNSName end),
            priority: (.Weight // null),
            port: (.Port // null)
        }
    }
    ' "$export_file" > "$temp_file" && mv "$temp_file" "$export_file"
}

# Export GoDaddy records
export_godaddy_records() {
    local export_file="$1"

    local records_response=$(curl -s -X GET "https://api.godaddy.com/v1/domains/$DOMAIN/records" \
        -H "Authorization: sso-key $GODADDY_API_KEY:$GODADDY_API_SECRET" \
        -H "Accept: application/json")

    if [[ -z "$records_response" ]]; then
        error "Failed to fetch records from GoDaddy"
        exit 1
    fi

    echo "$records_response" | jq '
    {
        domain: "'$DOMAIN'",
        provider: "godaddy",
        records: [
            .[] | {
                name: .name,
                type: .type,
                ttl: .ttl,
                value: .data,
                priority: (.priority // null),
                port: (.port // null)
            }
        ]
    }
    ' > "$export_file"
}

# Export Namecheap records
export_namecheap_records() {
    local export_file="$1"

    # Namecheap API requires XML parsing, using a simplified approach
    local api_url="https://api.namecheap.com/xml.response?ApiUser=$NAMECHEAP_API_USER&ApiKey=$NAMECHEAP_API_KEY&UserName=$NAMECHEAP_API_USER&Command=namecheap.domains.dns.getHosts&ClientIp=$(curl -s https://ipinfo.io/ip)&SLD=${DOMAIN%.*}&TLD=${DOMAIN#*.}"

    local response=$(curl -s "$api_url")

    if echo "$response" | grep -q "Status=\"ERROR\""; then
        error "Namecheap API error: $(echo "$response" | sed -n 's/.*<Error>\(.*\)<\/Error>.*/\1/p')"
        exit 1
    fi

    # Convert XML to JSON (simplified)
    python3 -c "
import xml.etree.ElementTree as ET
import json
import sys

try:
    root = ET.fromsys.argv[1])
    records = []

    for host in root.findall('.//host'):
        records.append({
            'name': host.get('Name', ''),
            'type': host.get('Type', ''),
            'ttl': int(host.get('TTL', 300)),
            'value': host.get('Address', ''),
            'priority': int(host.get('MXPref', 0)) if host.get('MXPref') else None,
            'port': None
        })

    result = {
        'domain': sys.argv[2],
        'provider': 'namecheap',
        'records': records
    }

    print(json.dumps(result, indent=2))
except Exception as e:
    print(f'Error parsing Namecheap response: {e}', file=sys.stderr)
    sys.exit(1)
" "$response" "$DOMAIN" > "$export_file" || {
        error "Failed to parse Namecheap response"
        exit 1
    }
}

# Export DigitalOcean records
export_digitalocean_records() {
    local export_file="$1"

    local domain_id=$(curl -s -X GET "https://api.digitalocean.com/v2/domains" \
        -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
        -H "Content-Type: application/json" | jq -r ".domains[] | select(.name == \"$DOMAIN\") | .id")

    if [[ -z "$domain_id" ]]; then
        error "Domain not found in DigitalOcean: $DOMAIN"
        exit 1
    fi

    local records_response=$(curl -s -X GET "https://api.digitalocean.com/v2/domains/$domain_id/records" \
        -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
        -H "Content-Type: application/json")

    echo "$records_response" | jq '
    {
        domain: "'$DOMAIN'",
        provider: "digitalocean",
        domain_id: "'$domain_id'",
        records: [
            .domain_records[] | {
                name: .name,
                type: .type,
                ttl: .ttl,
                value: .data,
                priority: .priority,
                port: .port
            }
        ]
    }
    ' > "$export_file"
}

# Export Google Cloud DNS records
export_google_records() {
    local export_file="$1"

    local zone_name=$(gcloud dns managed-zones list --filter="dns_name~\"$DOMAIN\"" --format="value(name)" | head -1)

    if [[ -z "$zone_name" ]]; then
        error "Zone not found in Google Cloud DNS: $DOMAIN"
        exit 1
    fi

    local records_json=$(gcloud dns record-sets list --zone="$zone_name" --format=json)

    echo "$records_json" | jq '
    {
        domain: "'$DOMAIN'",
        provider: "google",
        zone_name: "'$zone_name'",
        records: [
            .[] | select(.type != "SOA") | {
                name: (.name | sub("\\.$"; "")),
                type: .type,
                ttl: .ttl,
                value: (.rrdatas | join(",")),
                priority: null,
                port: null
            }
        ]
    }
    ' > "$export_file"
}

# Validate exported records
validate_records() {
    local export_file="$1"

    track_progress "validation" "Validating exported DNS records"

    if [[ ! -f "$export_file" ]]; then
        error "Export file not found: $export_file"
        exit 1
    fi

    local record_count=$(jq -r '.records | length' "$export_file")

    if [[ "$record_count" -eq 0 ]]; then
        error "No records found in export file"
        exit 1
    fi

    # Check for required record types
    local found_types=$(jq -r '.records[].type' "$export_file" | sort -u)

    for required_type in "${REQUIRED_RECORD_TYPES[@]}"; do
        if echo "$found_types" | grep -q "^$required_type$"; then
            debug "Found required record type: $required_type"
        else
            debug "Optional record type not found: $required_type"
        fi
    done

    # Validate record formats
    local invalid_records=$(jq -r '
    .records[] |
    select(.name == "" or .type == "" or .value == "" or
           (.ttl | tonumber) < 60 or (.ttl | tonumber) > 86400) |
    "Name: \(.name), Type: \(.type), TTL: \(.ttl), Value: \(.value)"
    ' "$export_file")

    if [[ -n "$invalid_records" ]]; then
        warning "Potentially invalid records found:"
        echo "$invalid_records"
    fi

    track_progress "validation_complete" "Validated $record_count DNS records"
}

# Create backup of current Cloudflare records
backup_cloudflare_records() {
    track_progress "backup" "Creating backup of current Cloudflare records"

    local zone_id="$1"
    local backup_file="$BACKUP_DIR/${DOMAIN}-backup-$(date +%Y%m%d-%H%M%S).json"

    local records_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")

    echo "$records_response" | jq '
    {
        domain: "'$DOMAIN'",
        zone_id: "'$zone_id'",
        backup_time: "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        records: .result[]
    }
    ' > "$backup_file"

    track_progress "backup_complete" "Backup created: $backup_file"
}

# Prepare records for Cloudflare import
prepare_records() {
    local export_file="$1"
    local prepared_file="$2"

    track_progress "preparation" "Preparing records for Cloudflare import"

    # Transform records to Cloudflare format
    jq '
    {
        records: [
            .records[] |
            {
                type: .type,
                name: (.name | if endswith("'$DOMAIN'") then . else if . == "@" then "'$DOMAIN'" else . + "." + "'$DOMAIN'" end end),
                content: .value,
                ttl: (.ttl | if . < 60 then 60 elif . > 86400 then 86400 else . end),
                priority: (.priority // null),
                port: (.port // null),
                proxied: (if .type == "A" or .type == "AAAA" or .type == "CNAME" then true else false end)
            }
        ]
    }
    ' "$export_file" > "$prepared_file"

    local prepared_count=$(jq -r '.records | length' "$prepared_file")
    track_progress "preparation_complete" "Prepared $prepared_count records for import"
}

# Import records to Cloudflare
import_records() {
    local prepared_file="$1"
    local zone_id="$2"

    track_progress "import_start" "Importing records to Cloudflare"

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN: Would import $(jq -r '.records | length' "$prepared_file") records to Cloudflare"
        return 0
    fi

    local records=$(jq -c '.records[]' "$prepared_file")
    local success_count=0
    local error_count=0

    while IFS= read -r record; do
        if import_single_record "$record" "$zone_id"; then
            ((success_count++))
        else
            ((error_count++))
        fi
    done <<< "$records"

    if [[ $error_count -gt 0 ]]; then
        warning "⚠️ $error_count records failed to import"
    fi

    track_progress "import_complete" "Imported $success_count records successfully ($error_count errors)"
}

# Import a single record to Cloudflare
import_single_record() {
    local record="$1"
    local zone_id="$2"

    local type=$(echo "$record" | jq -r '.type')
    local name=$(echo "$record" | jq -r '.name')
    local content=$(echo "$record" | jq -r '.content')
    local ttl=$(echo "$record" | jq -r '.ttl')
    local priority=$(echo "$record" | jq -r '.priority // empty')
    local port=$(echo "$record" | jq -r '.port // empty')
    local proxied=$(echo "$record" | jq -r '.proxied')

    # Build request body
    local request_body="{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"ttl\":$ttl,\"proxied\":$proxied}"

    if [[ -n "$priority" ]] && [[ "$priority" != "null" ]]; then
        request_body=$(echo "$request_body" | jq ".priority = $priority")
    fi

    if [[ -n "$port" ]] && [[ "$port" != "null" ]]; then
        request_body=$(echo "$request_body" | jq ".port = $port")
    fi

    # Create record
    local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$request_body")

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        debug "Created record: $type $name -> $content"
        return 0
    else
        error "Failed to create record: $(echo "$response" | jq -r '.errors[0].message // "Unknown error"')"
        return 1
    fi
}

# Verify DNS propagation
verify_propagation() {
    track_progress "verification_start" "Verifying DNS propagation"

    local max_wait=600  # 10 minutes max
    local wait_interval=30  # Check every 30 seconds
    local elapsed=0

    while [[ $elapsed -lt $max_wait ]]; do
        if check_propagation_status; then
            track_progress "verification_complete" "DNS propagation completed successfully"
            return 0
        fi

        log "Waiting for DNS propagation... (${elapsed}s elapsed)"
        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done

    warning "⚠️ DNS propagation verification timed out"
    return 1
}

# Check propagation status
check_propagation_status() {
    local export_file="$1"
    local failed_count=0
    local total_count=$(jq -r '.records | length' "$export_file")

    while IFS= read -r record; do
        local name=$(echo "$record" | jq -r '.name')
        local type=$(echo "$record" | jq -r '.type')
        local expected_value=$(echo "$record" | jq -r '.value')

        local actual_values=$(dig +short "$name" "$type" 2>/dev/null | head -5)

        if echo "$actual_values" | grep -q "$expected_value"; then
            debug "✓ $name $type matches"
        else
            debug "✗ $name $type mismatch (expected: $expected_value, got: $actual_values)"
            ((failed_count++))
        fi
    done < <(jq -c '.records[]' "$export_file")

    local success_rate=$(( (total_count - failed_count) * 100 / total_count ))

    if [[ $success_rate -ge 95 ]]; then
        log "✅ DNS propagation: $success_rate% ($total_count records, $failed_count failed)"
        return 0
    else
        log "⏳ DNS propagation: $success_rate% ($total_count records, $failed_count failed)"
        return 1
    fi
}

# Generate migration report
generate_report() {
    track_progress "report" "Generating migration report"

    local report_file="$PROJECT_ROOT/logs/dns-migration-$(date +%Y%m%d-%H%M%S).json"
    local export_file="$1"

    cat > "$report_file" << EOF
{
  "domain": "$DOMAIN",
  "source_provider": "$SOURCE_PROVIDER",
  "target_provider": "cloudflare",
  "migration_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "migration_user": "$(whoami)",
  "dry_run": $DRY_RUN,
  "verify_only": $VERIFY_ONLY,
  "ttl": $TTL,
  "record_count": $(jq -r '.records | length' "$export_file"),
  "record_types": $(jq -r '[.records[].type] | sort | unique' "$export_file"),
  "export_file": "$export_file",
  "backup_files": [
    $(ls -1 "$BACKUP_DIR"/${DOMAIN}-backup-*.json 2>/dev/null | head -5 | jq -R . | jq -s .)
  ],
  "success": true
}
EOF

    track_progress "report_complete" "Migration report saved: $report_file"
}

# Main execution flow
main() {
    log "🚀 Starting DNS migration for $DOMAIN..."
    log "Source: $SOURCE_PROVIDER"
    log "Target: Cloudflare"

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN MODE - No changes will be made"
    fi

    if [[ "$VERIFY_ONLY" == true ]]; then
        log "🔍 VERIFICATION MODE - Only checking existing setup"
    fi

    init_directories
    check_dependencies
    validate_domain
    validate_credentials

    if [[ "$VERIFY_ONLY" == true ]]; then
        log "✅ Verification completed - all credentials are valid"
        exit 0
    fi

    local zone_id=$(get_cloudflare_zone_id)
    local export_file=$(export_dns_records)
    validate_records "$export_file"

    if [[ "$DRY_RUN" == false ]]; then
        backup_cloudflare_records "$zone_id"

        local prepared_file="$MIGRATION_DIR/${DOMAIN}-prepared-$(date +%Y%m%d-%H%M%S).json"
        prepare_records "$export_file" "$prepared_file"

        import_records "$prepared_file" "$zone_id"
        verify_propagation "$export_file"
    fi

    generate_report "$export_file"

    if [[ "$DRY_RUN" == true ]]; then
        log "🔍 DRY RUN completed successfully"
        log "📁 Export file: $export_file"
    else
        log "✅ DNS migration completed successfully!"
        log "🌐 DNS records for $DOMAIN are now managed by Cloudflare"
        log "📁 Export file: $export_file"
    fi
}

# Error handling
trap 'error "❌ Script failed at line $LINENO"' ERR

# Execute main function
main "$@"