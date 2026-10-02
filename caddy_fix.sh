#!/bin/bash
cat << "EOF" > /etc/caddy/Caddyfile
http://kektura-tracker.com:80, http://www.kektura-tracker.com:80 {
    reverse_proxy 127.0.0.1:3000
}
EOF
systemctl restart caddy
echo "Caddy is now fixed and running on port 80!"
