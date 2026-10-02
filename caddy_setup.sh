#!/bin/bash
echo "Installing Caddy..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo "Configuring Caddy..."
cat << EOF > /etc/caddy/Caddyfile
kektura-tracker.com, www.kektura-tracker.com {
    reverse_proxy 127.0.0.1:3000
}
EOF

systemctl restart caddy
echo "Caddy installed and configured!"
