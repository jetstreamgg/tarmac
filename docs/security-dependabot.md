# Security Measures for Dependabot PRs

This document explains the security measures implemented to safely provide secrets to Dependabot PRs while maintaining comprehensive testing.

## Overview

We use `pull_request_target` to give Dependabot access to secrets, enabling full E2E and unit testing. This approach is secured through multiple layers of protection.

## Security Layers

### 1. CodeQL Analysis

- **Purpose**: Semantic code analysis to detect security vulnerabilities
- **Configuration**: `.github/workflows/codeql-analysis.yml`
- **Custom Queries**: `.github/codeql/queries/SecretExposure.ql`
- **What it detects**:
  - Secret exposure patterns in workflows
  - Dangerous logging statements
  - Hardcoded secrets

### 2. Gitleaks Integration

- **Purpose**: Detect secrets and credentials in code
- **Configuration**: Runs on all Dependabot PRs
- **What it detects**:
  - API keys
  - Database URLs
  - Private keys
  - Access tokens

### 3. Semgrep Security Scan

- **Purpose**: Pattern-based security analysis
- **Configuration**: Uses security-audit, secrets, and OWASP rules
- **What it detects**:
  - Common security vulnerabilities
  - Secret exposure patterns
  - OWASP Top 10 issues

### 4. Custom Security Validator

- **Purpose**: Repository-specific security checks
- **Location**: `scripts/security-validator.js`
- **Configuration**: `.github/security.yml`
- **What it validates**:
  - Blocked patterns in workflow files
  - Allowed file changes for Dependabot
  - Dependency vulnerability scanning

### 5. Security Configuration

- **Location**: `.github/security.yml`
- **Purpose**: Define security policies and allowed/blocked patterns
- **Features**:
  - Safe vs restricted secrets classification
  - Allowed file patterns for Dependabot
  - Blocked patterns that indicate security issues

## How It Works

### For Dependabot PRs:

1. **Security Check Job** runs first and validates:
   - No blocked patterns in workflow files
   - Only allowed files are changed
   - No hardcoded secrets
   - No moderate+ vulnerabilities

2. **CodeQL Analysis** runs in parallel to detect:
   - Semantic security issues
   - Secret exposure patterns
   - Code quality issues

3. **Full Test Suite** runs with access to secrets:
   - All unit tests with Tenderly integration
   - Complete E2E test suite
   - Build and lint checks

### Security Measures:

- **Pattern Blocking**: Prevents common secret exposure patterns
- **File Validation**: Ensures only dependency files are changed
- **Vulnerability Scanning**: Checks for security issues in dependencies
- **Audit Trail**: All security checks are logged and visible

## Configuration

### Adding New Secrets

1. Update `.github/security.yml`:

   ```yaml
   security:
     restricted_secrets:
       - YOUR_NEW_SECRET
   ```

2. Update `scripts/security-validator.js` if needed

### Adding New Security Checks

1. Update `.github/security.yml`:

   ```yaml
   security:
     checks:
       - name: 'Your New Check'
         tool: 'your-tool'
         severity: 'error'
   ```

2. Implement the check in `scripts/security-validator.js`

## Monitoring

### Security Alerts

- CodeQL alerts appear in the Security tab
- Gitleaks findings are reported in workflow logs
- Semgrep results are uploaded as SARIF

### Audit Trail

- All security checks are logged in workflow runs
- Failed checks prevent PR merging
- Security findings are tracked over time

## Best Practices

### For Maintainers:

1. **Review Security Alerts**: Check the Security tab regularly
2. **Monitor Workflow Logs**: Look for security check failures
3. **Update Security Rules**: Keep patterns current with new threats
4. **Regular Audits**: Review security configuration quarterly

### For Contributors:

1. **Don't Echo Secrets**: Never use `echo ${{ secrets.SECRET }}`
2. **Use Environment Variables**: Always use proper secret references
3. **Check Security Alerts**: Address any security findings
4. **Follow Patterns**: Use established security patterns

## Troubleshooting

### Common Issues:

1. **Security Check Fails**: Check for blocked patterns in your changes
2. **CodeQL Alerts**: Review and address semantic security issues
3. **Gitleaks Findings**: Remove any accidentally committed secrets
4. **Semgrep Issues**: Fix pattern-based security problems

### Getting Help:

1. Check workflow logs for specific error messages
2. Review security configuration in `.github/security.yml`
3. Consult the security validator script for custom checks
4. Contact the security team for complex issues

## Security Contact

For security issues or questions about this setup:

- Create an issue with the `security` label
- Contact the security team directly
- Review security documentation in the repository
