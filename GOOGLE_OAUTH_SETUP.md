# Google OAuth Setup Guide

Complete guide to enable "Continue with Google" authentication.

## 📋 Prerequisites

- Google account
- Access to your Supabase project dashboard
- Your deployed app URL (e.g., `https://dating-app-seven-theta.vercel.app`)

---

## 🔧 Step 1: Create Google Cloud Project

### 1.1 Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account
3. Click **"Select a project"** dropdown at the top
4. Click **"NEW PROJECT"**
5. Enter project name: `HeartConnect Auth` (or your choice)
6. Click **"CREATE"**
7. Wait for project to be created (30 seconds)

### 1.2 Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Choose **"External"** (for testing with any Google account)
3. Click **"CREATE"**

#### Fill in the consent screen:

**App information:**
- **App name**: `HeartConnect`
- **User support email**: Your email address
- **App logo**: Upload your logo (optional)
- **Authorized domains**: Click **"ADD DOMAIN"** and enter:
  ```
  your-project-ref.supabase.co
  ```
  (Replace `your-project-ref` with your actual Supabase project reference)

**Developer contact:**
- **Email address**: Your email address

4. Click **"SAVE AND CONTINUE"**
5. On **"Scopes"** page, click **"ADD OR REMOVE SCOPES"**
6. Search for and select:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`
7. Click **"UPDATE"**
8. Click **"SAVE AND CONTINUE"**
9. On **"Test users"** page, click **"ADD USERS"**
10. Add the Google email addresses you want to test with
11. Click **"ADD"**
12. Click **"SAVE AND CONTINUE"**
13. Review and click **"BACK TO DASHBOARD"**

---

## 🔑 Step 2: Create OAuth 2.0 Credentials

### 2.1 Create Credentials

1. In the left sidebar, go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

### 2.2 Configure OAuth Client

**Application type**: Select **"Web application"**

**Name**: `HeartConnect Web Client`

**Authorized JavaScript origins**: Click **"+ ADD URI"** and add:
```
https://your-project-ref.supabase.co
```

**Authorized redirect URIs**: Click **"+ ADD URI"** and add:
```
https://your-project-ref.supabase.co/auth/v1/callback
```

⚠️ **Important**: Replace `your-project-ref` with your actual Supabase project reference!

**Example**: If your Supabase URL is `https://abcdefghijklmnop.supabase.co`, then:
- Authorized JavaScript origin: `https://abcdefghijklmnop.supabase.co`
- Authorized redirect URI: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`

### 2.3 Save Credentials

1. Click **"CREATE"**
2. A popup will appear with your **Client ID** and **Client Secret**
3. **Copy both values** and save them somewhere safe (you'll need them next)
4. Click **"OK"**

---

## 🗄️ Step 3: Configure Supabase

### 3.1 Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard/
2. Select your project

### 3.2 Enable Google Provider

1. In the left sidebar, go to **Authentication** → **Providers**
2. Find **"Google"** in the list
3. Click to expand it
4. Toggle **"Enable Google provider"** to **ON**

### 3.3 Add Google Credentials

Fill in the fields:

- **Client ID**: Paste the Client ID from Google Cloud Console
- **Client Secret**: Paste the Client Secret from Google Cloud Console

### 3.4 Configure Redirect URL

In the same Google provider settings:

**Confirm Redirect URL**: This should automatically be:
```
https://your-project-ref.supabase.co/auth/v1/callback
```

### 3.5 Save Configuration

Click **"Save"** at the bottom

---

## 🌐 Step 4: Configure Your App URL in Supabase

### 4.1 Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your deployed app URL:
   ```
   https://dating-app-seven-theta.vercel.app
   ```
3. Under **Redirect URLs**, add:
   ```
   https://dating-app-seven-theta.vercel.app/**
   http://localhost:5173/**
   ```
4. Click **"Save"**

---

## 🔐 Step 5: Update Vercel Environment Variables

### 5.1 Check Current Variables

Your app needs these environment variables in Vercel:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://dating-app-seven-theta.vercel.app
VITE_APP_NAME=HeartConnect
```

### 5.2 Verify in Vercel

1. Go to your Vercel project dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. Verify all the above variables are present
4. If missing, add them

---

## 🧪 Step 6: Test Google Sign-In

### 6.1 Test on Deployed Version

1. Visit: `https://dating-app-seven-theta.vercel.app/auth/login`
2. Click **"Continue with Google"**
3. You should be redirected to Google's login page
4. Sign in with one of your test users
5. You should be redirected back to your app

### 6.2 Common Issues

**Issue**: "Google sign-in is not available right now"
- **Solution**: Google OAuth is not enabled in Supabase. Go back to Step 3.

**Issue**: Redirects back but shows error
- **Solution**: Check that your redirect URLs are configured correctly in both Google Cloud Console and Supabase

**Issue**: "Access denied" or "Error 400"
- **Solution**: Make sure you added your test user email in the OAuth consent screen (Step 1.2, step 9-11)

---

## 🚀 Step 7: Go Live (Remove Test Mode)

Once everything works with test users, you can make it public:

### 7.1 Publish Your App

1. Go back to **Google Cloud Console** → **OAuth consent screen**
2. Click **"PUBLISH APP"** button at the top
3. Confirm by clicking **"PUBLISH"**

### 7.2 Submit for Verification (Optional)

If you want to remove the "This app isn't verified" warning:

1. Go to **OAuth consent screen**
2. Click **"SUBMIT FOR VERIFICATION"**
3. Fill in the required information
4. Submit and wait for Google's review (takes 3-7 days)

**Note**: You can still use Google OAuth without verification, but users will see a warning screen.

---

## 📝 Checklist

Before going live, verify:

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 Client ID created
- [ ] Authorized JavaScript origins added
- [ ] Authorized redirect URIs added
- [ ] Supabase Google provider enabled
- [ ] Client ID and Secret added to Supabase
- [ ] Site URL configured in Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] Vercel environment variables set
- [ ] Tested with at least one Google account
- [ ] App published (if going public)

---

## 🔗 Useful Links

- [Supabase Google Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

---

## 💡 Troubleshooting

### "Redirect URI mismatch"

**Problem**: Google shows "Error 400: redirect_uri_mismatch"

**Solution**: 
1. Check the exact redirect URI in the error message
2. Make sure it matches EXACTLY what's in Google Cloud Console
3. Common mistake: Missing `/auth/v1/callback` at the end

### "Access denied"

**Problem**: Google shows "Access denied" or "You don't have permission"

**Solution**:
1. Make sure the Google account you're using is in the "Test users" list
2. Or publish the app to allow any Google account

### Button doesn't appear on deployed site

**Problem**: Google button shows locally but not on deployed version

**Solution**:
1. The button should always be visible - check browser console for errors
2. Make sure you've redeployed after pushing the latest code
3. Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel

### Works locally but not in production

**Problem**: Google OAuth works on localhost but not deployed

**Solution**:
1. Your local and production Supabase projects might be different
2. Make sure Google OAuth is configured in BOTH Supabase projects
3. Update redirect URLs in Google Cloud Console to include both:
   - `http://localhost:5173/auth/callback` (for local)
   - `https://your-app.vercel.app/auth/callback` (for production)

---

**Need more help?** Check the error message in your browser console (F12 → Console tab) and share it for debugging.
