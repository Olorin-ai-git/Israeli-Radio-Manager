# Deploy Israeli Radio Command

Deploy Israeli Radio Manager to Firebase Hosting and Google Cloud Run.

## Usage

```bash
/deploy-radio [environment] [--backend-only] [--frontend-only]
```

## Arguments

- **environment** - `prod` or `demo` (default: demo)
- **--backend-only** - Deploy only backend to Cloud Run
- **--frontend-only** - Deploy only frontend to Firebase

## Examples

### Full Deployment to Demo
```bash
/deploy-radio demo
```

### Production Backend Only
```bash
/deploy-radio prod --backend-only
```

### Frontend to Production
```bash
/deploy-radio prod --frontend-only
```

## Deployment Steps

### Backend (Google Cloud Run)
```bash
cd backend
gcloud run deploy israeli-radio-backend-${ENV} \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2
```

### Frontend (Firebase Hosting)
```bash
cd frontend
npm run build
firebase deploy --only hosting:${ENV}
```

## Environment Configuration

**Demo:**
- Backend: `https://israeli-radio-demo.run.app`
- Frontend: `https://israeli-radio-demo.web.app`

**Production:**
- Backend: `https://api.israeliradio.com`
- Frontend: `https://israeliradio.com`

## Pre-Deployment Checklist

1. ✅ All tests passing (`/test-radio`)
2. ✅ Environment variables configured
3. ✅ MongoDB Atlas accessible
4. ✅ Google API credentials valid
5. ✅ Firebase hosting configured
6. ✅ Git commit pushed

## Related Files

- `apphosting.yaml` - Cloud Run configuration
- `firebase.json` - Firebase hosting configuration
- `backend/.env.production` - Production env vars
