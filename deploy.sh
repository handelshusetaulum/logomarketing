#!/usr/bin/env bash
# Deploy logomarketing.dk på Nordicway (køres på serveren).
#   ~/repos/logomarketing/deploy.sh
# Henter seneste version fra GitHub og kopierer de offentlige filer til document root.
# Statisk site: intet build-trin, ingen npm.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCROOT="${DOCROOT:-$HOME/logomarketing.dk}"   # ret hvis cPanel har valgt en anden sti

cd "$REPO_DIR"
git pull --ff-only

if [ ! -d "$DOCROOT" ]; then
  echo "Document root findes ikke: $DOCROOT" >&2; exit 1
fi

rsync -a --delete \
  --exclude '.git/' --exclude '.gitignore' --exclude '.cpanel.yml' --exclude 'deploy.sh' \
  --exclude 'supabase/' --exclude '*.md' --exclude '_headers' --exclude '_redirects' \
  --exclude '*.zip' --exclude '*.xlsx' \
  --exclude '.well-known/' --exclude 'cgi-bin/' \
  "$REPO_DIR"/ "$DOCROOT"/

find "$DOCROOT" -type d -not -path '*/.well-known*' -exec chmod 755 {} +
find "$DOCROOT" -type f -not -path '*/.well-known*' -exec chmod 644 {} +

echo "Deployet $(git rev-parse --short HEAD) → $DOCROOT"
