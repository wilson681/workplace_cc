#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
#
# Makes the test suites runnable the moment a session starts:
#   - NeuroCreatures (repo root) is zero-dependency — nothing to install.
#   - PocketPDF (pocketpdf/) needs pdf-lib for its node:test suite.
#
# Only runs in remote (web) sessions; idempotent (npm install, which the
# container caches afterwards); non-fatal if the network is unavailable so a
# blip never blocks session startup. All output is sent to stderr to keep the
# hook's stdout clean.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Use the harness-provided repo root, but fall back to resolving it from this
# script's own location so the hook never crashes under `set -u`.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

{
  npm install --prefix "$PROJECT_DIR/pocketpdf" --no-audit --no-fund --loglevel=error \
    || echo "session-start: skipped pocketpdf dep install (offline?); run 'npm install --prefix pocketpdf' if its tests fail"
} 1>&2
