import posthog from 'posthog-js';
import { reportAnalyticsError } from './constants';

/**
 * Super properties attached to every PostHog event.
 *
 * posthog.reset() (used in the consent flow) wipes registered super properties,
 * so registration is centralized here: every path that needs to (re)apply them
 * — init, consent transitions, VPN status updates — calls applySuperProperties()
 * with the latest known state.
 */

/**
 * Mirrors the /ip/status response. Fields are 'unknown' until the first check
 * resolves, on check errors, or when the check is skipped.
 */
export type VpnSuperProperties = {
  is_vpn: boolean | 'unknown';
  is_restricted_region: boolean | 'unknown';
  country_code: string | 'unknown';
};

export const UNKNOWN_VPN_PROPERTIES: VpnSuperProperties = {
  is_vpn: 'unknown',
  is_restricted_region: 'unknown',
  country_code: 'unknown'
};

let vpnProperties: VpnSuperProperties = UNKNOWN_VPN_PROPERTIES;

/**
 * Update the VPN super properties. Called on every VPN check result — the check
 * polls every 60s and the status can genuinely change mid-session.
 */
export function setVpnSuperProperties(properties: VpnSuperProperties): void {
  vpnProperties = properties;
  applySuperProperties();
}

export function applySuperProperties(): void {
  try {
    posthog.register({
      app_name: 'app',
      ...vpnProperties
    });
  } catch (error) {
    reportAnalyticsError('applySuperProperties', error);
  }
}
