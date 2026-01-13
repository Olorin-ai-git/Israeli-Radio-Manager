#!/bin/bash
#
# Setup Google Cloud Scheduler job for automatic weekly backups
# Run this script after deploying your backend to Cloud Run
#

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-israeli-radio-475c9}"
REGION="us-east1"
SERVICE_URL="https://israeli-radio-manager-534446777606.us-east1.run.app"
SERVICE_ACCOUNT="israeli-radio-manager@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================"
echo "Setting up Weekly Backup Scheduler"
echo "========================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service URL: $SERVICE_URL"
echo ""

# Create scheduler job
JOB_NAME="weekly-library-backup"
SCHEDULE="0 3 * * 0"  # Every Sunday at 3:00 AM
TIMEZONE="America/New_York"
DESCRIPTION="Weekly automatic backup of content library"

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
    --uri="${SERVICE_URL}/api/admin/internal/backups/scheduled" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --description="$DESCRIPTION" \
    --oidc-service-account-email="$SERVICE_ACCOUNT" \
    --oidc-token-audience="$SERVICE_URL" \
    --max-retry-attempts=2 \
    --max-backoff=10m \
    --min-backoff=1m

echo "✅ Created: $JOB_NAME"
echo ""

echo "========================================"
echo "✅ Backup scheduler created successfully!"
echo "========================================"
echo ""
echo "Schedule: Every Sunday at 3:00 AM EST"
echo ""
echo "To verify, run:"
echo "  gcloud scheduler jobs list --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To pause the job:"
echo "  gcloud scheduler jobs pause $JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To resume the job:"
echo "  gcloud scheduler jobs resume $JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "To manually trigger a backup:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo ""
echo "Backup Configuration:"
echo "  - Retention: 30 days"
echo "  - Minimum backups kept: 5"
echo "  - Storage: GCS bucket + local"
echo "  - Collections: content, schedule_slots, campaigns, flows, voices"
echo ""
