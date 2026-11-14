# Deployment Guide

Complete deployment guide for HeartConnect dating app with all services.

## Prerequisites

1. **Supabase Account**: https://supabase.com
2. **Vercel Account** (recommended): https://vercel.com
3. **Email Service** (optional - can use Supabase's built-in)
4. **Domain Name** (optional but recommended)

## Step 1: Set Up Supabase Project

### 1.1 Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: heartconnect-prod (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine to start
4. Click "Create new project"
5. Wait for project to initialize (2-3 minutes)

### 1.2 Get Project Credentials

Once created, go to **Project Settings** → **API** and copy:

```
Project URL: https://your-project-ref.supabase.co
anon public key: eyJhbGc...
service_role key: eyJhbGc... (KEEP SECRET!)
```

### 1.3 Run Database Migrations

Install Supabase CLI locally:

```bash
npm install -g supabase
```

Link to your project:

```bash
supabase login
supabase link --project-ref your-project-ref
```

Push migrations:

```bash
supabase db push
```

### 1.4 Seed Initial Data (Optional)

To add demo data:

```bash
supabase db seed
```

Or manually insert admin user:

```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  crypt('YourStrongPassword123!', gen_salt('bf')),
  now()
);

INSERT INTO profiles (id, full_name, email)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com'),
  'Admin User',
  'admin@yourdomain.com'
);

INSERT INTO user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com'),
  'admin'
);
```

### 1.5 Configure Storage Buckets

In Supabase Dashboard → **Storage**:

1. Create bucket `profile-photos`:
   - Public: false
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

2. Create bucket `verification-selfies`:
   - Public: false
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

### 1.6 Configure Authentication

In Supabase Dashboard → **Authentication** → **Providers**:

1. **Email**: Enable and configure
   - Confirm email: Enabled
   - Set site URL: `https://yourdomain.com`
   - Add redirect URLs: `https://yourdomain.com/**`

2. **Google** (optional):
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Add callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

## Step 2: Configure Environment Variables

Create `.env.production` file:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...

# App
VITE_APP_URL=https://yourdomain.com
VITE_APP_NAME=HeartConnect

# Email (optional - if using external service)
# VITE_EMAIL_SERVICE=sendgrid
# VITE_SENDGRID_API_KEY=SG...

# Analytics (optional)
# VITE_GOOGLE_ANALYTICS=G-XXXXXXXXXX
```

## Step 3: Deploy Frontend to Vercel

### 3.1 Prepare Repository

Ensure your code is pushed to GitHub/GitLab.

### 3.2 Deploy to Vercel

1. Go to https://vercel.com and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add all variables from `.env.production`

6. Click "Deploy"

### 3.3 Custom Domain (Optional)

1. In Vercel project → **Settings** → **Domains**
2. Add your domain: `yourdomain.com`
3. Follow DNS configuration instructions
4. Wait for SSL certificate (automatic)

## Step 4: Configure Email Service

### Option A: Use Supabase's Built-in Email (Recommended for Start)

Supabase uses Inbucket for local development. For production:

1. In Supabase Dashboard → **Project Settings** → **Auth** → **Email Templates**
2. Customize templates as needed
3. Emails are sent automatically

### Option B: Use SendGrid (For Better Deliverability)

1. Create SendGrid account: https://sendgrid.com
2. Verify your domain
3. Create API key
4. In Supabase → **Project Settings** → **Auth** → **SMTP**
5. Configure:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: your-sendgrid-api-key
   Sender Email: noreply@yourdomain.com
   Sender Name: HeartConnect
   ```

### Option C: Use Resend (Modern Alternative)

1. Create Resend account: https://resend.com
2. Verify your domain
3. Create API key
4. In Supabase → **Project Settings** → **Auth** → **SMTP**
5. Configure:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: your-resend-api-key
   Sender Email: noreply@yourdomain.com
   Sender Name: HeartConnect
   ```

## Step 5: Configure Storage

### 5.1 Set Up CDN (Optional but Recommended)

In Supabase Dashboard → **Project Settings** → **API**:

1. Enable "Enable CDN for storage"
2. This speeds up image delivery globally

### 5.2 Configure Image Transformations

Supabase Storage supports automatic image resizing:

```typescript
// Example usage in code
const { data } = await supabase
  .storage
  .from('profile-photos')
  .getPublicUrl('user-id/photo.jpg', {
    transform: {
      width: 400,
      height: 400,
      resize: 'cover'
    }
  })
```

## Step 6: Post-Deployment Checklist

### 6.1 Test Critical Flows

- [ ] Sign up with new email
- [ ] Verify email confirmation works
- [ ] Upload profile photos
- [ ] Test matching algorithm
- [ ] Test chat functionality
- [ ] Test admin panel
- [ ] Test block/report functionality

### 6.2 Security Checks

- [ ] Verify RLS policies are active on all tables
- [ ] Check that service_role key is NOT in frontend code
- [ ] Verify CORS settings in Supabase
- [ ] Test authentication flows
- [ ] Check that private data (phone numbers, coordinates) is protected

### 6.3 Performance Checks

- [ ] Enable CDN for storage
- [ ] Check image optimization
- [ ] Verify lazy loading works
- [ ] Test PWA installation
- [ ] Check Lighthouse scores

## Step 7: Monitoring & Analytics

### 7.1 Supabase Monitoring

- Dashboard → **Reports**: View API usage, database stats
- Set up alerts for high usage

### 7.2 Vercel Analytics

In Vercel project → **Analytics**:
- Enable Web Analytics (free)
- View performance metrics
- Track user flows

### 7.3 Error Tracking (Optional)

Add Sentry for error tracking:

```bash
npm install @sentry/react @sentry/tracing
```

Configure in `main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
});
```

## Step 8: Database Backups

### 8.1 Enable Daily Backups

Supabase free tier includes:
- 7 days of Point-in-Time Recovery
- Daily backups retained for 7 days

For longer retention, upgrade to Pro plan ($25/month).

### 8.2 Manual Backup

```bash
supabase db dump --db-url "your-production-db-url" > backup.sql
```

## Step 9: Scaling Considerations

### When to Upgrade Supabase

- **Free Tier Limits**:
  - 500MB database
  - 5GB bandwidth
  - 50,000 monthly active users
  
- **Upgrade to Pro** ($25/month) when:
  - Database exceeds 400MB
  - More than 10,000 MAU
  - Need longer backup retention

### When to Add More Services

- **CDN**: If users are global
- **External Email**: If deliverability issues
- **Error Tracking**: If you need production monitoring
- **Analytics**: If you need detailed user insights

## Troubleshooting

### Email Not Sending

1. Check Supabase → **Logs** → **Auth logs**
2. Verify SMTP settings
3. Check email provider dashboard
4. Verify domain is authenticated

### Images Not Loading

1. Check bucket permissions
2. Verify CORS settings
3. Check file size limits
4. Verify MIME types

### Authentication Issues

1. Check redirect URLs in Supabase
2. Verify site URL matches deployment URL
3. Check email templates
4. Review auth logs

## Support

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Email support: support@yourdomain.com

---

**Deployment Time Estimate**: 2-3 hours for first deployment
**Ongoing Maintenance**: 1-2 hours per month
