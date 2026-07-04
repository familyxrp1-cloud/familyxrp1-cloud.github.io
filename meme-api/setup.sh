#!/bin/bash
set -e

KEY="${OPENAI_API_KEY:-}"
if [ -z "$KEY" ]; then
  echo "ERROR: set OPENAI_API_KEY before running this script, e.g.:"
  echo "  OPENAI_API_KEY=sk-... bash setup.sh"
  exit 1
fi

echo "=== Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "=== Cloning repo ==="
cd /root
rm -rf meme-api-src
git clone https://github.com/familyxrp1-cloud/familyxrp1-cloud.github.io meme-api-src
cd meme-api-src/meme-api

echo "=== Installing dependencies ==="
npm install
npm install -g pm2

echo "=== Writing config ==="
{
  echo "OPENAI_API_KEY=${KEY}"
  echo "PORT=3100"
  echo "CORS_ORIGIN=https://familyxrp.com"
  echo "PER_IP_HOURLY_LIMIT=5"
  echo "DAILY_GLOBAL_LIMIT=150"
} > .env

echo "=== Starting meme-api ==="
pm2 delete meme-api 2>/dev/null || true
pm2 start server.js --name meme-api
pm2 save

echo "=== Enabling auto-start on reboot ==="
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash

IP=$(curl -s ifconfig.me)
echo ""
echo "=============================="
echo " DONE"
echo " Running at: http://${IP}:3100"
echo " Point a subdomain (e.g. api.familyxrp.com) at this server,"
echo " then set API_BASE in meme-lab.html to match."
echo "=============================="
