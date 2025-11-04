# Parallel E2E Testing Architecture

This document describes the complete architecture and flow of the parallel E2E testing system implemented for the Tarmac DeFi application.

## Overview

The parallel testing system allows multiple E2E tests to run simultaneously without interfering with each other by ensuring complete test isolation through unique test accounts and atomic account management.

## Core Components

### 1. Account Pool Management (`accountPoolManager.ts`)

**Purpose**: Manages a pool of 100 unique test accounts to ensure no two tests ever share the same account.

**Key Features**:

- **Atomic Account Claiming**: Uses file-system locks to ensure thread-safe account assignment
- **No Account Release**: Once claimed, accounts are never released to prevent reuse
- **Worker-based Distribution**: Each Playwright worker gets its own unique account

```typescript
// Core account claiming logic
export async function claimAccount(): Promise<`0x${string}`> {
  const lockFilePath = path.join(os.tmpdir(), 'account-pool.lock');
  return await withFileLock(lockFilePath, async () => {
    // Atomic account selection and claiming
  });
}
```

### 2. Test Account Pool (`testWallets.ts`)

**Purpose**: Contains 100 pre-generated Ethereum addresses for test isolation.

```typescript
export const TEST_WALLET_ADDRESSES: readonly `0x${string}`[] = [
  '0x742d35Cc6bF4432c41fCC4A7c1dD25dDe88F6ad8', // 0
  '0xC0ffEE0000000000000000000000000000000000' // 1
  // ... 98 more addresses
];
export const TEST_WALLET_COUNT = 100;
```

### 3. VNet Validation (`validate-vnets.ts`)

**Purpose**: Validates that cached VNets and snapshots are healthy before use.

**Validation Checks**:

- **RPC Connectivity**: Ensures VNet endpoints are accessible
- **Snapshot Revert**: Tests that snapshots can be successfully reverted
- **Account Balances**: Verifies test accounts have sufficient ETH and token balances

**Exit Codes**:

- `0`: All VNets healthy (use cache)
- `1`: Some VNets unhealthy (recreate)

```typescript
// Standalone usage
export async function validateVnets(): Promise<{
  healthy: boolean;
  results: ValidationResult[];
}>;
```

### 4. Global Setup (`global-setup-parallel.ts`)

**Purpose**: Validates and funds all 100 test accounts before any tests run.

**Process**:

1. Initialize account pool state file
2. **Validate existing VNet snapshots** (if available)
   - Check RPC connectivity
   - Verify snapshot revert capability
   - Validate account balances
3. **Decision Point**:
   - If snapshots valid → Revert to snapshots (fast path ⚡)
   - If snapshots invalid → Fund accounts and create new snapshots
   - If VNets expired → Provide clear error message with fix
4. Fund all 100 addresses with test tokens on multiple networks
5. Set up initial balances for USDS, MKR, SKY tokens
6. Create snapshots after funding for future reuse
7. Log funding completion for verification

### 5. Wagmi Configuration (`config.e2e.parallel.ts`)

**Purpose**: Creates mock wallet connectors that use test accounts.

**Key Features**:

- **Lazy Account Resolution**: Accounts are resolved only when needed
- **Worker-specific Injection**: Each worker gets its unique account
- **Mock Wallet Simulation**: Simulates real wallet behavior without requiring actual wallets

```typescript
// Lazy account resolution
async getAccounts() {
  const accounts = getWorkerAccount();
  return accounts;
}
```

### 6. Test Fixtures (`fixtures-parallel.ts`)

**Purpose**: Provides isolated browser contexts and test accounts to each test.

**Features**:

- **Account Claiming**: Each test gets a unique account from the pool
- **Browser Context Injection**: Injects test account into browser context
- **No Account Release**: Accounts are never returned to the pool

```typescript
export const test = baseTest.extend<{
  isolatedPage: Page;
  testAccount: `0x${string}`;
}>({
  testAccount: async ({}, use, testInfo) => {
    const account = await claimAccount();
    console.log(`🔒 Worker ${testInfo.workerIndex} claimed account:`, account);
    await use(account);
    // NO RELEASE - account stays claimed
  }
});
```

### 7. Helper Utilities

#### Account Initialization (`initializeTestAccount.ts`)

- **Purpose**: Initializes fresh accounts with blockchain activity
- **Method**: Sends 1 wei self-transfer to activate account
- **Usage**: Opt-in per test when balance updates are critical

#### Balance Parsing (`helper functions in test files`)

- **Purpose**: Consistent balance parsing across all tests
- **Functions**:
  - `parseBalanceText()`: Strips currency symbols and commas
  - `getSupplyInputBalance()`: Gets supply input balance
  - `getSuppliedBalance()`: Gets current supplied balance
  - `getWithdrawInputBalance()`: Gets withdraw input balance

## Architecture Flow

### 1. Test Suite Initialization

```mermaid
graph TD
    A[Global Setup Starts] --> B[Initialize Account Pool State]
    B --> C{Snapshots Exist?}
    C -->|Yes| D[Validate VNets]
    C -->|No| G[Fund Accounts]
    D -->|Healthy| E[Revert to Snapshots]
    D -->|Unhealthy| F{VNets Expired?}
    F -->|Yes| Z[Error: Recreate VNets]
    F -->|No| G
    E --> H[All Tests Ready]
    G --> I[Create New Snapshots]
    I --> H
```

### 2. Individual Test Execution

```mermaid
graph TD
    A[Test Starts] --> B[Claim Unique Account]
    B --> C[Create Isolated Browser Context]
    C --> D[Inject Test Account into Browser]
    D --> E[Connect Mock Wallet]
    E --> F[Execute Test Logic]
    F --> G[Test Completes - Account Stays Claimed]
```

### 3. Account Pool State Management

```mermaid
graph TD
    A[Worker Requests Account] --> B[Acquire File Lock]
    B --> C[Read Pool State]
    C --> D[Find First Available Account]
    D --> E[Mark Account as Claimed]
    E --> F[Write Updated State]
    F --> G[Release Lock]
    G --> H[Return Account to Worker]
```

## Configuration Files

### 1. Playwright Config (`playwright-parallel.config.ts`)

```typescript
export default defineConfig({
  fullyParallel: true,
  workers: process.env.TEST_WORKERS ? parseInt(process.env.TEST_WORKERS) : 6, // Configurable via env
  retries: 2, // Auto-retry failed tests
  globalSetup: './src/test/e2e/global-setup-parallel.ts',
  reporter: [
    ['html', { open: 'never' }],
    ['line'],
    ['json', { outputFile: 'test-results.json' }] // For retry tracking
  ]
});
```

### 2. Package.json Scripts

```json
{
  "e2e:parallel": "playwright test --config playwright-parallel.config.ts",
  "e2e:parallel:retry-failed": "SKIP_FUNDING=true playwright test --last-failed --config playwright-parallel.config.ts",
  "e2e:parallel:retry-serial": "SKIP_FUNDING=true playwright test --last-failed --workers=1 --config playwright-parallel.config.ts"
}
```

## CI Integration (GitHub Actions)

- Workflow: `.github/workflows/e2e-parallel.yml`
- Purpose: Run the parallel Playwright E2E suite in CI with cached Tenderly VNets and retry logic.

### Triggers

This workflow runs on:

- pull_request: any open PR
- push: only on pushes to `main`
- workflow_dispatch: manual run from the Actions tab

Notes:

- Pushing only a workflow file change to a feature branch will not trigger the workflow unless there is an open PR, a push to `main`, or you run it manually.
- Commits containing "[skip ci]" will be ignored by CI providers.

### Manual Run (recommended for retries)

- GitHub UI: Actions → "Parallel E2E Tests" → "Run workflow" → set inputs
- GitHub CLI example:

```bash
gh workflow run e2e-parallel.yml \
  -f workers=6 \
  -f skip_funding=true \
  -f networks=mainnet,base,arbitrum,optimism,unichain
```

### Inputs and Environment

- workers → TEST_WORKERS (consumed by Playwright):
  - Default on PR/push: 3 (env fallback)
  - Default on manual dispatch: 6 (input default)
- skip_funding → SKIP_FUNDING (string 'true'|'false'): skips account funding when caches/snapshots are valid
- networks → FUND_NETWORKS: comma-separated networks to prepare (e.g. `mainnet,base,arbitrum,optimism,unichain`)

Playwright reads TEST_WORKERS in `apps/webapp/playwright-parallel.config.ts` to set `workers`.

### Concurrency and Caching

- concurrency:
  - group: `vnets-${{ github.head_ref || github.ref_name }}` (1 run per branch at a time)
  - cancel-in-progress: true
- cache keys:
  - restore: `persistent-vnets-${{ github.head_ref || github.ref_name }}-v3-` (prefix)
  - save: `persistent-vnets-${{ github.head_ref || github.ref_name }}-v3-${{ github.run_id }}`
- cleanup:
  - VNets are deleted at the end of `main` runs only; feature branches keep VNets to speed reruns (cache TTL applies).

### CI Job Outline

1. Checkout, setup pnpm/Node 20, install deps
2. Build packages, install Playwright browsers
3. Restore VNet cache ⇒ validate ⇒ create/recreate if needed
4. Run `apps/webapp/run-tests-with-retry.sh` (stake serial first, then rest in parallel, auto-retry last-failed serially)
5. On failure: upload artifacts and traces
6. Save updated VNet data and snapshots to cache

### Enabling runs on all branch pushes (optional)

If you want runs for all branches, adjust the trigger section:

```yaml
on:
  push:
    branches:
      - main
      - '**' # run on all branches
```

## Test Isolation Strategy

### 1. Account-Level Isolation

- **100 Unique Addresses**: No two tests ever share an account
- **Pre-funded Balances**: All accounts have sufficient test tokens
- **Permanent Claiming**: Once used, accounts are never reused

### 2. Browser-Level Isolation

- **Isolated Contexts**: Each test gets a fresh browser context
- **Mock Wallet Injection**: Test accounts are injected at the browser level
- **No Cross-Test Pollution**: Tests cannot affect each other's state

### 3. Network-Level Isolation

- **Tenderly Forks**: Each network uses isolated blockchain forks
- **Consistent State**: All tests start with the same blockchain state
- **Independent Transactions**: Test transactions don't interfere

## Retry Mechanism

### 1. Automatic Retries

- **Built-in**: 2 retries per test configured in Playwright
- **Same Account**: Retries use the same claimed account
- **Fresh Context**: New browser context for each retry

### 2. Manual Retry System

- **Failed Test Tracking**: JSON reporter tracks which tests failed
- **Selective Re-run**: `--last-failed` flag runs only failed tests
- **Skip Funding**: Retry scripts use `SKIP_FUNDING=true` for speed

### 3. Retry Strategies

```bash
# Retry failed tests in parallel
pnpm e2e:parallel:retry-failed

# Retry failed tests serially (more stable)
pnpm e2e:parallel:retry-serial

# Automated retry with wrapper script
./run-tests-with-retry.sh
```

## Performance Optimizations

### 1. Funding Optimization

- **Batch Operations**: Fund all accounts in parallel during setup
- **Skip on Retry**: Retry scripts skip funding for speed
- **Network-Specific**: Only fund networks being tested

### 2. Account Management

- **Lock-Free Reading**: Most operations don't require locks
- **Minimal State**: Only track claimed status, not detailed usage
- **File-System Based**: No external dependencies or services

### 3. Test Execution

- **Full Parallelism**: `fullyParallel: true` enables maximum concurrency
- **Configurable Workers**: Can adjust based on system resources
- **Smart Retries**: Only retry tests that actually failed

## Troubleshooting

### 1. Common Issues

**VNets Expired or Not Found**:

- **Symptom**: "virtual testnet not found" error during validation
- **Solution**: Delete cache and recreate VNets
  ```bash
  rm -f tenderlyTestnetData.json apps/webapp/src/test/e2e/persistent-vnet-snapshots.json
  pnpm vnet:fork:ci
  ```
- **Prevention**: VNets typically expire after a few days on Tenderly

**Account Pool Exhaustion**:

- **Symptom**: "No available accounts" error
- **Solution**: Increase `TEST_WALLET_COUNT` or reduce parallel workers
- **Prevention**: Monitor account usage in logs

**Balance Update Issues**:

- **Symptom**: Tests fail because balances don't update
- **Solution**: Use `initializeTestAccount()` helper in test
- **Root Cause**: Fresh accounts need blockchain activity

**Lock Contention**:

- **Symptom**: Tests timeout during account claiming
- **Solution**: Check for zombie lock files in `/tmp`
- **Prevention**: Automatic cleanup on process exit

**Snapshot Validation Failures**:

- **Symptom**: Validation detects low balances but VNets exist
- **Solution**: Let global setup refund accounts automatically
- **Prevention**: Run `pnpm e2e:validate-vnets` before test runs

### 2. Debugging Commands

```bash
# Validate VNets and snapshots
pnpm -F webapp e2e:validate-vnets

# Run with verbose output
pnpm playwright test --config playwright-parallel.config.ts --verbose

# Check account pool state
cat /tmp/test-account-pool.json
```

## Monitoring and Observability

### 1. Logging Strategy

- **Account Claiming**: Log which worker claims which account
- **Balance Tracking**: Log initial and final balances in critical tests
- **Funding Status**: Log completion of account funding
- **Error Context**: Include account info in error messages

### 2. Test Reporting

- **HTML Report**: Visual test results with traces
- **JSON Output**: Machine-readable results for CI/CD
- **Line Reporter**: Real-time progress during execution

## Future Improvements

### 1. Potential Enhancements

- **Dynamic Pool Sizing**: Auto-adjust pool size based on test count
- **Auto VNet Creation**: Optionally auto-create VNets during global setup
- **Distributed Testing**: Support multiple test runners sharing pool
- **Advanced Retry Logic**: Smart retry based on failure patterns
- **Snapshot Versioning**: Track snapshot versions for better cache invalidation

### 2. Scalability Considerations

- **Database Backend**: Replace file-based state with database for scale
- **Account Recycling**: Safe account reuse after test completion
- **Cross-Network Testing**: Unified account management across chains

## Conclusion

This parallel testing architecture provides:

✅ **Complete Test Isolation**: No test interference through unique accounts
✅ **High Performance**: 6x faster execution through parallelism
✅ **Self-Healing VNets**: Automatic validation and recovery of test infrastructure
✅ **Reliability**: Robust retry mechanisms for flaky tests
✅ **Maintainability**: Clear separation of concerns and helper utilities
✅ **Scalability**: Easy to add more tests without account conflicts

The system successfully handles the complexities of parallel DeFi testing while maintaining test reliability and developer productivity.
