# Security Architecture

## Overview

The CVE Alert System is designed with security-first principles to pass enterprise risk assessment reviews. This document outlines the security architecture, data protection measures, and compliance considerations.

## Security Principles

1. **Minimal Data Collection**: Only essential data (email, watch list) is collected
2. **User-Scoped Data**: All data isolated per user with strict access controls
3. **Defense in Depth**: Multiple security layers (auth, rules, functions)
4. **Encryption at Rest and Transit**: Firebase handles encryption automatically
5. **Audit Logging**: All critical operations logged for compliance
6. **Data Sovereignty**: Users can export and delete their data anytime

## Authentication

### Firebase Authentication

- **Method**: Email/Password only (no social providers to minimize data sharing)
- **Password Requirements**: Minimum 8 characters enforced
- **Session Management**: Firebase SDK handles token refresh and expiration
- **Protection**: 
  - Email verification available if needed
  - Account lockout after repeated failed attempts (Firebase built-in)
  - HTTPS-only communication

### Authentication Flow

1. User registers with email/password
2. Firebase Auth creates secure account
3. User profile created in Firestore with user-scoped permissions
4. All subsequent requests authenticated via Firebase Auth tokens

## Authorization

### Firestore Security Rules

**Location**: `firestore.rules`

#### User Profiles (`users/{userId}`)

```
- Read: User can only read their own profile
- Create: User can only create their own profile with validated email
- Update: User can only update their own profile
- Delete: User can only delete their own profile
```

**Validation**:
- Email must match authenticated user's email
- Only allowed fields: email, createdAt, lastChecked, notificationsEnabled
- Created timestamp required

#### Watch Lists (`users/{userId}/watchList/{itemId}`)

```
- All operations: User can only access their own watch list
```

**Validation**:
- Vendor and product must be non-empty strings
- Maximum length: 100 characters each
- Added timestamp required

#### CVE Cache (`cves/{cveId}`)

```
- Read: All authenticated users (public CVE data)
- Write: Denied (Cloud Functions only via admin SDK)
```

#### Audit Logs (`audit/{logId}`)

```
- Read: User can only read their own audit logs
- Write: Denied (Cloud Functions only)
```

#### Default Deny

```
- All other paths: Explicitly denied
```

### Cloud Functions Security

**Authentication Required**: All callable functions verify `context.auth`

```javascript
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
}
```

**User Isolation**: Functions only access data for authenticated user

```javascript
const userId = context.auth.uid;
// All operations scoped to userId
```

**Admin SDK**: Only Cloud Functions have admin access to bypass security rules

## Data Protection

### Data Classification

| Data Type | Sensitivity | Storage | Encryption |
|-----------|-------------|---------|------------|
| Email | PII | Firebase Auth | At rest + transit |
| Watch List | Non-sensitive | Firestore | At rest + transit |
| CVE Data | Public | Firestore | At rest + transit |
| Audit Logs | Internal | Firestore | At rest + transit |

### Data Minimization

**What We Collect**:
- Email address (authentication only)
- Watch list (vendor/product names)
- Last checked timestamp
- Notification preference (boolean)

**What We Don't Collect**:
- No personal information beyond email
- No usage analytics (beyond Firebase defaults)
- No IP addresses or device information
- No cookies except Firebase essentials
- No third-party tracking

### Encryption

- **At Rest**: Firebase/Google Cloud encryption (AES-256)
- **In Transit**: HTTPS/TLS 1.2+ required
- **Keys**: Managed by Google Cloud (no key management needed)

### Data Retention

- **User Data**: Retained until user deletes account
- **CVE Data**: Retained indefinitely (public information)
- **Audit Logs**: Retained for 90 days (configurable)
- **Deleted Data**: Permanently deleted within 48 hours

## Network Security

### Firebase Hosting Security Headers

**Configuration**: `firebase.json`

```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

### HTTPS Only

- Firebase Hosting enforces HTTPS
- HTTP requests automatically redirected to HTTPS
- HSTS header ensures browser always uses HTTPS

### CORS

- Firebase Cloud Functions: Automatically configured
- NVD API: Public API, no CORS issues

## Input Validation

### Frontend Validation

- Email format validation
- Password minimum length (8 characters)
- Watch list field length limits (100 characters)
- Required field enforcement

### Backend Validation

- Firestore Security Rules enforce schema
- Cloud Functions validate input types
- Length and format validation on all user inputs

### XSS Protection

- React: Automatic escaping of user input
- No `dangerouslySetInnerHTML` used
- Content Security Policy headers set

### SQL Injection Protection

- N/A: NoSQL database (Firestore)
- No raw queries, all via Firebase SDK

## API Security

### NVD CVE API

- **Authentication**: Not required (public data)
- **Rate Limiting**: 5 requests per 10 seconds (without API key)
- **API Key**: Can be added for higher limits if needed
- **Data Validation**: CVE data sanitized before storage

### Firebase APIs

- **Authentication**: Required for all user operations
- **Rate Limiting**: Firebase's built-in rate limiting
- **Token Refresh**: Automatic via Firebase SDK

## Audit Logging

### Logged Events

1. CVE collection completed
2. User data exported
3. Critical alerts created
4. Last checked timestamp updated
5. Account deletions

### Log Structure

```javascript
{
  userId: string,       // If user-specific
  action: string,       // Event type
  timestamp: timestamp,
  // Additional context
}
```

### Log Access

- Only accessible via Cloud Functions (admin)
- Users can read their own logs via future implementation
- Retained for compliance and troubleshooting

## Compliance

### GDPR Compliance

**Right to Access**: 
- `exportUserData` Cloud Function
- Downloads all user data in JSON format

**Right to Deletion**: 
- `deleteUserData` Cloud Function
- Deletes all user data and authentication account
- Confirmation required ("DELETE MY ACCOUNT")

**Right to Data Portability**: 
- Data export in machine-readable JSON format

**Privacy by Design**:
- Minimal data collection
- User-scoped storage
- Explicit consent for notifications

### Data Processing Agreement

Firebase/Google Cloud provides GDPR-compliant DPA:
- [Google Cloud Data Processing Amendment](https://cloud.google.com/terms/data-processing-addendum)

### Privacy Policy Requirements

Organizations must provide:
1. What data is collected (email, watch list)
2. How data is used (CVE filtering, optional alerts)
3. Where data is stored (Google Cloud/Firebase)
4. User rights (access, export, delete)
5. Data retention period
6. Contact information for data controller

## Vulnerability Management

### Dependency Management

**Frontend**: `package.json`
```bash
npm audit
npm audit fix
```

**Backend**: `functions/package.json`
```bash
cd functions
npm audit
npm audit fix
```

**Update Schedule**: Monthly security updates recommended

### Known Third-Party Dependencies

- **Firebase**: Google-managed, automatically updated
- **React**: Update via npm
- **date-fns**: Date manipulation library
- **lucide-react**: Icon library
- **node-fetch**: HTTP client for Cloud Functions

### CVE in Dependencies

Monitor via:
- GitHub Dependabot alerts
- `npm audit` commands
- Firebase security announcements

## Incident Response

### Suspected Compromise

1. **Immediate Actions**:
   - Rotate Firebase API keys
   - Review Firestore audit logs
   - Check Firebase Auth logs for suspicious activity
   - Disable affected accounts if necessary

2. **Investigation**:
   - Review Cloud Function logs
   - Check Firestore access patterns
   - Identify scope of compromise

3. **Remediation**:
   - Update Firestore security rules if needed
   - Force password resets if necessary
   - Notify affected users per GDPR requirements

4. **Prevention**:
   - Update dependencies
   - Review and strengthen security rules
   - Implement additional monitoring

### Reporting Security Issues

Contact: [Your organization's security team email]

## Security Testing

### Pre-Deployment Checklist

- [ ] Firestore security rules deployed
- [ ] All Cloud Functions require authentication
- [ ] HTTPS-only hosting verified
- [ ] Security headers confirmed
- [ ] Input validation tested
- [ ] Audit logging working
- [ ] Data export/delete functions tested
- [ ] Dependencies updated (`npm audit` clean)

### Ongoing Security Monitoring

- Firebase Console: Monitor auth and database activity
- Cloud Functions logs: Review for errors or anomalies
- Audit collection: Periodic review of logged events
- User feedback: Monitor for security concerns

### Penetration Testing Considerations

If required by organization:
1. Test authentication bypass attempts
2. Test Firestore security rule bypasses
3. Test input validation (XSS, injection)
4. Test authorization (access other users' data)
5. Test data export/delete functions

## Security Contacts

- **Firebase Security**: https://firebase.google.com/support/privacy
- **NVD Contact**: https://nvd.nist.gov/general/contact
- **Google Cloud Security**: https://cloud.google.com/security

## Updates to This Document

This security documentation should be reviewed and updated:
- When security features are added or changed
- After security incidents
- During compliance audits
- At least annually

---

**Last Updated**: February 5, 2026  
**Version**: 1.0  
**Reviewed By**: [Your security team]
