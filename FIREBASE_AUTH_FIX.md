# 🔥 Firebase Authentication Domain Error - Quick Fix

## Error
```
Firebase: Error (auth/unauthorized-domain)
```

## Root Cause
The domain `israeli-radio-475c9.web.app` is not in Firebase's authorized domains list for OAuth authentication.

## Solution (Must be done via Firebase Console)

### Step 1: Access Firebase Console
Open this URL:
```
https://console.firebase.google.com/project/israeli-radio-475c9/authentication/settings
```

### Step 2: Navigate to Authorized Domains
1. Click on **"Authentication"** in the left sidebar
2. Click on **"Settings"** tab at the top
3. Scroll down to **"Authorized domains"** section

### Step 3: Add Required Domains
Click **"Add domain"** and add each of these:

✅ **Required domains:**
- `israeliradio.live` (Production - Custom Domain)
- `www.israeliradio.live` (WWW variant)
- `israeli-radio-475c9.web.app` (Firebase Hosting)
- `israeli-radio-475c9.firebaseapp.com` (Firebase default)
- `israeli-radio-demo.web.app` (Demo site)
- `localhost` (Already should be there for development)

### Step 4: Save and Test
1. Click "Add" for each domain
2. Wait 30-60 seconds for propagation
3. Refresh your app and try logging in again

## Why This Happens
Firebase requires explicit authorization of domains that can use OAuth authentication. When deploying to a new Firebase Hosting domain, you must manually add it to the authorized list.

## Current Deployment URLs
- **Production:** https://israeli-radio-475c9.web.app
- **Backend API:** https://israeli-radio-manager-534446777606.us-east1.run.app

## Alternative: Enable Google Sign-In Provider
While in the Firebase Console Authentication settings, also ensure:
1. Go to **"Sign-in method"** tab
2. Verify **"Google"** is **Enabled**
3. If not, click on Google → Enable → Save

---

**Status:** Waiting for manual configuration in Firebase Console
**Priority:** 🔴 Critical - Blocks all user authentication
