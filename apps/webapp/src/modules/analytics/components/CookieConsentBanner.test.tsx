import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CookieConsentBanner } from './CookieConsentBanner';
import type { ServiceConsent } from '../consentStorage';
import type { BannerView } from '../context/CookieConsentContext';

const consentState = {
  consent: null as ServiceConsent | null,
  bannerVisible: false,
  bannerView: 'manage' as BannerView
};
const setConsent = vi.fn();
const setBannerHeight = vi.fn();
const setBannerView = vi.fn();
let isCookieBannerRequired = true;

vi.mock('../context/CookieConsentContext', () => ({
  useCookieConsent: () => ({ ...consentState, setConsent, setBannerHeight, setBannerView })
}));
vi.mock('@/modules/geo-config/hooks/useGeoConfig', () => ({
  useGeoConfig: () => ({ isCookieBannerRequired })
}));
vi.mock('../PostHogProvider', () => ({ applyPostHogConsent: vi.fn() }));
vi.mock('../gtag', () => ({ applyGtagConsent: vi.fn() }));
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    // Strip the motion props so they don't land on the DOM node.
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => <div {...rest}>{children}</div>
  }
}));

const toggles = () => screen.getAllByRole('checkbox') as HTMLInputElement[];

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    consentState.consent = { posthog: true, google_analytics: true };
    consentState.bannerVisible = true;
    consentState.bannerView = 'manage';
    isCookieBannerRequired = true;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('resets the toggles to the stored consent when the banner reopens', () => {
    const { rerender } = render(<CookieConsentBanner />);
    const [posthog] = toggles();
    expect(posthog.checked).toBe(true);

    // The user flips a toggle but closes without saving.
    fireEvent.click(posthog);
    expect(toggles()[0].checked).toBe(false);

    consentState.bannerVisible = false;
    rerender(<CookieConsentBanner />);
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();

    consentState.bannerVisible = true;
    rerender(<CookieConsentBanner />);
    expect(toggles()[0].checked).toBe(true);
  });

  it('follows a consent change that lands while the banner is open', () => {
    const { rerender } = render(<CookieConsentBanner />);
    expect(toggles().map(t => t.checked)).toEqual([true, true]);

    // e.g. consent changed on another subdomain and this tab regained focus.
    consentState.consent = { posthog: false, google_analytics: true };
    rerender(<CookieConsentBanner />);
    expect(toggles().map(t => t.checked)).toEqual([false, true]);
  });

  it('shows a manually opened banner even where the geo does not require it', () => {
    isCookieBannerRequired = false;
    consentState.bannerVisible = false;
    const { rerender } = render(<CookieConsentBanner />);
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();

    consentState.bannerVisible = true;
    rerender(<CookieConsentBanner />);
    expect(screen.getByRole('region', { name: 'Cookie consent' })).toBeTruthy();

    consentState.bannerVisible = false;
    rerender(<CookieConsentBanner />);
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  });
});
