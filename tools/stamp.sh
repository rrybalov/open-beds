#!/usr/bin/env bash
# Stamp local CSS/JS references in the HTML pages with ?v=<version> so browsers
# fetch fresh files after each deploy (GitHub Pages lets browsers cache for 10 minutes).
# Run before committing:  tools/stamp.sh
set -euo pipefail
cd "$(dirname "$0")/.."
v="$(date -u +%Y%m%d%H%M)"
for f in index.html update.html admin.html; do
  sed -E -i "s#((src|href)=\"(assets|data)/[^\"?]+\.(js|css))(\?v=[0-9]+)?\"#\1?v=${v}\"#g" "$f"
done
echo "stamped v=${v}"
