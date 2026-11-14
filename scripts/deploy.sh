#!/bin/bash

# HeartConnect Deployment Script
# This script helps automate the deployment process

set -e  # Exit on error

echo "🚀 HeartConnect Deployment Script"
echo "=================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with: npm install -g supabase"
    exit 1
fi

# Check if user is logged in to Supabase
echo "🔐 Checking Supabase login..."
if ! supabase projects list &> /dev/null; then
    echo "Please log in to Supabase:"
    supabase login
fi

# Get project reference
echo ""
echo "📋 Available Supabase projects:"
supabase projects list
echo ""
read -p "Enter your project reference (e.g., abcdefghijklmnop): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

# Link to project
echo ""
echo "🔗 Linking to project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

# Push database migrations
echo ""
echo "🗄️  Pushing database migrations..."
read -p "Do you want to push migrations? (y/n): " PUSH_DB
if [ "$PUSH_DB" == "y" ]; then
    supabase db push
    echo "✅ Database migrations pushed"
fi

# Seed database (optional)
echo ""
read -p "Do you want to seed the database with demo data? (y/n): " SEED_DB
if [ "$SEED_DB" == "y" ]; then
    supabase db seed
    echo "✅ Database seeded"
fi

# Get environment variables
echo ""
echo "🔑 Fetching environment variables..."
SUPABASE_URL="https://$PROJECT_REF.supabase.co"
echo "Supabase URL: $SUPABASE_URL"

# Get anon key
echo ""
echo "Please copy your anon key from:"
echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
read -p "Enter your anon key: " ANON_KEY

if [ -z "$ANON_KEY" ]; then
    echo "❌ Anon key is required"
    exit 1
fi

# Create .env.production file
echo ""
echo "📝 Creating .env.production file..."
cat > .env.production << EOF
# Supabase Configuration
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY

# Application Configuration
VITE_APP_URL=https://yourdomain.com
VITE_APP_NAME=HeartConnect
EOF

echo "✅ .env.production created"

# Build the project
echo ""
read -p "Do you want to build the project now? (y/n): " BUILD_NOW
if [ "$BUILD_NOW" == "y" ]; then
    echo "🔨 Building project..."
    npm run build
    echo "✅ Build complete"
fi

# Deploy instructions
echo ""
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Update .env.production with your actual domain:"
echo "   VITE_APP_URL=https://yourdomain.com"
echo ""
echo "2. Deploy to Vercel:"
echo "   - Push your code to GitHub"
echo "   - Go to https://vercel.com/new"
echo "   - Import your repository"
echo "   - Add environment variables from .env.production"
echo "   - Click Deploy"
echo ""
echo "3. Configure your domain in Vercel (optional):"
echo "   - Go to Vercel project → Settings → Domains"
echo "   - Add your domain"
echo ""
echo "4. Set up email service in Supabase:"
echo "   - Go to Supabase Dashboard → Project Settings → Auth → SMTP"
echo "   - Configure your email provider (SendGrid, Resend, etc.)"
echo ""
echo "5. Create storage buckets in Supabase:"
echo "   - profile-photos (private, 5MB limit)"
echo "   - verification-selfies (private, 10MB limit)"
echo ""
echo "6. Test the deployment:"
echo "   - Sign up with a new account"
echo "   - Verify email confirmation works"
echo "   - Test all features"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
