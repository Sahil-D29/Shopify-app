# =============================================================
# AI Discovery Optimizer — Windows Deploy Script
# =============================================================
# Run this in PowerShell:
#   .\scripts\deploy.ps1
# =============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================="
Write-Host "  AI Discovery Optimizer - Deploy"
Write-Host "=========================================="
Write-Host ""

# Step 1: Install dependencies
Write-Host "[1/4] Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed"; exit 1 }
Write-Host "  Done." -ForegroundColor Green

# Step 2: Generate Prisma client
Write-Host "[2/4] Setting up database..."
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma generate failed"; exit 1 }
npx prisma db push
Write-Host "  Done." -ForegroundColor Green

# Step 3: Create/link app in Partner Dashboard
Write-Host ""
Write-Host "[3/4] Linking app to Partner Dashboard..."
Write-Host "  This will open your browser to create the app."
Write-Host "  Follow the prompts to select your Partner org."
Write-Host ""
npx shopify app config link
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: app config link failed"; exit 1 }
Write-Host "  Done." -ForegroundColor Green

# Step 4: Deploy
Write-Host ""
Write-Host "[4/4] Deploying app + theme extension..."
npx shopify app deploy
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: deploy failed"; exit 1 }

Write-Host ""
Write-Host "=========================================="
Write-Host "  Deploy complete!"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Go to partners.shopify.com"
Write-Host "  2. Click your app -> 'Test on dev store'"
Write-Host "  3. Install the app on your store"
Write-Host "  4. Open the app -> click 'Scan My Store'"
Write-Host "=========================================="
Write-Host ""
