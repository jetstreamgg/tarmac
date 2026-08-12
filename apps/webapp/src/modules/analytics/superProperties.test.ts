import { beforeEach, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: { register: vi.fn() }
}));

vi.mock('./constants', () => ({
  reportAnalyticsError: vi.fn()
}));

describe('superProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh module state per test: vpnProperties must start as null (pre-check).
    vi.resetModules();
  });

  it('registers only app_name before any VPN check result, so persisted values survive init', async () => {
    const { applySuperProperties } = await import('./superProperties');
    applySuperProperties();
    expect(posthog.register).toHaveBeenCalledWith({ app_name: 'app' });
  });

  it('registers app_name alongside the VPN properties once a check result arrives', async () => {
    const { setVpnSuperProperties } = await import('./superProperties');
    setVpnSuperProperties({ is_vpn: true, is_restricted_region: false });
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: true,
      is_restricted_region: false
    });
  });

  it('re-applies the latest VPN properties (consent reset path)', async () => {
    const { setVpnSuperProperties, applySuperProperties } = await import('./superProperties');
    setVpnSuperProperties({ is_vpn: false, is_restricted_region: false });
    vi.clearAllMocks();

    applySuperProperties();
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: false,
      is_restricted_region: false
    });
  });

  it('supports the unknown state for checks that failed without ever succeeding', async () => {
    const { setVpnSuperProperties } = await import('./superProperties');
    setVpnSuperProperties({ is_vpn: 'unknown', is_restricted_region: 'unknown' });
    expect(posthog.register).toHaveBeenCalledWith({
      app_name: 'app',
      is_vpn: 'unknown',
      is_restricted_region: 'unknown'
    });
  });

  it('never throws when posthog.register fails', async () => {
    const { setVpnSuperProperties } = await import('./superProperties');
    vi.mocked(posthog.register).mockImplementationOnce(() => {
      throw new Error('not initialized');
    });
    expect(() => setVpnSuperProperties({ is_vpn: true, is_restricted_region: false })).not.toThrow();
  });
});
