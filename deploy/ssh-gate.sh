#!/bin/sh
# Forced command of the deploy key that GitHub Actions uses (spec 0026 AC-7). Whatever the client asks for, this
# script lets it do exactly two things: push to ~/kektura.git and read its refs. Anything else, a login shell
# included, is refused.
#
# Install on the server: copy this file to ~/bin/deploy-gate, `chmod +x` it, and put the key in
# ~/.ssh/authorized_keys as one line (deploy/README.md has the whole procedure):
#
#   restrict,command="/home/a1mirr/bin/deploy-gate" ssh-ed25519 AAAA... github-actions-deploy
#
# git sends the repository path as the user typed it in the remote's URL, so the spellings of the usual ones
# are listed.
set -eu

repo="$HOME/kektura.git"

case "${SSH_ORIGINAL_COMMAND:-}" in
  "git-receive-pack '~/kektura.git'" | "git-receive-pack '/home/a1mirr/kektura.git'" | "git-receive-pack 'kektura.git'")
    exec git-receive-pack "$repo"
    ;;
  "git-upload-pack '~/kektura.git'" | "git-upload-pack '/home/a1mirr/kektura.git'" | "git-upload-pack 'kektura.git'")
    exec git-upload-pack "$repo"
    ;;
  *)
    echo "deploy key: only git push and git fetch for ~/kektura.git are allowed here." >&2
    exit 1
    ;;
esac
