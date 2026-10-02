#!/bin/bash
echo "Disabling Xray VPN..."
systemctl stop xray
systemctl disable xray

echo "Restoring Caddy config for full HTTPS..."
cat << "EOF" > /etc/caddy/Caddyfile
kektura-tracker.com, www.kektura-tracker.com {
    reverse_proxy 127.0.0.1:3000
}
EOF

echo "Restarting Caddy..."
systemctl restart caddy
systemctl status caddy --no-pager
echo "Done! Caddy is now managing HTTPS on port 443."
