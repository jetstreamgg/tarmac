import { beforeEach, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';
import { applySuperProperties, setVpnSuperProperties, UNKNOWN_VPN_PROPERTIES } from './superProperties';

vi.mock('posthog-js', () => ({
  default: { register: vi.fn() }
}));

vi.mock('./constants', () => ({
  reportAnalyticsError: vi.fn()
}));

describe('superProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers app_name alongside the VPN check properties', () => {
    setVpnSuperProperties({ is_vpn: false, is_restricted_region: false, country_code: 'NL' });
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: false,
      is_restricted_region: false,
      country_code: 'NL'
    });
  });

  it('registers the latest VPN properties on re-application (consent reset path)', () => {
    setVpnSuperProperties({ is_vpn: true, is_restricted_region: false, country_code: 'NL' });
    vi.clearAllMocks();

    applySuperProperties();
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: true,
      is_restricted_region: false,
      country_code: 'NL'
    });
  });

  it('supports the unknown state for unresolved, errored, or skipped checks', () => {
    setVpnSuperProperties(UNKNOWN_VPN_PROPERTIES);
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: 'unknown',
      is_restricted_region: 'unknown',
      country_code: 'unknown'
    });
  });

  it('never throws when posthog.register fails', () => {
    vi.mocked(posthog.register).mockImplementationOnce(() => {
      throw new Error('not initialized');
    });
    expect(() =>
      setVpnSuperProperties({ is_vpn: true, is_restricted_region: false, country_code: 'NL' })
    ).not.toThrow();
  });
});
