#!/bin/bash
# LedgerPad X Bot — VPS setup script
# Run once on a fresh Ubuntu/Debian VPS

set -e

echo "🚀 Setting up LedgerPad X Bot..."

# Install Node.js 20 if needed
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "✅ Node $(node -v)"

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

echo "✅ PM2 $(pm2 -v)"

# Install dependencies
npm install

# Create .env from example if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Edit .env and fill in your X API credentials:"
  echo "    nano .env"
  echo ""
  echo "Then run:  pm2 start index.js --name ledgerpad-bot"
  exit 0
fi

# Start with PM2
pm2 start index.js --name ledgerpad-bot
pm2 save
pm2 startup

echo ""
echo "✅ Bot is running! Check logs with: pm2 logs ledgerpad-bot"
