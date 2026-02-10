# Google Ads API Setup Guide

## Overview
To access Google Ads data in your SEO/PPC Opportunity Finder, you need to complete the following steps:

---

## ✅ What You Already Have

1. **OAuth Scopes** - Your `lib/auth.ts` already includes the Google Ads scope:
   ```
   https://www.googleapis.com/auth/adwords
   ```

2. **API Route** - The `/api/google-ads/customers` endpoint is properly configured

---

## 🔧 What You Need to Set Up

### Step 1: Enable APIs in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with your OAuth credentials)
3. Navigate to **APIs & Services** > **Library**
4. Enable the following APIs:
   - **Google Ads API**
   - **Content API for Shopping** (Crucial for Merchant Center access)
   - **Google Merchant Center API** (Optional but recommended)

### Step 2: Apply for Google Ads Developer Token

**Important:** This is the critical step that's likely missing!

1. Go to [Google Ads](https://ads.google.com/)
2. Sign in with the Google account that has access to your Ads accounts
3. Click on **Tools & Settings** (wrench icon) in the top right
4. Under **Setup**, click **API Center**
5. Click **Apply for access** (if you haven't already)
6. Fill out the application form:
   - **Application Name:** Your app name (e.g., "SEO/PPC Opportunity Finder")
   - **Description:** Describe what your app does
   - **Use case:** Select appropriate use case (e.g., "Reporting and Analytics")
7. Submit the application

**Note:** Google typically approves developer tokens within 1-2 business days for test access. Production access may take longer.

### Step 3: Get Your Developer Token

Once approved:

1. Return to **API Center** in Google Ads
2. You'll see your **Developer Token** displayed
3. Copy this token

### Step 4: Add Developer Token to Your .env File

Add this line to your `.env` file:

```bash
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token-here
```

**Example:**
```bash
GOOGLE_ADS_DEVELOPER_TOKEN=ABcdEFghIJklMNop
```

### Step 5: Link Your Google Ads Account

Make sure your Google account has access to at least one Google Ads account:

1. Go to [Google Ads](https://ads.google.com/)
2. If you don't have an account, create one (you don't need to run ads)
3. If you're managing accounts for clients, ensure you have **Manager Account** access

### Step 6: Update OAuth Consent Screen (if needed)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **OAuth consent screen**
3. Ensure the following scopes are added:
   - `https://www.googleapis.com/auth/webmasters.readonly` (Search Console)
   - `https://www.googleapis.com/auth/adwords` (Google Ads)
4. Add your email to **Test users** if your app is in testing mode

### Step 7: Re-authenticate

After adding the developer token:

1. **Restart your development server:**
   ```bash
   npm run dev
   ```

2. **Sign out** from your app (if currently signed in)

3. **Sign in again** - This will request the Google Ads permissions

---

## 🔍 Troubleshooting

### Issue: "No Google Ads access" error

**Possible causes:**
1. **Missing Developer Token** - Most common issue
2. **Token not approved** - Check API Center in Google Ads
3. **No Ads account linked** - Your Google account needs access to at least one Ads account
4. **Wrong Google account** - Make sure you're signing in with the account that has Ads access

### Issue: Developer token still pending

- **Test Access:** You can use test access while waiting for production approval
- **Test Mode:** Your developer token will have "Test" status initially
- **Limitations:** Test tokens can only access accounts you own/manage

### Issue: "No Merchant Center access" error

**Possible causes:**
1. **Content API not enabled** - Go to Google Cloud Console > APIs & Services > Library and enable "Content API for Shopping".
2. **Missing OAuth Scope** - The user must grant "Manage your product listings and accounts for Google Shopping" permission.
3. **No Merchant Center Account** - The email address must be a user in a Merchant Center account.

---

## 📋 Current Configuration Check

Your current `.env` file is missing:

```bash
# Add this line:
GOOGLE_ADS_DEVELOPER_TOKEN=
```

Your current auth scopes (already correct ✅):
```typescript
scope: "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/content https://www.googleapis.com/auth/adwords openid email profile"
```

---

## 🎯 Quick Start Checklist

- [ ] Enable Google Ads API in Google Cloud Console
- [ ] Apply for Google Ads Developer Token
- [ ] Wait for approval (1-2 business days for test access)
- [ ] Add `GOOGLE_ADS_DEVELOPER_TOKEN` to `.env` file
- [ ] Ensure your Google account has access to Google Ads
- [ ] Restart development server
- [ ] Sign out and sign in again
- [ ] Test the Google Ads account selector

---

## 📚 Additional Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [Developer Token Guide](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
- [OAuth Setup Guide](https://developers.google.com/google-ads/api/docs/oauth/overview)

---

## 🆘 Need Help?

If you continue to have issues after following these steps, check:

1. **Browser Console** - Look for specific error messages
2. **Server Logs** - Check the terminal where `npm run dev` is running
3. **Network Tab** - Inspect the `/api/google-ads/customers` request/response

The error messages will help identify the specific issue.
