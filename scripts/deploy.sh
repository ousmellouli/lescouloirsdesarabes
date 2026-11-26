#!/usr/bin/env bash
# Publish dist/ to the gh-pages branch (GitHub Pages). Run after node scripts/build.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d); cp -r dist/. "$tmp"/
cd "$tmp" && git init -q -b gh-pages && git add -A && git -c user.name=Claude -c user.email=noreply@anthropic.com commit -qm "Deploy $(date -u +%FT%TZ)"
git push -f "${1:-origin-url}" gh-pages
