# CVE Alert System - Enterprise Security Briefings

## Overview

The CVE Alert System is a Firebase-based web application designed for daily security briefings in enterprise environments. It provides personalized CVE monitoring by filtering vulnerabilities based on user-configured watch lists, reducing noise and focusing on relevant security threats.

## Key Features

- **Personalized Watch Lists**: Users configure vendor/product combinations to monitor
- **Automated Daily Collection**: Cloud Functions fetch CVEs from NVD API daily at 6 AM UTC
- **Filtered Dashboard**: Only shows CVEs matching user's watch list
- **Temporal Filtering**: "New Since Yesterday" view for morning briefings
- **Severity Indicators**: Visual CVSS score display (Critical/High/Medium/Low)
- **Export Functionality**: GDPR-compliant data export
- **Email Alerts**: Optional notifications for critical vulnerabilities (CVSS ≥ 9.0)
- **Professional UI**: Clean interface suitable for standup presentations

## Technology Stack

- **Frontend**: React 18 with Vite build system
- **Backend**: Firebase Cloud Functions (Node.js 18)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Authentication (Email/Password)
- **Hosting**: Firebase Hosting with security headers
- **API**: NIST NVD CVE API 2.0

## Architecture

### Frontend Components

```
src/
├── App.jsx                 # Main app router
├── firebase.js             # Firebase SDK initialization
├── contexts/
│   └── AuthContext.jsx     # Authentication state management
├── components/
│   ├── Auth/
│   │   ├── Login.jsx       # Login page
│   │   └── Register.jsx    # Registration page
│   ├── Dashboard/
│   │   └── Dashboard.jsx   # Main CVE dashboard
│   ├── CVE/
│   │   └── CVEList.jsx     # CVE display component
│   ├── WatchList/
│   │   └── WatchListManager.jsx  # Watch list CRUD
│   ├── Settings/
│   │   └── Settings.jsx    # User settings & data management
│   └── Common/
│       ├── Navigation.jsx  # App navigation
│       └── Loading.jsx     # Loading states
└── styles/
    └── index.css           # Global styles
```

### Backend Functions

```
functions/
├── index.js                # Function exports
└── src/
    ├── cveCollector.js     # CVE fetching & processing
    └── emailAlerts.js      # Alert matching & notifications
```

### Cloud Functions

1. **dailyCVECollection** (Scheduled): Runs daily at 6 AM UTC to fetch and process CVEs
2. **collectCVEsManual** (Callable): Manual trigger for testing
3. **updateLastChecked** (Callable): Updates user's last viewed timestamp
4. **exportUserData** (Callable): GDPR data export
5. **deleteUserData** (Callable): Account and data deletion

## Data Model

### Firestore Collections

#### `users/{userId}`
```javascript
{
  email: string,
  createdAt: timestamp,
  lastChecked: timestamp | null,
  notificationsEnabled: boolean
}
```

#### `users/{userId}/watchList/{itemId}`
```javascript
{
  vendor: string,      // e.g., "Microsoft"
  product: string,     // e.g., "Windows Server"
  addedAt: timestamp
}
```

#### `cves/{cveId}`
```javascript
{
  cveId: string,              // e.g., "CVE-2024-12345"
  description: string,
  vendors: string[],          // Extracted from CPE data
  products: string[],         // Extracted from CPE data
  cvssScore: number,          // 0.0 - 10.0
  severity: string,           // CRITICAL|HIGH|MEDIUM|LOW|UNKNOWN
  cvssVector: string,
  publishedDate: timestamp,
  lastModifiedDate: timestamp,
  references: Array<{url, source}>,
  collectedAt: timestamp
}
```

#### `audit/{logId}`
```javascript
{
  userId: string,
  action: string,
  timestamp: timestamp,
  // Additional context fields
}
```

#### `notifications/{notificationId}`
```javascript
{
  userId: string,
  type: "critical_cve_alert",
  cveIds: string[],
  count: number,
  createdAt: timestamp,
  read: boolean
}
```

## Security Features

See [SECURITY.md](./SECURITY.md) for detailed security architecture.

## Compliance

See [RISK_ASSESSMENT.md](./RISK_ASSESSMENT.md) for enterprise risk assessment documentation.

## Setup Instructions

### Prerequisites

- Node.js 18 or higher
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Blaze (pay-as-you-go) plan for Cloud Functions

### Installation

1. **Clone and Install Dependencies**

```bash
cd patchreports.com
npm install
cd functions
npm install
cd ..
```

2. **Configure Firebase**

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

Edit `src/firebaseConfig.js` with your Firebase project credentials:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. **Deploy Firestore Rules and Indexes**

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

4. **Deploy Cloud Functions**

```bash
firebase deploy --only functions
```

5. **Build and Deploy Frontend**

```bash
npm run build
firebase deploy --only hosting
```

### Local Development

1. **Start Frontend Development Server**

```bash
npm run dev
```

Access at `http://localhost:3000`

2. **Start Firebase Emulators** (Optional)

```bash
firebase emulators:start
```

Set `VITE_USE_EMULATORS=true` in environment to connect to emulators.

### Manual CVE Collection

To manually trigger CVE collection (for testing):

```bash
firebase functions:shell
> collectCVEsManual()
```

Or use the "Refresh CVEs" button in the dashboard.

## Usage Workflow

1. **Registration**: User creates account with email/password
2. **Watch List Setup**: Add vendor/product combinations to monitor
3. **Automated Collection**: System fetches CVEs daily from NVD API
4. **Dashboard View**: View filtered CVEs matching watch list
5. **Time Range Filtering**: Select 1, 2, 7, or 30 days
6. **Severity Filtering**: Filter by Critical/High/Medium/Low
7. **Morning Briefing**: Review "New Since Yesterday" for standup meetings
8. **Optional Alerts**: Enable email notifications for critical CVEs

## Customization

### Changing Collection Schedule

Edit `functions/index.js`:

```javascript
exports.dailyCVECollection = functions.pubsub
  .schedule('0 6 * * *')  // Change this cron expression
  .timeZone('UTC')
  .onRun(async (context) => { ... });
```

### Adding Email Service

The system has placeholder code for email alerts. To implement:

1. Choose email provider (SendGrid, AWS SES, etc.)
2. Add provider SDK to `functions/package.json`
3. Implement email sending in `functions/src/emailAlerts.js`
4. Configure provider API keys in Firebase Functions config

### Customizing UI Theme

Edit CSS variables in `src/styles/index.css`:

```css
:root {
  --primary: #2563eb;
  --bg-primary: #0f172a;
  /* ... other variables */
}
```

## Performance Considerations

- **Firestore Indexes**: Composite indexes defined in `firestore.indexes.json`
- **CVE Caching**: CVEs stored in Firestore to reduce NVD API calls
- **Query Optimization**: Watch list matching on client side for flexibility
- **Bundle Splitting**: Vite configuration splits vendor bundles

## Monitoring

### Firebase Console

- Authentication: Monitor user registrations
- Firestore: Monitor database reads/writes
- Functions: View execution logs and errors
- Hosting: Check site traffic

### Function Logs

```bash
firebase functions:log
```

### Audit Trail

All critical actions logged to `audit` collection:
- CVE collections
- User data exports
- Critical alerts sent
- Last checked updates

## Cost Estimate

For organization with 50 users:

- **Firestore**: ~$1-5/month (reads/writes/storage)
- **Cloud Functions**: ~$5-10/month (scheduled + on-demand executions)
- **Hosting**: Free tier sufficient
- **Authentication**: Free tier sufficient
- **Total**: ~$10-20/month

NVD API is free (rate-limited to 5 requests/10 seconds without API key).

## Troubleshooting

### CVEs Not Appearing

1. Check Cloud Function logs: `firebase functions:log`
2. Verify NVD API is accessible
3. Manually trigger collection: Use "Refresh CVEs" button
4. Check Firestore `cves` collection has documents

### Authentication Issues

1. Verify Firebase Auth is enabled for Email/Password
2. Check `firebaseConfig.js` credentials
3. Review browser console for errors

### Watch List Not Matching

1. Be specific with vendor/product names
2. Check CVE `vendors` and `products` arrays in Firestore
3. Matching is case-insensitive and uses substring matching

## Support and Maintenance

### Updating Dependencies

```bash
npm update
cd functions && npm update
```

### Backing Up Data

Use Firestore export:

```bash
gcloud firestore export gs://your-bucket/backups
```

### Upgrading Firebase

Follow Firebase upgrade guides when new major versions are released.

## License

This is a custom enterprise application. Ensure compliance with:
- Firebase Terms of Service
- NVD API Terms of Use
- Any organizational security policies

## Contributors

Built for enterprise security teams requiring daily CVE briefings.

---

For security details, see [SECURITY.md](./SECURITY.md)  
For risk assessment, see [RISK_ASSESSMENT.md](./RISK_ASSESSMENT.md)
