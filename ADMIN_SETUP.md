# Admin Role System Setup Guide

## Overview

This application now has a complete role-based access control system with:
- **Two roles**: `admin` and `user`
- **Invite-only registration**: New users must have a valid invite code
- **Admin Panel**: For generating invite codes and managing user roles
- **Protected routes**: Admin page is only accessible to admin users

---

## Initial Setup: Creating Your First Admin

Since registration now requires an invite code, you need to manually create your first admin user in Firebase. Follow these steps:

### Step 1: Start Your Local Development Server

```bash
npm run dev
```

### Step 2: Create Your User Account Temporarily

You have two options:

#### Option A: Temporarily Bypass Invite Code (Quickest)
1. Comment out the invite code validation in `Register.jsx` temporarily
2. Register your account normally
3. Uncomment the validation code
4. Continue to Step 3

#### Option B: Manually Create User in Firebase Console
1. Go to Firebase Console → Authentication
2. Add user manually with your email/password
3. Continue to Step 3

### Step 3: Set Your User Role to Admin in Firestore

#### Using Firebase Console (Recommended):
1. Go to Firebase Console → Firestore Database
2. Navigate to the `users` collection
3. Find your user document (by email or UID)
4. Click "Edit field" or add a new field
5. Add/update field: `role` = `admin` (string)
6. Save changes

#### Using Firebase CLI (Alternative):
```bash
# Coming soon
```

### Step 4: Refresh Your Application

1. Sign out and sign back in
2. You should now see the "Admin" link in the navigation
3. You can now access `/admin` route

---

## Using the Admin Panel

Once you're set up as an admin, you can access the Admin Panel at `/admin`.

### Generating Invite Codes

1. Go to Admin Panel
2. Click "Generate New Invite Code"
3. Copy the code and share it with new users
4. Codes are in format: `XXXX-XXXX-XXXX`
5. Each code can only be used once

### Managing User Roles

1. Go to Admin Panel → User Management section
2. See all registered users
3. Click "Make Admin" to promote a user to admin
4. Click "Make User" to demote an admin to regular user
5. Changes take effect immediately (user needs to refresh)

---

## Security Features

### Firestore Security Rules
The security rules enforce:
- Only admins can read all user documents
- Only admins can change user roles
- Users can only read their own profile
- Only admins can create invite codes
- Anyone authenticated can read invite codes (for validation during registration)
- Only admins can list all invite codes

### Client-Side Protection
- Admin routes redirect non-admins to dashboard
- Admin navigation link only shows for admin users
- Role checks happen on every auth state change

### Invite Code System
- Codes must be unique and unused
- Codes are marked as "used" after successful registration
- New users automatically get "user" role
- Codes are validated server-side via Firestore queries

---

## Testing the System Locally

### Test User Registration Flow:
1. Go to `/register`
2. Try registering without an invite code → Should fail
3. Try with invalid code → Should fail
4. Generate valid code as admin
5. Use that code to register → Should succeed
6. Check Firestore: New user has `role: "user"`
7. Check invite code: Should be marked as used

### Test Admin Panel:
1. Log in as admin
2. Navigate to `/admin`
3. Generate invite codes
4. View all users
5. Toggle user roles
6. Verify changes in Firestore

### Test Non-Admin Access:
1. Log in as regular user
2. Try to access `/admin` directly → Should redirect
3. Check navigation → No "Admin" link visible
4. Try changing own role in console → Should fail (Firestore rules block it)

---

## Deploying to Production

### Step 1: Update Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Step 2: Deploy Your Application
```bash
npm run build
firebase deploy
```

### Step 3: Set First Admin in Production
1. Go to Firebase Console (production project)
2. Find your user in Firestore
3. Set `role: "admin"` manually
4. Or use Firebase Admin SDK if you have backend

---

## Troubleshooting

### "I can't see the Admin link"
- Make sure your user document has `role: "admin"` in Firestore
- Sign out and sign back in
- Check browser console for errors

### "Invite code validation fails"
- Check Firestore rules are deployed
- Verify code exists in `inviteCodes` collection
- Verify code has `isActive: true` and `usedBy: null`
- Check browser console for permission errors

### "Can't update user roles"
- Make sure you're logged in as admin
- Check Firestore rules are deployed correctly
- Verify network requests in browser dev tools

### "Registration works without invite code"
- Make sure you removed any temporary bypasses
- Check that Register.jsx has validation code active
- Verify you're testing with a non-admin account

---

## File Changes Summary

### New Files:
- `src/components/Admin/AdminPanel.jsx` - Admin dashboard component

### Modified Files:
- `firestore.rules` - Added role-based security rules
- `src/contexts/AuthContext.jsx` - Added role tracking and `isAdmin()` function
- `src/components/Auth/Register.jsx` - Added invite code requirement
- `src/components/Common/Navigation.jsx` - Added admin link for admins
- `src/App.jsx` - Added `/admin` route
- `src/styles/index.css` - Added admin panel styles

### New Firestore Collections:
- `inviteCodes/` - Stores generated invite codes
  - `code` (string)
  - `createdBy` (string - user ID)
  - `createdAt` (timestamp)
  - `usedBy` (string - user ID or null)
  - `usedAt` (timestamp or null)
  - `isActive` (boolean)

### Updated Firestore Collections:
- `users/` - Now includes `role` field
  - `role` (string: "admin" or "user")

---

## Next Steps

1. Set yourself as admin in Firebase Console
2. Test the complete flow locally
3. Generate invite codes for your team
4. Deploy to production when ready
5. Set admin role in production Firestore

---

## Support

- Check browser console for errors
- Check Firestore rules in Firebase Console
- Verify security rules are deployed
- Test with Firebase Emulators locally first (optional)
