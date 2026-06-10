---
layout: null
---
#!/bin/sh
cd /root
rm -rf lab
git clone https://github.com/familyxrp1-cloud/familyxrp1-cloud.github.io lab
cd lab/collector
npm install
npm install -g pm2
echo "PORT=3000" > .env
pm2 delete survivor-lab 2>/dev/null || true
pm2 start index.js --name survivor-lab
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | sh
IP=$(curl -s ifconfig.me)
echo "Done: http://$IP:3000"
