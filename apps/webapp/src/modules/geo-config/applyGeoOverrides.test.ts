import { describe, it, expect, vi } from 'vitest';
import { GeoConfig } from './types';

const mockConfig: GeoConfig = {
  version: '1.0.0',
  countryCode: 'US',
  generatedAt: '2024-01-01T00:00:00Z',
  cacheTtl: 300,
  isRegionRestricted: false,
  modules: {
    savings: { enabled: true },
    rewards: { enabled: true },
    expert: { enabled: true },
    trade: { enabled: true },
    upgrade: { enabled: true },
    seal: { enabled: true }
  },
  isCookiesBannerRequired: false
};

// Mock IS_PRODUCTION_ENV before importing applyGeoOverrides
vi.mock('@/lib/constants', () => ({
  IS_PRODUCTION_ENV: false
}));

// Import after mock setup
const { applyGeoOverrides } = await import('./applyGeoOverrides');

describe('applyGeoOverrides', () => {
  it('returns config unchanged when no geo params are present', () => {
    const result = applyGeoOverrides(mockConfig, '');
    expect(result).toBe(mockConfig);
  });

  it('returns config unchanged for unrecognized geo params', () => {
    const result = applyGeoOverrides(mockConfig, '?geo_foo=bar');
    // Still returns a new object since hasGeoParams is true, but values unchanged
    expect(result.isRegionRestricted).toBe(false);
    expect(result.modules.savings.enabled).toBe(true);
  });

  describe('geo_mode=full', () => {
    it('sets isRegionRestricted to false and enables all modules', () => {
      const restrictedConfig: GeoConfig = {
        ...mockConfig,
        isRegionRestricted: true,
        modules: {
          savings: { enabled: false, restrictionReason: 'Restricted' },
          rewards: { enabled: false, restrictionReason: 'Restricted' },
          expert: { enabled: false, restrictionReason: 'Restricted' },
          trade: { enabled: true },
          upgrade: { enabled: true },
          seal: { enabled: true }
        }
      };

      const result = applyGeoOverrides(restrictedConfig, '?geo_mode=full');
      expect(result.isRegionRestricted).toBe(false);
      expect(result.modules.savings.enabled).toBe(true);
      expect(result.modules.rewards.enabled).toBe(true);
      expect(result.modules.expert.enabled).toBe(true);
      expect(result.modules.trade.enabled).toBe(true);
      expect(result.modules.upgrade.enabled).toBe(true);
      expect(result.modules.seal.enabled).toBe(true);
    });
  });

  describe('geo_mode=restricted', () => {
    it('sets isRegionRestricted to true and disables savings/rewards/expert', () => {
      const result = applyGeoOverrides(mockConfig, '?geo_mode=restricted');
      expect(result.isRegionRestricted).toBe(true);
      expect(result.modules.savings.enabled).toBe(false);
      expect(result.modules.rewards.enabled).toBe(false);
      expect(result.modules.expert.enabled).toBe(false);
      expect(result.modules.trade.enabled).toBe(true);
      expect(result.modules.upgrade.enabled).toBe(true);
      expect(result.modules.seal.enabled).toBe(true);
    });
  });

  describe('geo_module_* overrides', () => {
    it('disables a single module', () => {
      const result = applyGeoOverrides(mockConfig, '?geo_module_savings=false');
      expect(result.modules.savings.enabled).toBe(false);
      expect(result.modules.rewards.enabled).toBe(true);
    });

    it('enables a single module', () => {
      const restrictedConfig: GeoConfig = {
        ...mockConfig,
        modules: {
          ...mockConfig.modules,
          savings: { enabled: false, restrictionReason: 'Restricted' }
        }
      };
      const result = applyGeoOverrides(restrictedConfig, '?geo_module_savings=true');
      expect(result.modules.savings.enabled).toBe(true);
      expect(result.modules.savings.restrictionReason).toBeUndefined();
    });

    it('ignores invalid values', () => {
      const result = applyGeoOverrides(mockConfig, '?geo_module_savings=maybe');
      expect(result.modules.savings.enabled).toBe(true);
    });
  });

  describe('priority', () => {
    it('geo_module_* overrides geo_mode', () => {
      const result = applyGeoOverrides(mockConfig, '?geo_mode=restricted&geo_module_savings=true');
      expect(result.isRegionRestricted).toBe(true);
      expect(result.modules.savings.enabled).toBe(true);
      expect(result.modules.rewards.enabled).toBe(false);
      expect(result.modules.expert.enabled).toBe(false);
    });

    it('geo_module_* can disable on top of geo_mode=full', () => {
      const result = applyGeoOverrides(mockConfig, '?geo_mode=full&geo_module_trade=false');
      expect(result.isRegionRestricted).toBe(false);
      expect(result.modules.trade.enabled).toBe(false);
      expect(result.modules.savings.enabled).toBe(true);
    });
  });

  it('does not mutate the original config', () => {
    const original = JSON.parse(JSON.stringify(mockConfig));
    applyGeoOverrides(mockConfig, '?geo_mode=restricted');
    expect(mockConfig).toEqual(original);
  });

  it('ignores invalid geo_mode values', () => {
    const result = applyGeoOverrides(mockConfig, '?geo_mode=invalid');
    expect(result.isRegionRestricted).toBe(mockConfig.isRegionRestricted);
    expect(result.modules.savings.enabled).toBe(mockConfig.modules.savings.enabled);
  });
});

describe('applyGeoOverrides (production)', () => {
  it('returns config unchanged in production', async () => {
    vi.resetModules();
    vi.doMock('@/lib/constants', () => ({
      IS_PRODUCTION_ENV: true
    }));

    const { applyGeoOverrides: prodApply } = await import('./applyGeoOverrides');
    const result = prodApply(mockConfig, '?geo_mode=full');
    expect(result).toBe(mockConfig);

    vi.resetModules();
  });
});
