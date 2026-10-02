#!/bin/bash
# Makes room on the small production server (1 GB RAM): trims old logs and adds 2 GB of swap, which the
# Next.js build needs to avoid running out of memory. Safe to run again. Run as root: sudo bash server-setup.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

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
