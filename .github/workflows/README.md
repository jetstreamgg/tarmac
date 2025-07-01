# GitHub Workflows Documentation

## Overview

This repository uses a secure two-workflow pattern to handle CI/CD, specifically designed to work safely with Dependabot PRs while protecting secrets.

## Workflow Architecture

### 1. Untrusted Workflow (`ci-untrusted.yml`)
- **Trigger**: All pull requests (including Dependabot)
- **Permissions**: Read-only (no access to secrets)
- **Purpose**: Run basic checks that don't require secrets
- **Jobs**:
  - Install dependencies and build
  - Lint and type checking
  - Unit tests that don't require external services

### 2. Trusted Workflow (`ci-trusted.yml`)
- **Trigger**: Completion of untrusted workflow (via `workflow_run`)
- **Permissions**: Access to secrets (TENDERLY_API_KEY)
- **Purpose**: Run tests that require secrets in a secure context
- **Jobs**:
  - Verify untrusted tests passed
  - Run tests with Tenderly integration
  - Run E2E tests with virtual networks

### 3. Status Check Workflow (`ci-status-check.yml`)
- **Trigger**: All pull requests
- **Purpose**: Provide a single status check that waits for all workflows
- **Behavior**: Monitors both untrusted and trusted workflow results

### 4. Direct Push Workflows
- **`main.yml`**: Runs on pushes to main branch
- **`e2e.yml`**: Runs E2E tests on pushes to main branch
- **`release.yml`**: Handles package releases

## Security Model

1. **Dependabot PRs** cannot access secrets directly
2. **Untrusted workflow** runs in the PR context without secrets
3. **Trusted workflow** runs in the base repository context with secrets
4. **workflow_run** trigger ensures trusted code execution

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
   - Require status check: "CI / Overall Status"
   - Require branches to be up to date before merging

2. **Secrets**:
   - `TENDERLY_API_KEY`: Required for Tenderly integration
   - `NPM_TOKEN`: Required for package publishing

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