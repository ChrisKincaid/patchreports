# Deployment Guide

## Pre-Deployment Checklist

- [ ] Firebase project created
- [ ] Firebase Blaze plan enabled (required for Cloud Functions)
- [ ] Node.js 18+ installed
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Firebase CLI authenticated (`firebase login`)
- [ ] Dependencies installed (root and functions)
- [ ] Firebase configuration updated
- [ ] Security rules reviewed
- [ ] Initial testing completed

## Step-by-Step Deployment

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "cve-alert-system")
4. Disable Google Analytics (optional, follows minimal data principle)
5. Click "Create project"

### 2. Upgrade to Blaze Plan

1. In Firebase Console, go to Project Settings
2. Click "Upgrade" under Usage and billing
3. Select "Blaze (Pay as you go)"
4. Set up billing account (required for Cloud Functions)
5. Set budget alerts (recommended: $50/month)

### 3. Enable Firebase Services

#### Enable Authentication

1. In Firebase Console, click "Authentication"
2. Click "Get started"
3. Click "Sign-in method" tab
4. Enable "Email/Password"
5. Save

#### Enable Firestore

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Select "Production mode" (rules will be deployed later)
4. Choose a location (select closest to your users)
5. Click "Enable"

### 4. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click web icon (</>) to add a web app
4. Register app name: "CVE Alert Dashboard"
5. Don't enable Firebase Hosting yet (will deploy later)
6. Copy the `firebaseConfig` object

### 5. Configure Application

1. **Update `.firebaserc`**

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

2. **Update `src/firebaseConfig.js`**

Replace with your Firebase config from step 4:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 6. Install Dependencies

```powershell
# Install frontend dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..
```

### 7. Deploy Firestore Security Rules

```powershell
firebase deploy --only firestore:rules
```

Verify in Firebase Console → Firestore Database → Rules

### 8. Deploy Firestore Indexes

```powershell
firebase deploy --only firestore:indexes
```

Note: Indexes may take a few minutes to build. Check status in Firebase Console.

### 9. Deploy Cloud Functions

```powershell
firebase deploy --only functions
```

This deploys:
- `dailyCVECollection` (scheduled)
- `collectCVEsManual` (callable)
- `updateLastChecked` (callable)
- `exportUserData` (callable)
- `deleteUserData` (callable)

**Important**: First deployment may take 5-10 minutes.

Verify in Firebase Console → Functions → Dashboard

### 10. Build Frontend

```powershell
npm run build
```

This creates optimized production build in `dist/` directory.

### 11. Deploy to Firebase Hosting

```powershell
firebase deploy --only hosting
```

Your app will be deployed to: `https://your-project-id.web.app`

### 12. Post-Deployment Verification

#### Test Authentication

1. Visit your deployed URL
2. Click "Register"
3. Create a test account
4. Verify email is stored in Firebase Console → Authentication

#### Test Watch List

1. After login, go to "Watch List"
2. Add a test item (e.g., Vendor: "Microsoft", Product: "Windows")
3. Verify in Firebase Console → Firestore → users → [your-uid] → watchList

#### Test CVE Collection

Option 1: Wait for scheduled run (6 AM UTC next day)

Option 2: Manually trigger:

```powershell
firebase functions:shell
```

Then in the shell:

```javascript
collectCVEsManual()
```

Option 3: Use "Refresh CVEs" button in dashboard

Verify CVEs appear in Firebase Console → Firestore → cves

#### Test Dashboard

1. Go to Dashboard
2. Verify stats are displayed
3. Test filtering by severity and time range
4. Verify CVEs matching your watch list appear

#### Test Settings

1. Go to Settings
2. Enable notifications
3. Export your data
4. Verify download works

## Post-Deployment Configuration

### Configure Custom Domain (Optional)

1. In Firebase Console, go to Hosting
2. Click "Add custom domain"
3. Follow DNS configuration instructions
4. SSL certificate automatically provisioned

### Set Up Email Alerts (Optional)

To implement actual email sending:

1. Choose email service (SendGrid, AWS SES, etc.)
2. Add dependency to `functions/package.json`
3. Configure API keys in Firebase Functions config:

```powershell
firebase functions:config:set email.api_key="YOUR_API_KEY"
```

4. Implement email sending in `functions/src/emailAlerts.js`
5. Redeploy functions: `firebase deploy --only functions`

### Configure Budget Alerts

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to Billing → Budgets & alerts
4. Create budget alert (recommended: $20/month for 50 users)
5. Set alert thresholds (50%, 80%, 100%)

### Set Up Monitoring

1. In Firebase Console, go to Performance or Analytics
2. Enable monitoring (optional, follows privacy principles)
3. Set up uptime monitoring via external service if desired

## Maintenance

### Regular Updates

**Monthly** (or when security updates available):

```powershell
# Update dependencies
npm audit
npm audit fix

cd functions
npm audit
npm audit fix
cd ..

# Rebuild and redeploy
npm run build
firebase deploy
```

### Monitor Usage

1. Firebase Console → Usage and billing
2. Check Firestore reads/writes
3. Check Cloud Function invocations
4. Review costs

### Backup Firestore Data

**Manual backup**:

1. Install Google Cloud SDK
2. Run backup:

```powershell
gcloud firestore export gs://your-bucket-name/backups/$(date +%Y%m%d)
```

**Automated backups**: Set up Cloud Scheduler to run exports daily

### Review Logs

```powershell
# View Cloud Function logs
firebase functions:log

# Or in Firebase Console → Functions → Logs
```

## Troubleshooting

### Functions Won't Deploy

**Error**: "Billing account not configured"

**Solution**: Upgrade to Blaze plan in Firebase Console

---

**Error**: "Permission denied"

**Solution**: 
```powershell
firebase login --reauth
```

### CVEs Not Appearing

**Check**:
1. Cloud Function ran successfully (check logs)
2. NVD API is accessible (test: https://services.nvd.nist.gov/rest/json/cves/2.0)
3. Firestore `cves` collection has documents
4. Watch list items match CVE vendors/products

### Authentication Issues

**Check**:
1. Email/Password enabled in Firebase Console
2. `firebaseConfig.js` has correct project credentials
3. HTTPS is being used (not HTTP)

### Build Errors

**Error**: "Module not found"

**Solution**:
```powershell
rm -rf node_modules package-lock.json
npm install
```

### Firestore Permission Denied

**Check**:
1. Security rules deployed: `firebase deploy --only firestore:rules`
2. User is authenticated
3. User is accessing their own data (check userId in path)

## Rolling Back

If issues occur after deployment:

### Rollback Hosting

```powershell
firebase hosting:clone your-project-id:live your-project-id:previous
```

### Rollback Functions

Firebase Console → Functions → Version History → Rollback

### Rollback Firestore Rules

Firebase Console → Firestore → Rules → Version History → Publish previous version

## Security Post-Deployment

### Review IAM Permissions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project → IAM & Admin
3. Review who has access
4. Remove unnecessary accounts

### Enable Firebase App Check (Optional)

For additional security against abuse:

1. Firebase Console → App Check
2. Register your web app
3. Choose reCAPTCHA v3
4. Update frontend code to initialize App Check

### Review Security Rules

Periodically test security rules:

```powershell
firebase emulators:start --only firestore
# Run test suite against emulator
```

## Scaling Considerations

### For 100+ Users

- Firestore queries should still be fast
- Consider composite indexes if queries slow down
- Monitor Cloud Function execution times

### For 500+ Users

- Consider implementing Cloud Functions batch processing
- Use Firestore subcollections for better organization
- Implement pagination in CVE list

### For 1000+ Users

- Consider Cloud Run for better cold start performance
- Implement caching strategies (Firebase Cloud Functions already caches)
- Use Firestore partitioning strategies

## Cost Optimization

### Reduce Firestore Reads

- Implement client-side caching
- Use Firestore real-time listeners instead of repeated reads
- Limit CVE retention (e.g., delete CVEs older than 90 days)

### Reduce Function Invocations

- Batch operations where possible
- Adjust scheduled function frequency if daily is too often

### Monitor and Alert

Set up billing alerts to catch unexpected costs early.

---

**Deployment Date**: _____________  
**Deployed by**: _____________  
**Next Review**: _____________  

**Support Contact**: [your.email@organization.com]
