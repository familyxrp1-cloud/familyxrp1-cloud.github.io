#!/bin/bash
set -e

KEY="${HELIUS_KEY:-}"

echo "=== Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "=== Cloning repo ==="
cd /root
rm -rf lab
git clone https://github.com/familyxrp1-cloud/familyxrp1-cloud.github.io lab
cd lab/collector

echo "=== Installing dependencies ==="
npm install
npm install -g pm2

echo "=== Writing config ==="
echo "HELIUS_KEY=${KEY}" > .env
echo "PORT=3000" >> .env

echo "=== Starting collector ==="
pm2 delete survivor-lab 2>/dev/null || true
pm2 start index.js --name survivor-lab
pm2 save

echo "=== Enabling auto-start on reboot ==="
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash

IP=$(curl -s ifconfig.me)
echo ""
echo "=============================="
echo " DONE"
echo " Visit: http://${IP}:3000"
echo "=============================="
