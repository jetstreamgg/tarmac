# Dual VNet Setup for E2E Tests

## Overview

The E2E test suite uses **two different VNet fork configurations**:

1. **Standard VNet Fork** (`tenderlyTestnetData.json`)
   - Used by most tests
   - Standard mainnet fork without special pool configurations
   - Tests: trade, savings, stake, rewards, etc.

2. **stUSDS VNet Fork** (`tenderlyTestnetData-stusds.json`)
   - Used specifically for stUSDS provider tests
   - **Mainnet fork with Curve pool properly configured and funded**
   - Tests: `expert-stusds.spec.ts`, `stusds-provider-switching.spec.ts`

## Why Two VNets?

The stUSDS tests require a specific mainnet fork (container ID: `cec455a4-3a8a-4a93-ac66-fc98fa1a8103`) that has the Curve liquidity pool properly set up. This cannot be replicated on the standard fork, so we maintain separate VNet configurations.

## Local Development Workflow

### Setup

1. **Create Standard VNets** (for most tests):
   ```bash
   pnpm vnet:fork
   ```
   Creates `tenderlyTestnetData.json` with standard fork.

2. **Create stUSDS VNets** (for stUSDS tests):
   ```bash
   pnpm vnet:stusds:fork
   ```
   Creates `tenderlyTestnetData-stusds.json` with Curve pool fork.

3. **Fund Standard VNets**:
   ```bash
   cd apps/webapp
   pnpm e2e:fund
   ```

4. **Fund stUSDS VNets**:
   ```bash
   pnpm vnet:stusds:fund
   ```

### Running Tests

**Run all tests** (automatically uses correct VNet for each test):
```bash
cd apps/webapp
pnpm e2e:parallel
```

**Run only standard tests**:
```bash
pnpm e2e:parallel:standard
# or with specific test:
pnpm e2e:parallel --project=chromium mainnet-savings.spec.ts
```

**Run only stUSDS tests**:
```bash
pnpm e2e:parallel:stusds
# or with specific test:
pnpm e2e:parallel --project=chromium-stusds expert-stusds.spec.ts
```

### Cleanup

**Delete Standard VNets**:
```bash
pnpm vnet:delete:all
```

**Delete stUSDS VNets**:
```bash
pnpm vnet:stusds:delete
```

**Delete both**:
```bash
pnpm vnet:delete:all
pnpm vnet:stusds:delete
```

## CI Workflow

For CI environments (GitHub Actions, etc.), use the `:ci` variants that don't require `.env` file:

### Standard VNets (CI)
```bash
# Create
pnpm vnet:fork:ci

# Fund
cd apps/webapp && pnpm e2e:fund

# Run tests
pnpm e2e:parallel:standard

# Cleanup
pnpm vnet:delete:all:ci
```

### stUSDS VNets (CI)
```bash
# Create
pnpm vnet:stusds:fork:ci

# Fund
pnpm vnet:stusds:fund

# Run tests
pnpm e2e:parallel:stusds

# Cleanup
pnpm vnet:stusds:delete:ci
```

### Recommended CI Strategy

**Option 1: Sequential (Simpler)**
```yaml
- name: Run Standard Tests
  run: |
    pnpm vnet:fork:ci
    cd apps/webapp && pnpm e2e:fund
    pnpm e2e:parallel:standard
    cd ../.. && pnpm vnet:delete:all:ci

- name: Run stUSDS Tests
  run: |
    pnpm vnet:stusds:fork:ci
    pnpm vnet:stusds:fund
    cd apps/webapp && pnpm e2e:parallel:stusds
    cd ../.. && pnpm vnet:stusds:delete:ci
```

**Option 2: Parallel (Faster)**
```yaml
- name: Setup Standard VNets
  run: |
    pnpm vnet:fork:ci
    cd apps/webapp && pnpm e2e:fund

- name: Setup stUSDS VNets
  run: |
    pnpm vnet:stusds:fork:ci
    pnpm vnet:stusds:fund

- name: Run Standard Tests in parallel
  run: cd apps/webapp && pnpm e2e:parallel:standard &

- name: Run stUSDS Tests in parallel
  run: cd apps/webapp && pnpm e2e:parallel:stusds &

- name: Wait for tests
  run: wait

- name: Cleanup
  if: always()
  run: |
    pnpm vnet:delete:all:ci
    pnpm vnet:stusds:delete:ci
```

## How It Works

### File Structure
- `tenderlyTestnetData.json` - Standard VNet configuration
- `tenderlyTestnetData-stusds.json` - stUSDS VNet configuration
- `apps/webapp/src/test/e2e/persistent-vnet-snapshots.json` - Snapshots for standard VNets
- (stUSDS tests will create their own snapshot file when needed)

### VNet Selection Logic

1. **Playwright Config** (`playwright-parallel.config.ts`):
   - Defines two projects: `chromium` (standard) and `chromium-stusds`
   - Each project has specific test patterns
   - stUSDS project runs tests: `expert-stusds.spec.ts`, `stusds-provider-switching.spec.ts`

2. **Global Setup** (`global-setup-parallel.ts`):
   - Detects project from command-line args
   - Sets `USE_STUSDS_VNET=true` environment variable for stUSDS tests
   - This variable is propagated to all test utilities

3. **RPC URL Resolution** (`getRpcUrlFromFile.ts`):
   - Checks `USE_STUSDS_VNET` environment variable
   - Reads from `tenderlyTestnetData-stusds.json` if true
   - Otherwise reads from `tenderlyTestnetData.json`

### Environment Variables

- `USE_STUSDS_VNET=true` - Use stUSDS VNet fork (set automatically by project selection)
- `SKIP_FUNDING=true` - Skip funding if accounts already funded
- `FUND_NETWORKS=mainnet,base` - Fund only specific networks

## Test Matrix

| Test File | Project | VNet Fork | File Used |
|-----------|---------|-----------|-----------|
| mainnet-savings.spec.ts | chromium | Standard | tenderlyTestnetData.json |
| base-trade.spec.ts | chromium | Standard | tenderlyTestnetData.json |
| expert-stusds.spec.ts | chromium-stusds | Curve Pool | tenderlyTestnetData-stusds.json |
| stusds-provider-switching.spec.ts | chromium-stusds | Curve Pool | tenderlyTestnetData-stusds.json |

## Troubleshooting

### Tests fail with "No RPC URL found"
- Check that the appropriate VNet data file exists
- For standard tests: `tenderlyTestnetData.json` must exist
- For stUSDS tests: `tenderlyTestnetData-stusds.json` must exist

### stUSDS tests fail with pool-related errors
- Ensure you're using the stUSDS VNet fork: `pnpm vnet:stusds:fork`
- The standard fork does NOT have the Curve pool configured

### "VNets expired" error
- VNets have a limited lifetime on Tenderly
- Delete cache files and recreate: `pnpm vnet:delete:all && pnpm vnet:fork`
- For stUSDS: `pnpm vnet:stusds:delete && pnpm vnet:stusds:fork`

### Running both test types together
```bash
# This works - Playwright will automatically use correct VNet per project
pnpm e2e:parallel
```

The global setup is smart enough to detect which project is running and use the appropriate VNet configuration.

## Commands Quick Reference

### Standard VNets
```bash
pnpm vnet:fork              # Create (local)
pnpm vnet:fork:ci           # Create (CI)
cd apps/webapp && pnpm e2e:fund  # Fund accounts
pnpm vnet:delete:all        # Delete (local)
pnpm vnet:delete:all:ci     # Delete (CI)
```

### stUSDS VNets
```bash
pnpm vnet:stusds:fork       # Create (local)
pnpm vnet:stusds:fork:ci    # Create (CI)
pnpm vnet:stusds:fund       # Fund accounts
pnpm vnet:stusds:delete     # Delete (local)
pnpm vnet:stusds:delete:ci  # Delete (CI)
```

### Running Tests
```bash
pnpm e2e:parallel           # Run all tests (auto-selects VNet)
pnpm e2e:parallel:standard  # Run standard tests only
pnpm e2e:parallel:stusds    # Run stUSDS tests only
```
