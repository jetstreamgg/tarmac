import posthog from 'posthog-js';
import { reportAnalyticsError } from './constants';

/**
 * Super properties attached to every PostHog event.
 *
 * posthog.reset() (used in the consent flow) wipes registered super properties,
 * so registration is centralized here: every path that needs to (re)apply them
 * — init, consent transitions, VPN status updates — calls applySuperProperties()
 * with the latest known state.
 *
 * The VPN properties are intentionally attached in all consent states: they are
 * IP-derived booleans of the same class as PostHog's own server-side GeoIP
 * enrichment ($geoip_country_code, present on all events), and they must be a
 * complete record — events are the only durable trace of the VPN check result.
 * country_code is deliberately NOT sent: it duplicates $geoip_country_code.
 */

/** 'unknown' means the check ran (or failed) without producing a verdict. */
export type VpnSuperProperties = {
  is_vpn: boolean | 'unknown';
  is_restricted_region: boolean | 'unknown';
};

// null until the first check result of this page load. While null, the VPN keys
// are not registered at all, so values persisted from a previous session (for
// accepted-consent users) survive init instead of being overwritten by a
// pre-check placeholder. Absent keys = "not yet checked this session".
let vpnProperties: VpnSuperProperties | null = null;

/**
 * Update the VPN super properties. Called whenever the periodic VPN check
 * produces a new result — status can genuinely change mid-session.
 */
export function setVpnSuperProperties(properties: VpnSuperProperties): void {
  vpnProperties = properties;
  applySuperProperties();
}

export function applySuperProperties(): void {
  try {
    posthog.register({
      app_name: 'app',
      ...(vpnProperties ?? {})
    });
  } catch (error) {
    reportAnalyticsError('applySuperProperties', error);
  }
}
