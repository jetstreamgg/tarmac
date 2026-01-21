import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for chatbot pre-fill filtering behavior
 *
 * These tests verify that the CHATBOT_PREFILL_FILTERING_ENABLED feature flag correctly
 * filters chatbot intents with pre-filled amounts/tokens based on:
 * 1. Environment variable override (VITE_CHATBOT_PREFILL_FILTERING_ENABLED)
 *
 * Expected behavior:
 * - Filtering enabled by default for all builds
 * - Can be disabled by setting VITE_CHATBOT_PREFILL_FILTERING_ENABLED='false'
 */

describe('Chatbot Pre-fill Filtering', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure clean state
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  describe('Default behavior (filtering enabled)', () => {
    it('should enable filtering by default when env var is not set', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', undefined);

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('should enable filtering when env var is explicitly set to "true"', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'true');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('should enable filtering when env var is set to any value other than "false"', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'anything');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('should enable filtering when env var is empty string', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', '');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });
  });

  describe('Opt-out behavior (filtering disabled)', () => {
    it('should DISABLE filtering when env var is explicitly set to "false"', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'false');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(false);
    });

    it('should only disable filtering with exact "false" string (case-sensitive)', async () => {
      // Capital F should NOT disable filtering
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'False');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('should not disable filtering with whitespace around "false"', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', ' false ');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });
  });

  describe('Real-world deployment scenarios', () => {
    it('Production deployment (default - filtering enabled)', async () => {
      vi.stubEnv('VITE_ENV_NAME', 'production');
      // VITE_CHATBOT_PREFILL_FILTERING_ENABLED not set

      const { CHATBOT_PREFILL_FILTERING_ENABLED, IS_PRODUCTION_ENV } = await import('@/lib/constants');

      expect(IS_PRODUCTION_ENV).toBe(true);
      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('Staging deployment (testing with filtering disabled)', async () => {
      vi.stubEnv('VITE_ENV_NAME', 'staging');
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'false');

      const { CHATBOT_PREFILL_FILTERING_ENABLED, IS_STAGING_ENV } = await import('@/lib/constants');

      expect(IS_STAGING_ENV).toBe(true);
      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(false);
    });

    it('Development environment (filtering enabled by default)', async () => {
      vi.stubEnv('VITE_ENV_NAME', 'development');

      const { CHATBOT_PREFILL_FILTERING_ENABLED, IS_DEVELOPMENT_ENV } = await import('@/lib/constants');

      expect(IS_DEVELOPMENT_ENV).toBe(true);
      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });

    it('Development environment (filtering disabled for local testing)', async () => {
      vi.stubEnv('VITE_ENV_NAME', 'development');
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'false');

      const { CHATBOT_PREFILL_FILTERING_ENABLED, IS_DEVELOPMENT_ENV } = await import('@/lib/constants');

      expect(IS_DEVELOPMENT_ENV).toBe(true);
      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(false);
    });
  });

  describe('Safety validation', () => {
    it('ensures filtering cannot be disabled by accident', async () => {
      // Verify that setting to any value other than 'false' keeps filtering enabled
      const testValues = ['', 'true', 'TRUE', '1', 'yes', 'enable', 'disabled', undefined];

      for (const value of testValues) {
        vi.resetModules();
        if (value !== undefined) {
          vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', value);
        }

        const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

        expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
        vi.unstubAllEnvs();
      }
    });

    it('ensures only exact "false" string disables filtering', async () => {
      vi.stubEnv('VITE_CHATBOT_PREFILL_FILTERING_ENABLED', 'false');

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(false);
    });

    it('documents the safe default behavior', async () => {
      // Even if the env var is misconfigured or missing, filtering is enabled

      const { CHATBOT_PREFILL_FILTERING_ENABLED } = await import('@/lib/constants');

      expect(CHATBOT_PREFILL_FILTERING_ENABLED).toBe(true);
    });
  });
});
