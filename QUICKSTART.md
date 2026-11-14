# 🚀 Quick Start Deployment

Get your app live in 30 minutes with this quick guide.

## Option 1: Vercel (Recommended - Fastest)

### 1. Prepare Supabase (10 minutes)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Create new project at https://supabase.com/new
# Note your project reference and database password
```

### 2. Push Database (5 minutes)

```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

### 3. Deploy to Vercel (10 minutes)

1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add these environment variables:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://your-app.vercel.app
VITE_APP_NAME=HeartConnect
```

5. Click "Deploy"
6. Wait 2-3 minutes

### 4. Configure Supabase (5 minutes)

In Supabase Dashboard:

1. **Authentication** → **URL Configuration**
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

2. **Storage** → Create buckets:
   - `profile-photos` (private)
   - `verification-selfies` (private)

### ✅ Done! Your app is live.

---

## Option 2: Netlify (Alternative)

### 1. Same Supabase setup as above

### 2. Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

Or use the Netlify dashboard:
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Follow the same steps as Vercel

---

## Post-Deployment Setup

### Create Admin User

In Supabase SQL Editor:

```sql
-- Create admin account
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@yourdomain.com',
  crypt('YourSecurePassword123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  'authenticated',
  'authenticated'
);

-- Create profile
INSERT INTO profiles (
  id,
  email,
  full_name,
  date_of_birth,
  gender,
  interested_in,
  bio,
  location_city,
  location_country
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com'),
  'admin@yourdomain.com',
  'Admin User',
  '1990-01-01',
  'prefer_not_to_say',
  ARRAY['everyone']::interested_in[],
  'System administrator',
  'Admin City',
  'Admin Country'
);

-- Grant admin role
INSERT INTO user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com'),
  'admin'
);
```

### Configure Email Service (Optional)

For production, configure SMTP in Supabase:

1. **Settings** → **Auth** → **SMTP**
2. Choose provider:
   - **SendGrid**: Best deliverability
   - **Resend**: Modern, easy setup
   - **Mailgun**: Good for high volume

Example with SendGrid:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: SG.your-api-key
Sender: noreply@yourdomain.com
```

### Add Custom Domain (Optional)

**Vercel:**
1. Project Settings → Domains
2. Add: `yourdomain.com`
3. Update DNS as instructed

**Netlify:**
1. Domain Settings → Add custom domain
2. Follow DNS instructions

---

## Environment Variables Reference

### Required

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Recommended

```bash
VITE_APP_URL=https://yourdomain.com
VITE_APP_NAME=HeartConnect
```

### Optional

```bash
# Email Service
VITE_EMAIL_SERVICE=sendgrid
VITE_SENDGRID_API_KEY=SG...

# Analytics
VITE_GOOGLE_ANALYTICS=G-XXXXXXX

# Error Tracking
VITE_SENTRY_DSN=https://...
```

---

## Testing Checklist

After deployment, test these:

- [ ] Sign up with new email
- [ ] Email verification works
- [ ] Login works
- [ ] Upload profile photos
- [ ] Discovery feed loads
- [ ] Chat works
- [ ] Admin panel accessible
- [ ] PWA installable

---

## Troubleshooting

### "Invalid API key" error
- Check `VITE_SUPABASE_ANON_KEY` matches Supabase dashboard
- Ensure no extra spaces in the key

### Email not sending
- Check Supabase Auth → Logs
- Verify SMTP settings if using custom provider
- Check spam folder

### Images not loading
- Verify storage buckets exist
- Check bucket permissions (should be private)
- Ensure RLS policies are applied

### Build fails
- Check all environment variables are set
- Verify Node version is 20+
- Check build logs in Vercel/Netlify

---

## Next Steps

1. **Monitor**: Set up Supabase alerts for usage
2. **Backup**: Enable automatic database backups
3. **Scale**: Upgrade Supabase plan when needed
4. **Analytics**: Add Google Analytics or Plausible
5. **SEO**: Add sitemap and meta tags

---

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Full Guide: See `DEPLOYMENT.md` in this repo

**Estimated Time**: 30-45 minutes for first deployment
**Cost**: Free tier is sufficient for first 1000 users
