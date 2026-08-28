#!/usr/bin/env bash
# Write tenderlyTestnetData.json + persistent-vnet-snapshots.json into GitHub repo
# variables used by .github/workflows/e2e-pool.yml (VNET_POOL_DATA / VNET_SNAPSHOT_DATA).
#
# Usage:
#   pnpm vnet:pool:store
#   pnpm vnet:pool:store --dry-run

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

POOL_FILE="tenderlyTestnetData.json"
SNAP_FILE="apps/webapp/src/test/e2e/persistent-vnet-snapshots.json"
DRY_RUN=false

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  fi
done

for f in "$POOL_FILE" "$SNAP_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing $f — run: pnpm vnet:pool:provision" >&2
    exit 1
  fi
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

POOL_JSON="$(jq -c . "$POOL_FILE")"
SNAP_JSON="$(jq -c . "$SNAP_FILE")"

echo "Pool networks: $(jq -r '.[].NETWORK' "$POOL_FILE" | paste -sd, -)"
echo "Snapshots: $(jq -r 'keys | join(", ")' "$SNAP_FILE")"
echo "VNET_POOL_DATA payload: ${#POOL_JSON} bytes"
echo "VNET_SNAPSHOT_DATA payload: ${#SNAP_JSON} bytes"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run — variables not updated."
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Set variables manually in Settings → Secrets and variables → Actions → Variables:" >&2
  echo "  VNET_POOL_DATA=<tenderlyTestnetData.json minified>" >&2
  echo "  VNET_SNAPSHOT_DATA=<persistent-vnet-snapshots.json minified>" >&2
  exit 1
fi

gh variable set VNET_POOL_DATA --body "$POOL_JSON"
gh variable set VNET_SNAPSHOT_DATA --body "$SNAP_JSON"

echo "Updated repo variables: VNET_POOL_DATA, VNET_SNAPSHOT_DATA"
