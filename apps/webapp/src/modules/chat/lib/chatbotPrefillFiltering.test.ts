import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for chatbot pre-fill filtering behavior (MICA compliance)
 *
 * These tests verify that the CHATBOT_DISABLE_PREFILL feature flag correctly
 * filters chatbot intents with pre-filled amounts/tokens based on:
 * 1. MICA build configuration (VITE_RESTRICTED_BUILD_MICA)
 * 2. Environment variable override (VITE_DISABLE_CHATBOT_PREFILL)
 *
 * Expected behavior:
 * - MICA builds: filtering enabled by default, can be disabled with env var = 'false'
 * - Non-MICA builds: filtering always disabled, env var ignored
 */

describe('Chatbot Pre-fill Filtering (MICA Compliance)', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure clean state
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  describe('MICA builds (VITE_RESTRICTED_BUILD_MICA=true)', () => {
    it('should enable filtering by default when env var is not set', async () => {
      // Mock MICA build with no VITE_DISABLE_CHATBOT_PREFILL set
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', undefined);

      // Re-import constants to get fresh evaluation
      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should enable filtering when env var is explicitly set to "true"', async () => {
      // Mock MICA build with VITE_DISABLE_CHATBOT_PREFILL='true'
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'true');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should enable filtering when env var is set to any value other than "false"', async () => {
      // Mock MICA build with VITE_DISABLE_CHATBOT_PREFILL='anything'
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'anything');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should enable filtering when env var is empty string', async () => {
      // Mock MICA build with VITE_DISABLE_CHATBOT_PREFILL=''
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', '');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should DISABLE filtering when env var is explicitly set to "false"', async () => {
      // Mock MICA build with VITE_DISABLE_CHATBOT_PREFILL='false'
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'false');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should be consistent with MICA configuration', async () => {
      // Mock MICA build (VITE_RESTRICTED_BUILD_MICA='true')
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');

      const { CHATBOT_DISABLE_PREFILL, RESTRICTED_INTENTS } = await import('@/lib/constants');
      const { Intent: IntentEnum } = await import('@/lib/enums');

      // Verify CHATBOT_DISABLE_PREFILL is enabled for MICA
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
      // Verify MICA configuration is active (TRADE_INTENT is restricted in MICA)
      expect(RESTRICTED_INTENTS).toContain(IntentEnum.TRADE_INTENT);
    });
  });

  describe('Non-MICA builds (VITE_RESTRICTED_BUILD_MICA not set or false)', () => {
    it('should disable filtering when MICA flag is not set', async () => {
      // Mock non-MICA build
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', undefined);
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', undefined);

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should disable filtering when MICA flag is "false"', async () => {
      // Mock non-MICA build (explicitly false)
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', undefined);

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should ignore VITE_DISABLE_CHATBOT_PREFILL="true" in non-MICA builds', async () => {
      // Mock non-MICA build with VITE_DISABLE_CHATBOT_PREFILL='true'
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'true');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Should still be false because it's not a MICA build
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should ignore VITE_DISABLE_CHATBOT_PREFILL="false" in non-MICA builds', async () => {
      // Mock non-MICA build with VITE_DISABLE_CHATBOT_PREFILL='false'
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'false');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Should be false because it's not a MICA build
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should be consistent with non-MICA configuration', async () => {
      // Mock non-MICA build
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');

      const { CHATBOT_DISABLE_PREFILL, RESTRICTED_INTENTS } = await import('@/lib/constants');
      const { Intent: IntentEnum } = await import('@/lib/enums');

      // Verify CHATBOT_DISABLE_PREFILL is disabled for non-MICA
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
      // Verify non-MICA configuration (TRADE_INTENT is NOT restricted in non-MICA)
      expect(RESTRICTED_INTENTS).not.toContain(IntentEnum.TRADE_INTENT);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle both restricted build flags being false', async () => {
      // Mock neither MICA nor regular restricted build
      vi.stubEnv('VITE_RESTRICTED_BUILD', 'false');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should only check VITE_RESTRICTED_BUILD_MICA, not VITE_RESTRICTED_BUILD', async () => {
      // Mock regular restricted build but NOT MICA
      vi.stubEnv('VITE_RESTRICTED_BUILD', 'true');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Filtering should be disabled because VITE_RESTRICTED_BUILD_MICA is false
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('should prioritize VITE_RESTRICTED_BUILD_MICA over VITE_RESTRICTED_BUILD', async () => {
      // Mock MICA build (should override regular restricted build)
      vi.stubEnv('VITE_RESTRICTED_BUILD', 'false');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Filtering should be enabled because VITE_RESTRICTED_BUILD_MICA is true
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should handle case-sensitive env var values', async () => {
      // Mock MICA build with different case variations
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'False'); // Capital F

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Should NOT match 'false' (case-sensitive)
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('should handle whitespace in env var values', async () => {
      // Mock MICA build with whitespace
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', ' false ');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Should NOT match 'false' (has whitespace)
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });
  });

  describe('Real-world deployment scenarios', () => {
    it('Production MICA deployment (default - filtering enabled)', async () => {
      // Simulate production MICA deployment with no override
      vi.stubEnv('VITE_ENV_NAME', 'production');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      // VITE_DISABLE_CHATBOT_PREFILL not set

      const { CHATBOT_DISABLE_PREFILL, IS_PRODUCTION_ENV } = await import('@/lib/constants');

      expect(IS_PRODUCTION_ENV).toBe(true);
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('Staging MICA deployment (testing with filtering disabled)', async () => {
      // Simulate staging environment where we temporarily disable filtering for testing
      vi.stubEnv('VITE_ENV_NAME', 'staging');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'false');

      const { CHATBOT_DISABLE_PREFILL, IS_STAGING_ENV } = await import('@/lib/constants');

      expect(IS_STAGING_ENV).toBe(true);
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('Production non-MICA deployment (filtering disabled)', async () => {
      // Simulate production non-MICA deployment
      vi.stubEnv('VITE_ENV_NAME', 'production');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'false');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'true'); // Should be ignored

      const { CHATBOT_DISABLE_PREFILL, IS_PRODUCTION_ENV } = await import('@/lib/constants');

      expect(IS_PRODUCTION_ENV).toBe(true);
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('Development environment (MICA - filtering enabled by default)', async () => {
      // Simulate local development with MICA config
      vi.stubEnv('VITE_ENV_NAME', 'development');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');

      const { CHATBOT_DISABLE_PREFILL, IS_DEVELOPMENT_ENV } = await import('@/lib/constants');

      expect(IS_DEVELOPMENT_ENV).toBe(true);
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });

    it('Development environment (MICA - filtering disabled for local testing)', async () => {
      // Simulate local development with filtering disabled for testing
      vi.stubEnv('VITE_ENV_NAME', 'development');
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'false');

      const { CHATBOT_DISABLE_PREFILL, IS_DEVELOPMENT_ENV } = await import('@/lib/constants');

      expect(IS_DEVELOPMENT_ENV).toBe(true);
      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });
  });

  describe('Compliance and safety validation', () => {
    it('ensures MICA builds cannot enable pre-fill by accident', async () => {
      // Verify that setting to any value other than 'false' keeps filtering enabled
      const testValues = ['', 'true', 'TRUE', '1', 'yes', 'enable', undefined];

      for (const value of testValues) {
        vi.resetModules();
        vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
        if (value !== undefined) {
          vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', value);
        }

        const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

        expect(CHATBOT_DISABLE_PREFILL).toBe(true);
        vi.unstubAllEnvs();
      }
    });

    it('ensures only exact "false" string disables filtering in MICA', async () => {
      // Only the exact string 'false' should disable filtering
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      vi.stubEnv('VITE_DISABLE_CHATBOT_PREFILL', 'false');

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      expect(CHATBOT_DISABLE_PREFILL).toBe(false);
    });

    it('documents the safe default behavior for MICA compliance', async () => {
      // This test documents that MICA builds are safe by default
      // Even if the env var is misconfigured or missing, filtering is enabled
      vi.stubEnv('VITE_RESTRICTED_BUILD_MICA', 'true');
      // Simulate misconfiguration: env var not set at all

      const { CHATBOT_DISABLE_PREFILL } = await import('@/lib/constants');

      // Safe default: filtering enabled
      expect(CHATBOT_DISABLE_PREFILL).toBe(true);
    });
  });
});
