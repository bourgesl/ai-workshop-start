#!/usr/bin/env bash
# Air cloud startup for Skill Atlas: Node CLI (node >= 24, TypeScript run natively by node).
set -euo pipefail

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi

cd "$(dirname "$0")/../.."

# The image ships node via nvm; make sure it is on PATH for this non-login shell.
if ! command -v node >/dev/null 2>&1 && [ -s "${NVM_DIR:-/usr/local/nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-/usr/local/nvm}/nvm.sh"
fi
echo "[startup] node $(node -v), npm $(npm -v)"

major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt 24 ]; then
  echo "[startup] ERROR: node >= 24 required (package.json engines), found $(node -v)" >&2
  exit 1
fi

echo "[startup] npm ci ..."
npm ci --no-audit --no-fund
echo "[startup] npm ci done"

# Mirrors .github/workflows/ci.yml: typecheck, tests, and the real CLI on the fixture.
healthcheck() {
  echo "[healthcheck] typecheck ..."
  npm run typecheck
  echo "[healthcheck] tests ..."
  npm test
  echo "[healthcheck] CLI smoke ..."
  ./skill-atlas help >/dev/null
  ./skill-atlas scan ./fixture
  echo "[healthcheck] OK"
}

if [ -n "${WARMUP:-}" ]; then healthcheck; fi
