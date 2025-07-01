# GitHub Workflows Documentation

## Overview

This repository uses a secure two-workflow pattern to handle CI/CD, specifically designed to work safely with Dependabot PRs while protecting secrets. This approach prevents the "Potential execution of untrusted code on a privileged workflow" security vulnerability.

## Workflow Architecture

### 1. Untrusted Workflow (`ci-untrusted.yml`)
- **Trigger**: All pull requests (including Dependabot)
- **Permissions**: `contents: read`, `actions: write` (minimal - no secrets access)
- **Purpose**: Build and test PR code in an unprivileged context
- **Jobs**:
  - Build all packages and webapp
  - Lint and type checking
  - Unit tests that don't require external services
  - Upload build artifacts and metadata

### 2. Trusted Workflow (`ci-trusted.yml`)
- **Trigger**: Completion of untrusted workflow (via `workflow_run`)
- **Permissions**: `contents: read`, `checks: write`, `pull-requests: write`, `actions: read` + secrets access
- **Security**: NEVER touches PR code - only base branch + secure artifact validation
- **Purpose**: Verify integrations work and validate PR build artifacts safely
- **Jobs**:
  - **Safe artifact handling**: Extract to temporary directories, validate content structure
  - **Metadata validation**: Verify JSON structure, data types, and allowed values
  - **Build verification**: Confirm artifacts exist without extracting/executing them
  - **Integration tests**: Run with base branch code to verify Tenderly API connectivity
  - Update PR status checks

### 3. Status Check Workflow (`ci-status-check.yml`)
- **Trigger**: All pull requests
- **Permissions**: `contents: read`, `statuses: read`, `checks: read` (read-only)
- **Purpose**: Wait for all CI to complete and provide a single required check
- **Behavior**: Monitors the "CI / All Checks" status set by trusted workflow

### 4. Direct Push Workflows
- **`main.yml`**: Runs on pushes to main branch (`contents: read`)
- **`e2e.yml`**: Runs E2E tests on pushes to main branch (`contents: read`, `actions: write`)
- **`release.yml`**: Handles package releases (`contents: write`, `packages: write`, `pull-requests: write`)

## Security Model

1. **Dependabot PRs** cannot access secrets directly
2. **Untrusted workflow** runs in the PR context without secrets
3. **Trusted workflow** runs in the base repository context with secrets
4. **Complete separation** - The trusted workflow NEVER touches PR code
5. **Artifact-based validation** - PR builds are validated as artifacts only
6. **workflow_run** trigger ensures separation of contexts
7. **Only metadata** is passed between workflows

### Why This Is Secure

This approach is completely secure because:
1. **No PR code execution in privileged context** - Ever
2. **Base branch only** - Trusted workflow only uses known-safe code
3. **Artifact validation** - PR builds are tested as static files
4. **API verification** - Integration tests ensure secrets and APIs work
5. **Clear boundaries** - Complete separation between trusted and untrusted contexts

### Testing Coverage

- ✅ **PR Code Quality**: Linting, type checking, unit tests (untrusted)
- ✅ **PR Build Verification**: Ensures PR code builds correctly (safe artifact validation)
- ✅ **API Integration**: Verifies secrets and external services work (trusted with base code)
- ✅ **Security**: No untrusted code execution in privileged context
- ✅ **Artifact Security**: Protection against artifact poisoning attacks

## Adding New Tests

### Tests that don't need secrets
Add them to `ci-untrusted.yml`:
```yaml
- name: Your Test Name
  run: pnpm test:your-test
```

### Tests that need secrets
Add them to `ci-trusted.yml`:
```yaml
- name: Your Secret Test
  run: pnpm test:secret-test
  env:
    YOUR_SECRET: ${{ secrets.YOUR_SECRET }}
```

## Required GitHub Settings

1. **Branch Protection Rules**:
   - Require status check: "Wait for CI"
   - Require branches to be up to date before merging
   - Do NOT require "CI / All Checks" as it's set by the trusted workflow

2. **Secrets**:
   - `TENDERLY_API_KEY`: Required for Tenderly integration
   - `NPM_TOKEN`: Required for package publishing

## Important Security Notes

- The trusted workflow MUST NEVER directly checkout PR code using `ref: ${{ github.event.pull_request.head.sha }}`
- Always use explicit `permissions` blocks following the principle of least privilege
- Only grant the minimum permissions needed for each workflow
- **Artifact Security**: Always extract artifacts to temporary directories and validate content
- **Content Validation**: Verify JSON structure, data types, and allowed values before use
- **No Artifact Execution**: Never execute or import code from untrusted artifacts
- Only pass metadata (not executable code) between untrusted and trusted workflows
- The TENDERLY_API_KEY is the only sensitive secret that needs protection

## Artifact Poisoning Protection

The workflow implements multiple layers of protection against artifact poisoning:

1. **Temporary Isolation**: All artifacts are extracted to isolated temporary directories
2. **Content Validation**: JSON metadata is validated for structure and data types
3. **Value Whitelisting**: Base branch references are restricted to known safe branches
4. **No Code Execution**: Build artifacts are validated for existence only, never executed
5. **Cleanup**: Temporary directories are always cleaned up after use

## Permissions Summary

- **Untrusted workflows**: Minimal permissions (`contents: read`, `actions: write` for artifacts)
- **Trusted workflows**: Limited permissions for status updates (`checks: write`, `pull-requests: write`)
- **Release workflows**: Elevated permissions only when needed (`contents: write`, `packages: write`)
- **Status workflows**: Read-only permissions (`statuses: read`, `checks: read`)

## Troubleshooting

### Dependabot PR fails
- Check `ci-untrusted.yml` workflow logs first
- If untrusted passes, check `ci-trusted.yml` logs
- Trusted workflow only runs if untrusted succeeds

### Status check stuck
- The overall status check waits up to 30 minutes
- Check individual workflow runs for specific failures

### E2E tests failing
- Ensure Tenderly API key is valid
- Check if virtual networks are being created/deleted properly
- Review playwright reports in artifacts