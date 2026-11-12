#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

./scripts/validate.sh

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('manifest.json')).version")"
ARCHIVE="chat-canvas-v${VERSION}.zip"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

mkdir -p "$STAGING/content" "$STAGING/icons" "$STAGING/popup" dist
cp manifest.json LICENSE README.md PRIVACY.md CHANGELOG.md "$STAGING/"
cp content/content.js content/markdown.js content/content.css "$STAGING/content/"
cp icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png "$STAGING/icons/"
cp popup/popup.html popup/popup.css popup/popup.js "$STAGING/popup/"

rm -f "dist/$ARCHIVE" "dist/$ARCHIVE.sha256"
(
  cd "$STAGING"
  zip -q -r "$ROOT/dist/$ARCHIVE" .
)
(
  cd dist
  shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
)

printf 'Created %s\n' "dist/$ARCHIVE"
printf 'Created %s\n' "dist/$ARCHIVE.sha256"
