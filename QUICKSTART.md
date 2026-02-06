# Quick Start Guide

## CVE Alert System - Get Running in 15 Minutes

This guide gets you from zero to a running CVE Alert System as fast as possible.

## Prerequisites (5 minutes)

1. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
2. **Firebase CLI**: 
   ```powershell
   npm install -g firebase-tools
   firebase login
   ```

## Firebase Setup (5 minutes)

1. **Create Firebase Project**
   - Go to [console.firebase.google.com](https://console.firebase.google.com/)
   - Click "Add project" → Enter name → Create

2. **Upgrade to Blaze Plan**
   - Project Settings → Usage and billing → Upgrade
   - (Required for Cloud Functions, costs ~$10-20/month for 50 users)

3. **Enable Services**
   - Authentication → Sign-in method → Enable "Email/Password"
   - Firestore Database → Create database → Production mode → Enable

4. **Get Config**
   - Project Settings → Your apps → Add web app
   - Copy the `firebaseConfig` object

## Application Setup (5 minutes)

1. **Configure Firebase**

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "YOUR-PROJECT-ID"
  }
}
```

Edit `src/firebaseConfig.js` with your config from step 4 above.

2. **Install Dependencies**
```powershell
npm install
cd functions
npm install
cd ..
```

3. **Deploy**
```powershell
# Deploy security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Cloud Functions
firebase deploy --only functions

# Build and deploy frontend
npm run build
firebase deploy --only hosting
```

## First Use

1. **Visit your site**: `https://YOUR-PROJECT-ID.web.app`
2. **Register** an account
3. **Add watch list items**:
   - Vendor: "Microsoft", Product: "Windows"
   - Vendor: "Apache", Product: "Tomcat"
   - (Add your actual tech stack)
4. **Manually trigger CVE collection**:
   - Click "Refresh CVEs" button in dashboard
   - OR wait until 6 AM UTC next day (auto-scheduled)
5. **View filtered CVEs** in dashboard

## Daily Usage

1. **Morning Standup**: 
   - Open dashboard
   - Set time range to "Last 24 Hours"
   - Review CVEs matching your watch list
   - Filter by "Critical Only" if needed

2. **Weekly**: 
   - Review watch list
   - Add/remove vendors based on infrastructure changes

3. **Monthly**: 
   - Run `npm audit` and update dependencies
   - Check Firebase usage/costs

## Troubleshooting

**No CVEs showing up?**
- Click "Refresh CVEs" button
- Check Firebase Functions logs: `firebase functions:log`
- Ensure watch list has items

**Can't login?**
- Check Firebase Console → Authentication → Sign-in method
- Verify Email/Password is enabled

**Deployment fails?**
- Ensure Blaze plan is enabled
- Run `firebase login --reauth`

## Next Steps

- Read [README.md](./README.md) for full documentation
- Review [SECURITY.md](./SECURITY.md) for security details
- Share [RISK_ASSESSMENT.md](./RISK_ASSESSMENT.md) with security team

## Support

For issues:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section
2. Review Firebase Console logs
3. Check browser console for errors

---

**Total Time**: ~15 minutes  
**Cost**: ~$10-20/month for 50 users  
**Maintenance**: ~30 minutes/month (dependency updates)
