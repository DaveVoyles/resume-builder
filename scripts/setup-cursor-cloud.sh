#!/usr/bin/env bash
# Cursor Cloud portable-core contract (keep twins in lockstep):
#   1. No Mini secrets, App tokens, board PATs, MainVault, or .env copies.
#   2. Fail closed if a required prove tool is missing.
#   3. Prove is the repo's secret-free core — not a Mini-only path.
#   4. GitHub Actions job cursor-cloud-setup on ubuntu-latest must stay green.
# Portable Cloud prove: npm ci + validate (sample workspace, no candidate data).
set -euo pipefail

ROOT_DIR="${CURSOR_CLOUD_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
NPM_BIN="${NPM_BIN:-npm}"

if [ ! -f "$ROOT_DIR/package-lock.json" ] || [ ! -f "$ROOT_DIR/package.json" ]; then
  echo "setup-cursor-cloud: invalid repository root: $ROOT_DIR" >&2
  exit 1
fi

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  echo "setup-cursor-cloud: npm is required (install Node.js)" >&2
  exit 1
fi

echo "setup-cursor-cloud: npm ci"
"$NPM_BIN" --prefix "$ROOT_DIR" ci

echo "setup-cursor-cloud: npm run validate"
(cd "$ROOT_DIR" && "$NPM_BIN" run validate)

echo "setup-cursor-cloud: environment ready"
