#!/usr/bin/env node

/**
 * Security Validator for Dependabot PRs
 * Validates that Dependabot PRs don't contain security issues
 */

const { execSync } = require('child_process');

// Load security configuration
const securityConfig = require('../.github/security.yml');

function checkForBlockedPatterns() {
  console.log('🔍 Checking for blocked patterns...');

  const blockedPatterns = securityConfig.security.blocked_patterns;
  let foundIssues = false;

  for (const pattern of blockedPatterns) {
    try {
      const result = execSync(`grep -r "${pattern}" .github/workflows/ || true`, { encoding: 'utf8' });
      if (result.trim()) {
        console.log(`❌ Found blocked pattern: ${pattern}`);
        console.log(result);
        foundIssues = true;
      }
    } catch {
      // grep returns non-zero when no matches found, which is expected
    }
  }

  if (!foundIssues) {
    console.log('✅ No blocked patterns found');
  }

  return !foundIssues;
}

function checkDependencyChanges() {
  console.log('📦 Checking dependency changes...');

  const allowedFiles = securityConfig.security.allowed_patterns;
  const changedFiles = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.trim());

  const suspiciousFiles = changedFiles.filter(file => {
    return !allowedFiles.some(pattern => {
      if (pattern.includes('**')) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*'));
        return regex.test(file);
      }
      return file === pattern;
    });
  });

  if (suspiciousFiles.length > 0) {
    console.log('⚠️  Found suspicious file changes:');
    suspiciousFiles.forEach(file => console.log(`  - ${file}`));
    return false;
  }

  console.log('✅ Only allowed files were changed');
  return true;
}

function runNpmAudit() {
  console.log('🔒 Running npm audit...');

  try {
    execSync('npm audit --audit-level=moderate', { encoding: 'utf8' });
    console.log('✅ No moderate or higher vulnerabilities found');
    return true;
  } catch (error) {
    console.log('❌ Vulnerabilities found:');
    console.log(error.stdout);
    return false;
  }
}

function main() {
  console.log('🚀 Starting security validation for Dependabot PR...');

  const checks = [checkForBlockedPatterns, checkDependencyChanges, runNpmAudit];

  let allPassed = true;

  for (const check of checks) {
    try {
      const passed = check();
      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Check failed with error: ${error.message}`);
      allPassed = false;
    }
    console.log('');
  }

  if (allPassed) {
    console.log('🎉 All security checks passed!');
    process.exit(0);
  } else {
    console.log('💥 Security validation failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkForBlockedPatterns,
  checkDependencyChanges,
  runNpmAudit
};
