#!/bin/bash
#
# Setup Google Cloud Scheduler jobs for Librarian AI Agent
# Run this script after deploying your backend to Cloud Run
#

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-israeli-radio-475c9}"
REGION="us-east1"
SERVICE_URL="https://israeli-radio-manager-534446777606.us-east1.run.app"
SERVICE_ACCOUNT="israeli-radio-manager@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================"
echo "Setting up Librarian Cloud Schedulers"
echo "========================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service URL: $SERVICE_URL"
echo ""

# Function to create or update a scheduler job
create_scheduler() {
    local JOB_NAME=$1
    local SCHEDULE=$2
    local DESCRIPTION=$3
    local PAYLOAD=$4
    local TIMEZONE="${5:-America/New_York}"

    echo "Creating scheduler: $JOB_NAME"
    
    # Delete existing job if it exists
    gcloud scheduler jobs delete "$JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || echo "Job $JOB_NAME doesn't exist yet"

    # Create new job
    gcloud scheduler jobs create http "$JOB_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --schedule="$SCHEDULE" \
        --time-zone="$TIMEZONE" \
        --uri="${SERVICE_URL}/api/admin/librarian/run-audit" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body="$PAYLOAD" \
        --description="$DESCRIPTION" \
        --oidc-service-account-email="$SERVICE_ACCOUNT" \
        --oidc-token-audience="$SERVICE_URL" \
        --max-retry-attempts=2 \
        --max-backoff=10m \
        --min-backoff=1m

    echo "✅ Created: $JOB_NAME"
    echo ""
}

# Job 1: Daily Incremental Audit (2 AM Israel Time = 7 PM EST previous day)
# Israel is UTC+2/+3, EST is UTC-5
# We'll use America/New_York timezone and adjust schedule
create_scheduler \
    "librarian-daily-audit" \
    "0 19 * * *" \
    "Librarian AI: Daily incremental audit of recent content changes" \
    '{"audit_type":"daily_incremental","dry_run":false,"use_ai_agent":false,"max_iterations":50,"budget_limit_usd":1.0}' \
    "America/New_York"

# Job 2: Weekly Full Audit (Sunday 3 AM Israel = Saturday 8 PM EST)
create_scheduler \
    "librarian-weekly-full-audit" \
    "0 20 * * 6" \
    "Librarian AI: Weekly comprehensive full library audit" \
    '{"audit_type":"weekly_full","dry_run":false,"use_ai_agent":true,"max_iterations":200,"budget_limit_usd":5.0}' \
    "America/New_York"

echo "========================================"
echo "✅ All schedulers created successfully!"
echo "========================================"
echo ""
echo "To verify, run:"
echo "  gcloud scheduler jobs list --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To pause a job:"
echo "  gcloud scheduler jobs pause JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To resume a job:"
echo "  gcloud scheduler jobs resume JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To manually trigger a job:"
echo "  gcloud scheduler jobs run JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
