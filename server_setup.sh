#!/bin/bash
echo "Cleaning up old journal logs..."
journalctl --vacuum-time=3d

echo "Checking for large logs in /var/log..."
find /var/log -type f -name "*.log" -size +100M -exec truncate -s 0 {} \;

if ! grep -q "swapfile" /etc/fstab; then
    echo "Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    echo "Swap created!"
else
    echo "Swap file already exists."
fi
