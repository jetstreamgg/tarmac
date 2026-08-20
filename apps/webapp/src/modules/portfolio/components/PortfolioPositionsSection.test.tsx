import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import type { SuppliedPosition, SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  openSupply: vi.fn(),
  openWithdraw: vi.fn(),
  chainId: 1,
  switchChainAsync: vi.fn(),
  setIsAutoSwitching: vi.fn(),
  setAutoSwitchIntent: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => h.navigate }));

// The mainnet auto-switch pulls navigation/network-switch contexts — out of
// scope here (covered by usePendleMaturedPositions.test).
vi.mock('@/modules/pendle/hooks/usePendleMaturedPositions', () => ({
  usePendleMaturedNetworkSwitch: () => undefined
}));

// The resolver reads the connected chain to place in-place supply and switches
// when the position lives elsewhere; keep real wagmi exports, override only
// the chain and switch hooks.
vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => h.chainId,
    useConnection: () => ({ address: undefined }),
    useChains: () => [{ id: 1 }, { id: 8453 }],
    useSwitchChain: () => ({ switchChainAsync: h.switchChainAsync })
  };
});

// The supply resolver asks whether the connected wallet is a Safe; answering
// as a plain EOA needs no wagmi provider and keeps the routing on the paths
// these specs pin.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useIsSafeWallet: () => false };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    setIsAutoSwitching: h.setIsAutoSwitching,
    setAutoSwitchIntent: h.setAutoSwitchIntent
  })
}));

// Unrestricted region: the context's provider-less default answers false for
// every module, which would resolve all in-place modals to navigation.
vi.mock('@/modules/geo-config/hooks/useGeoConfig', () => ({
  useGeoConfig: () => ({ isModuleEnabled: () => true })
}));

// The savings trigger under test — capture its opener.
vi.mock('@/modules/savings/hooks/useSavingsModal', () => ({
  useSavingsModal: () => ({ openSupply: h.openSupply, openWithdraw: h.openWithdraw })
}));
vi.mock('@/modules/stusds/hooks/useStUsdsModal', () => ({
  useStUsdsModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));
vi.mock('@/modules/morpho/hooks/useVaultModal', () => ({
  useVaultModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));
vi.mock('@/modules/pendle/hooks/usePendleModal', () => ({
  usePendleModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));
vi.mock('@/modules/rewards/hooks/useRewardsModal', () => ({
  useRewardsModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
}));

// Carousel → passthroughs so the cards render flat (no embla/DOM coupling).
vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselPrevious: () => <button type="button" />,
  CarouselNext: () => <button type="button" />
}));

// Not under test — stub to keep the import graph + render light.
vi.mock('./PortfolioTabs', () => ({ PortfolioTabs: () => <div data-testid="tabs" /> }));
vi.mock('./IdleStablecoinsTable', () => ({ IdleStablecoinsTable: () => <div /> }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const position = (over: Partial<SuppliedPosition>): SuppliedPosition => ({
  id: 'x',
  name: 'X',
  tokenSymbol: 'USDS',
  kind: 'vault',
  intent: over.kind === 'savings' ? Intent.SAVINGS_INTENT : Intent.VAULTS_INTENT,
  amountUsd: 100,
  rate: 0.05,
  rateLoading: false,
  color: '#000',
  hoverColor: '#000',
  share: 0.5,
  detailPath: '/earn/x',
  chainIds: [1],
  ...over
});

const SAVINGS = position({
  id: 'savings',
  name: 'Sky Savings Rate',
  kind: 'savings',
  detailPath: '/earn/savings'
});
const VAULT = position({ id: 'vault-sky-1', name: 'A Vault', kind: 'vault', detailPath: '/earn/vault' });

const view = (positions: SuppliedPosition[]): SuppliedView => ({
  positions,
  totalSupplied: 200,
  projected1Y: 0,
  avgRate: 0,
  ratesLoading: false,
  activePositions: positions.length,
  suppliedTokens: [],
  networksWithPositions: [1]
});

function renderSection(positions: SuppliedPosition[]) {
  return render(
    <I18nProvider i18n={i18n}>
      <AnalyticsFlowProvider>
        <PortfolioPositionsSection
          suppliedView={view(positions)}
          suppliedLoading={false}
          maturedPositions={[]}
          maturedLoading={false}
          idleView={{ tokens: [] } as unknown as IdleView}
          idleSupplyInfo={new Map()}
          idleLoading={false}
          tab="supplied"
          onTabChange={() => undefined}
        />
      </AnalyticsFlowProvider>
    </I18nProvider>
  );
}

describe('PortfolioPositionsSection — supply routing', () => {
  beforeEach(() => {
    h.navigate.mockClear();
    h.openSupply.mockClear();
    h.openWithdraw.mockClear();
    h.switchChainAsync.mockReset();
    h.switchChainAsync.mockResolvedValue(undefined);
    h.setIsAutoSwitching.mockClear();
    h.setAutoSwitchIntent.mockClear();
    h.chainId = 1;
  });
  afterEach(() => cleanup());

  it('opens the savings modal in place from the Sky Savings Rate card (no navigation)', () => {
    renderSection([SAVINGS, VAULT]);
    const savingsCard = screen.getAllByTestId('position-card')[0];

    fireEvent.click(within(savingsCard).getByTestId('position-card-supply'));

    expect(h.openSupply).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the product page for a non-savings card Supply', () => {
    renderSection([SAVINGS, VAULT]);
    const vaultCard = screen.getAllByTestId('position-card')[1];

    fireEvent.click(within(vaultCard).getByTestId('position-card-supply'));

    expect(h.openSupply).not.toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate.mock.calls[0][0].to).toBe('/earn/vault');
  });

  it('Manage always routes to the product page, even on the savings card', () => {
    renderSection([SAVINGS, VAULT]);
    const savingsCard = screen.getAllByTestId('position-card')[0];

    fireEvent.click(within(savingsCard).getByTestId('position-card-manage'));

    expect(h.openSupply).not.toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate.mock.calls[0][0].to).toBe('/earn/savings');
  });

  it('switches to the position chain, then opens the modal in place, for a wrong-chain card', async () => {
    h.chainId = 1; // wallet on mainnet
    // Savings position scoped to Base — supply belongs there, so the Supply
    // button moves the wallet first and opens the modal without navigating.
    const savingsOnBase = position({
      id: 'savings',
      name: 'Sky Savings Rate',
      kind: 'savings',
      detailPath: '/earn/savings',
      chainIds: [8453]
    });
    renderSection([savingsOnBase]);
    const savingsCard = screen.getAllByTestId('position-card')[0];

    fireEvent.click(within(savingsCard).getByTestId('position-card-supply'));

    await waitFor(() => expect(h.openSupply).toHaveBeenCalledTimes(1));
    expect(h.switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 });
    expect(h.setAutoSwitchIntent).toHaveBeenCalledWith(Intent.SAVINGS_INTENT);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('stays put (no modal, no navigation) when the wallet declines the wrong-chain switch', async () => {
    h.chainId = 1;
    h.switchChainAsync.mockRejectedValue(new Error('user rejected'));
    const savingsOnBase = position({
      id: 'savings',
      name: 'Sky Savings Rate',
      kind: 'savings',
      detailPath: '/earn/savings',
      chainIds: [8453]
    });
    renderSection([savingsOnBase]);
    const savingsCard = screen.getAllByTestId('position-card')[0];

    fireEvent.click(within(savingsCard).getByTestId('position-card-supply'));

    await waitFor(() => expect(h.setIsAutoSwitching).toHaveBeenLastCalledWith(false));
    expect(h.openSupply).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });
});

// D9 (APP-392): the PositionCard was conformed to the DS card comp (486:20195 /
// 486:20044). These lock the visible deltas — label copy, stat order, and the
// network badge — that the routing tests above don't cover.
describe('PositionCard — DS comp conformance', () => {
  afterEach(() => cleanup());

  it('labels the rate stat "Rate", not "APY"', () => {
    renderSection([VAULT]);
    const card = screen.getAllByTestId('position-card')[0];
    expect(within(card).queryByText('Rate')).not.toBeNull();
    expect(within(card).queryByText('APY')).toBeNull();
  });

  it('orders the stats My position → Rate → Already earned → 1Y projected earnings', () => {
    renderSection([VAULT]);
    const text = screen.getAllByTestId('position-card')[0].textContent ?? '';
    expect(text.indexOf('My position')).toBeLessThan(text.indexOf('Already earned'));
    expect(text.indexOf('Already earned')).toBeLessThan(text.indexOf('1Y projected earnings'));
  });

  it('shows a single-chain network badge with the chain name', () => {
    renderSection([VAULT]); // chainIds: [1]
    const card = screen.getAllByTestId('position-card')[0];
    expect(within(card).getByTestId('position-card-networks').textContent).toContain('Ethereum');
  });

  it('falls back to an "N networks" badge for a multi-chain position', () => {
    renderSection([position({ id: 'multi', name: 'Multi', chainIds: [1, 8453] })]);
    const card = screen.getAllByTestId('position-card')[0];
    expect(within(card).getByTestId('position-card-networks').textContent).toContain('2 networks');
  });
});
