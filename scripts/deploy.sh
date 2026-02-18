#!/bin/bash
# =============================================================
# AI Discovery Optimizer — One-Click Deploy Script
# =============================================================
# This script:
#   1. Installs dependencies
#   2. Generates Prisma client
#   3. Creates/links the app in your Partner Dashboard
#   4. Deploys the app + theme extension
#
# Prerequisites:
#   - Node.js 18+
#   - npm
#   - Logged into Shopify Partners (run: npx shopify auth login)
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
# =============================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     AI Discovery Optimizer — Deploy             ║"
echo "╠══════════════════════════════════════════════════╣"
echo ""

# Step 1: Install dependencies
echo "→ Step 1/4: Installing dependencies..."
npm install --silent
echo "  Done."

# Step 2: Generate Prisma client
echo "→ Step 2/4: Setting up database..."
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
echo "  Done."

# Step 3: Create/link app in Partner Dashboard
echo "→ Step 3/4: Linking app to Partner Dashboard..."
echo "  If this is your first time, Shopify will open a browser for login."
echo "  Follow the prompts to create or link the app."
echo ""
npx shopify app config link
echo "  Done."

# Step 4: Deploy
echo "→ Step 4/4: Deploying app + theme extension..."
npx shopify app deploy
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Deploy complete!                               ║"
echo "║                                                 ║"
echo "║  Next steps:                                    ║"
echo "║  1. Go to partners.shopify.com                  ║"
echo "║  2. Click your app → 'Test on dev store'        ║"
echo "║  3. Install the app on your store               ║"
echo "║  4. Open the app → click 'Scan My Store'        ║"
echo "║                                                 ║"
echo "║  The theme extension will also be available      ║"
echo "║  in the store's Theme Editor under 'App blocks' ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
