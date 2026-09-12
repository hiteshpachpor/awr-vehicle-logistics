#!/usr/bin/env bash
# Rebuilds docs/deliverable-2-presentation.pdf from
# docs/deliverable-2-presentation-content.md.
#
# Usage: docs/scripts/render-pdf.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(dirname "$SCRIPT_DIR")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Google Chrome not found at: $CHROME" >&2
  echo "Edit CHROME in this script to point at your Chrome/Chromium binary." >&2
  exit 1
fi

python3 "$SCRIPT_DIR/build_deck.py"

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=15000 \
  --print-to-pdf="$DOCS_DIR/deliverable-2-presentation.pdf" \
  "file://$SCRIPT_DIR/deck.html"

echo "Wrote $DOCS_DIR/deliverable-2-presentation.pdf"
