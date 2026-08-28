#!/usr/bin/env bash
# Provision long-lived pool VNets for e2e-pool CI (VNET_POOL_DATA / VNET_SNAPSHOT_DATA).
#
# Creates fresh ci-tests-testnet forks from MAINNET_FORK_CONTAINER_ID, funds the
# full wallet pool, and writes persistent-vnet-snapshots.json. Do not run
# pnpm vnet:delete:all afterward — those vnets must stay alive for CI.
#
# Usage:
#   pnpm vnet:pool:provision
#   FUND_NETWORKS=mainnet,base pnpm vnet:pool:provision   # subset (not for production pool)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Provision VNet pool ==="
echo "Mainnet parent: ${MAINNET_FORK_CONTAINER_ID:-from .env.example}"
echo ""

echo "1/3 Fork VNets (updates tenderlyTestnetData.json)..."
pnpm vnet:fork

echo ""
echo "2/3 Fund accounts + create snapshots..."
(cd apps/webapp && pnpm e2e:fund)

echo ""
echo "3/3 Validate pool health..."
(cd apps/webapp && npx tsx src/test/e2e/validate-vnets.ts)

echo ""
echo "=== Pool provisioned ==="
echo "  tenderlyTestnetData.json"
echo "  apps/webapp/src/test/e2e/persistent-vnet-snapshots.json"
echo ""
echo "Next: pnpm vnet:pool:store          # push to GitHub repo variables (needs gh auth)"
echo "      pnpm vnet:pool:store --dry-run # preview payload sizes only"
echo ""
echo "Keep these VNets running — deleting them invalidates the variables."
