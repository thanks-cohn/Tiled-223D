#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js LTS + npm are required: https://nodejs.org/' >&2
  exit 1
fi
if [ ! -f node_modules/vite/bin/vite.js ]; then
  npm install --no-audit --no-fund
fi
printf 'Opening Toon World in your browser. Press Ctrl+C to stop.\n'
npm run dev -- --open
