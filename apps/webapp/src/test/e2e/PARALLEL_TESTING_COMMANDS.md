# Parallel E2E Testing Commands Reference

This document explains all available parallel E2E testing commands and their use cases.

## Core Commands

### `pnpm -F webapp e2e:validate-vnets`

**Purpose**: Validate cached VNets and snapshots are healthy
**Usage**: `pnpm -F webapp e2e:validate-vnets`
**Details**:

- Checks RPC connectivity to all VNets
- Verifies snapshots can be reverted
- Validates account balances (ETH and tokens)
- Exit code 0 = healthy, 1 = unhealthy
- Best for: Pre-flight check before running tests

### `pnpm e2e:parallel`

**Purpose**: Run all parallel E2E tests with default configuration
**Usage**: `pnpm e2e:parallel`
**Details**:

- Runs all tests in `playwright-parallel.config.ts`
- Automatically validates VNets before running
- Uses 6 parallel workers by default
- Funds all test accounts across all networks
- Best for: Full test suite execution

### `pnpm e2e:parallel:retry-failed`

**Purpose**: Re-run only the tests that failed in the previous run
**Usage**: `pnpm e2e:parallel:retry-failed`
**Details**:

- Uses Playwright's `--last-failed` flag
- Runs with same parallelism as original
- Skips account funding for speed
- Best for: Quick retry after fixing flaky tests

### `pnpm e2e:parallel:retry-serial`

**Purpose**: Re-run failed tests sequentially (one at a time)
**Usage**: `pnpm e2e:parallel:retry-serial`
**Details**:

- Uses `--last-failed` with `--workers=1`
- Skips account funding for speed
- Eliminates parallelism issues
- Best for: Debugging timing-sensitive failures

## Network-Specific Commands

### `pnpm e2e:parallel:mainnet`

**Purpose**: Run tests with only mainnet accounts funded
**Usage**: `pnpm e2e:parallel:mainnet`
**Details**:

- Sets `FUND_NETWORKS=mainnet`
- Faster setup (only funds mainnet accounts)
- Best for: Testing mainnet-only features

### `pnpm e2e:parallel:base`

**Purpose**: Run tests with only Base network accounts funded
**Usage**: `pnpm e2e:parallel:base`
**Details**:

- Sets `FUND_NETWORKS=base`
- Best for: Testing Base L2 features

### `pnpm e2e:parallel:arbitrum`

**Purpose**: Run tests with only Arbitrum accounts funded
**Usage**: `pnpm e2e:parallel:arbitrum`
**Details**:

- Sets `FUND_NETWORKS=arbitrum`
- Best for: Testing Arbitrum L2 features

### `pnpm e2e:parallel:optimism`

**Purpose**: Run tests with only Optimism accounts funded
**Usage**: `pnpm e2e:parallel:optimism`
**Details**:

- Sets `FUND_NETWORKS=optimism`
- Best for: Testing Optimism L2 features

### `pnpm e2e:parallel:skip-funding`

**Purpose**: Run tests without funding accounts
**Usage**: `pnpm e2e:parallel:skip-funding`
**Details**:

- Sets `SKIP_FUNDING=true`
- Assumes accounts are already funded
- Best for: Re-running tests quickly after initial run

## Suggested Additional Commands

Add these to your package.json for more testing scenarios:

### Development & Debugging

```json
"e2e:parallel:debug": "DEBUG=pw:api playwright test --config playwright-parallel.config.ts",
// Enable Playwright debug logs for troubleshooting

"e2e:parallel:headed": "playwright test --config playwright-parallel.config.ts --headed",
// Run tests with browser windows visible

"e2e:parallel:single": "TEST_WORKERS=1 playwright test --config playwright-parallel.config.ts",
// Run all tests sequentially with one worker
```

### Test Selection

```json
"e2e:parallel:savings": "playwright test --config playwright-parallel.config.ts -g 'savings'",
// Run only savings-related tests

"e2e:parallel:trade": "playwright test --config playwright-parallel.config.ts -g 'trade'",
// Run only trading tests

"e2e:parallel:rewards": "playwright test --config playwright-parallel.config.ts reward",
// Run only reward tests (reward-1.spec.ts, reward-2.spec.ts)

"e2e:parallel:quick": "playwright test --config playwright-parallel.config.ts --grep-invert='stake|seal'",
// Skip slow tests for quick feedback
```

### Network Combinations

```json
"e2e:parallel:l2": "FUND_NETWORKS=base,arbitrum,optimism,unichain playwright test --config playwright-parallel.config.ts",
// Test all Layer 2 networks

"e2e:parallel:mainnet-base": "FUND_NETWORKS=mainnet,base playwright test --config playwright-parallel.config.ts",
// Test mainnet and Base together

"e2e:parallel:no-unichain": "FUND_NETWORKS=mainnet,base,arbitrum,optimism playwright test --config playwright-parallel.config.ts",
// Test all networks except Unichain
```

## Environment Variables

These environment variables control test behavior:

| Variable        | Default                                   | Description                           |
| --------------- | ----------------------------------------- | ------------------------------------- |
| `SKIP_FUNDING`  | `false`                                   | Skip account funding in global setup  |
| `FUND_NETWORKS` | `mainnet,base,arbitrum,optimism,unichain` | Networks to fund                      |
| `TEST_WORKERS`  | `6`                                       | Number of parallel workers            |
| `RECORD_VIDEO`  | `off`                                     | Record test videos                    |
| `CI`            | `false`                                   | Running in CI environment             |
| `DEBUG`         | -                                         | Enable debug logging (e.g., `pw:api`) |

## Usage Patterns

### Local Development Flow

```bash
# First time setup - create VNets
pnpm vnet:fork:ci

# Validate VNets before testing (optional)
pnpm -F webapp e2e:validate-vnets

# First run - full setup
pnpm e2e:parallel

# Quick re-run after code changes
pnpm e2e:parallel:skip-funding

# Debug failures
pnpm e2e:parallel:retry-serial
```

### When VNets Expire

```bash
# VNets typically expire after a few days. When validation fails:

# 1. Delete old cache
rm -f tenderlyTestnetData.json apps/webapp/src/test/e2e/persistent-vnet-snapshots.json

# 2. Create fresh VNets
pnpm vnet:fork:ci

# 3. Run tests (will auto-fund and create snapshots)
pnpm e2e:parallel
```

## Special Scripts for running all tests

### `./run-tests-with-retry.sh`

A wrapper script that:

1. Runs stake.spec.ts in isolation first (it requires isolation)
2. Runs remaining tests in parallel
3. Automatically retries failures serially
4. Provides comprehensive exit status

Usage:

```bash
./apps/webapp/run-tests-with-retry.sh
```

## Best Practices

1. **Before testing**: Run `pnpm -F webapp e2e:validate-vnets` to check VNet health
2. **For daily development**: Use `e2e:parallel:skip-funding` after initial run
3. **For debugging**: Use `e2e:parallel:retry-serial` with `--headed`
4. **For flaky tests**: Run them in isolation like stake.spec.ts
5. **For performance**: Adjust `TEST_WORKERS` based on machine capabilities
6. **When tests fail mysteriously**: Validate VNets first - they may have expired

## Account Pool Status

Check account pool usage:

```bash
# View claimed accounts
cat /tmp/test-account-pool-state.json | jq '.accounts | map(select(.claimed))'

# Count available accounts
cat /tmp/test-account-pool-state.json | jq '.accounts | map(select(.claimed | not)) | length'
```
