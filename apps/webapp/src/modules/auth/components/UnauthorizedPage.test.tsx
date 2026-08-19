import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedPage } from './UnauthorizedPage';
import type { AccessBlockReason } from '@/modules/ui/context/ConnectedContext';

/**
 * Each block reason renders its own state (APP-497): a genuine block reads as
 * a block, an unavailable check reads as "try again later" — never as access.
 * No contact/recourse route on the blocked states for now (Kacper, 10 Aug 2026).
 */

const h = vi.hoisted(() => ({
  disconnect: vi.fn(),
  trackVpnBlockedPageView: vi.fn()
}));

vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useDisconnect: () => ({ disconnect: h.disconnect })
}));

vi.mock('@/modules/analytics/hooks/useVpnAnalytics', () => ({
  useVpnAnalytics: () => ({ trackVpnBlockedPageView: h.trackVpnBlockedPageView })
}));

vi.mock('@/modules/config/termsLink', () => ({
  getTermsLinkConfig: () => ({
    termsLinks: [{ name: 'Terms of Use', url: 'https://docs.sky.money/legal-terms' }]
  }),
  reportTermsLinkConfigErrorOnce: vi.fn()
}));

i18n.load('en', {});
i18n.activate('en');

const renderPage = (props: {
  blockReason?: AccessBlockReason;
  onRetry?: () => void;
  authIsLoading?: boolean;
}) =>
  render(
    <I18nProvider i18n={i18n}>
      <UnauthorizedPage
        authData={{ authIsLoading: props.authIsLoading ?? false }}
        vpnData={{ vpnIsLoading: false, countryCode: 'US' }}
        blockReason={props.blockReason}
        onRetry={props.onRetry}
      />
    </I18nProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('UnauthorizedPage', () => {
  it('shows the waiting state while checks are loading', () => {
    renderPage({ authIsLoading: true });

    expect(screen.getByText('Please wait...')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the region block with no action or recourse route', () => {
    renderPage({ blockReason: 'region-restricted' });

    expect(screen.getByText('Access blocked')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the blocked-wallet state with a disconnect way out', () => {
    renderPage({ blockReason: 'wallet-blocked' });

    expect(screen.getByText('Wallet blocked')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }));
    expect(h.disconnect).toHaveBeenCalled();
  });

  it('renders screening-unavailable as "check again later", not as a block', () => {
    const onRetry = vi.fn();
    renderPage({ blockReason: 'screening-unavailable', onRetry });

    expect(screen.getByText('Unable to verify this wallet')).toBeTruthy();
    expect(screen.queryByText('Wallet blocked')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRetry).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }));
    expect(h.disconnect).toHaveBeenCalled();
  });

  it('renders the network-error state with a retry', () => {
    const onRetry = vi.fn();
    renderPage({ blockReason: 'ip-check-unavailable', onRetry });

    expect(screen.getByText('Network error')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('reports the mapped block reason to analytics once resolved', () => {
    renderPage({ blockReason: 'wallet-blocked' });

    expect(h.trackVpnBlockedPageView).toHaveBeenCalledTimes(1);
    expect(h.trackVpnBlockedPageView).toHaveBeenCalledWith({
      blockReason: 'address_restricted',
      countryCode: 'US'
    });
  });

  it('does not report to analytics while still loading', () => {
    renderPage({ authIsLoading: true });

    expect(h.trackVpnBlockedPageView).not.toHaveBeenCalled();
  });
});
