import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';

i18n.load('en', {});
i18n.activate('en');

// Search-param state driven through the same mock shape VaultsWidgetPane uses:
// the page reads/writes via useAppSearchParams, so we control it directly rather
// than standing up a router.
let mockSearchParams = new URLSearchParams();
const setSearchParamsMock = vi.fn<SetSearchParams>(next => {
  mockSearchParams =
    typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChains: () => [{ id: 1 }] as unknown as ReturnType<typeof actual.useChains>
  };
});

// The header sub-components pull in wagmi providers/contexts we don't exercise
// here; stub them so the test stays scoped to the tab/param behavior.
vi.mock('@/modules/ui/components/ChainModal', () => ({
  ChainModal: ({ chainIds }: { chainIds?: number[] }) => (
    <div data-testid="chain-modal-stub" data-chain-ids={JSON.stringify(chainIds ?? [])} />
  )
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakeProductPage } from './StakeProductPage';

const renderPage = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeProductPage />
    </I18nProvider>
  );

// Radix keeps every tab panel mounted and toggles `data-state`/`hidden`, so
// "which tab is selected" is the panel whose state is active.
const activeTab = () =>
  (['positions', 'statistics', 'about'] as const).find(
    t => screen.getByTestId(`stake-tab-content-${t}`).getAttribute('data-state') === 'active'
  );

describe('StakeProductPage — shell header + URL-synced tabs', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
  });

  afterEach(cleanup);

  it('renders the page root, header, and all tab triggers and panels', () => {
    renderPage();

    expect(screen.getByTestId('stake-product-page')).toBeTruthy();
    expect(screen.getByTestId('stake-tabs')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-positions')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-statistics')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-about')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-content-positions')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-content-statistics')).toBeTruthy();
    expect(screen.getByTestId('stake-tab-content-about')).toBeTruthy();
    expect(screen.getByTestId('product-token-icon')).toBeTruthy();
    expect(screen.getByTestId('chain-modal-stub')).toBeTruthy();
    expect(screen.getByText('SKY Staking')).toBeTruthy();
  });

  it('defaults to the positions tab when no tab param is present', () => {
    renderPage();

    expect(activeTab()).toBe('positions');
  });

  it('selects the About tab when tab=about is in the URL', () => {
    mockSearchParams = new URLSearchParams('tab=about');
    renderPage();

    expect(activeTab()).toBe('about');
  });

  it('selects the Statistics tab when tab=statistics is in the URL', () => {
    mockSearchParams = new URLSearchParams('tab=statistics');
    renderPage();

    expect(activeTab()).toBe('statistics');
  });

  it('falls back to positions when the tab param is invalid', () => {
    mockSearchParams = new URLSearchParams('tab=bogus');
    renderPage();

    expect(activeTab()).toBe('positions');
  });

  it('writes the tab param with replace when a trigger is clicked', () => {
    renderPage();

    fireEvent.mouseDown(screen.getByTestId('stake-tab-statistics'));

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
    expect(setSearchParamsMock.mock.calls[0][1]).toEqual({ replace: true });
    expect(mockSearchParams.get('tab')).toBe('statistics');
  });

  it('scopes the network selector to the stake product networks', () => {
    renderPage();

    // productNetworks(STAKE_INTENT, [1]) — mainnet is the only stake network.
    const stub = screen.getByTestId('chain-modal-stub');
    expect(JSON.parse(stub.getAttribute('data-chain-ids') || '[]')).toContain(1);
  });
});
