#!/bin/bash

# Supabase Environment Setup Script
echo "🚀 Setting up Supabase environment variables..."
echo ""

# Check if .env.local already exists
if [ -f .env.local ]; then
  echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
  cp .env.local .env.local.backup
fi

# Create .env.local with Supabase URL
cat > .env.local << EOF
# Supabase Configuration
# Generated automatically - add your anon key below

# Your Supabase Project URL
VITE_SUPABASE_URL=https://fvzpkzaualqgeyrulckf.supabase.co

# Your Supabase Anon Key
# Get this from: https://supabase.com/dashboard → Your Project → Settings → API → anon public key
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
EOF

echo "✅ Created .env.local file!"
echo ""
echo "📝 Next steps:"
echo "1. Open .env.local in a text editor"
echo "2. Replace 'YOUR_ANON_KEY_HERE' with your actual anon key from Supabase"
echo "3. Get your anon key from: https://supabase.com/dashboard → Settings → API"
echo ""
echo "🔑 Your Supabase URL is already set: https://fvzpkzaualqgeyrulckf.supabase.co"
echo ""
