import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import type { SuppliedPosition, SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';
import { combineWalletEarnings } from '../earnings/combineWalletEarnings';
import { notAvailable, ok, type ProtocolEarnings, type WalletEarnings } from '../earnings/types';

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

// APP-450 earnings fixture: literal per-source figures, combined via the real
// fold. Covers a savings row, a Pendle row with the realized/MTM split, and
// the always-unlisted stUSDS entry; VAULT ('vault-sky-1') stays out of scope.
const proto = (
  id: ProtocolEarnings['id'],
  rowIds: string[],
  totalEarned: ProtocolEarnings['totalEarned'],
  earnedThisMonth: ProtocolEarnings['earnedThisMonth'],
  extra: Partial<ProtocolEarnings> = {}
): ProtocolEarnings => ({
  id,
  rowIds,
  totalEarned,
  earnedThisMonth,
  isLoading: false,
  error: null,
  ...extra
});

const walletEarnings = (protocols: ProtocolEarnings[], isLoading = false): WalletEarnings => ({
  protocols,
  combined: combineWalletEarnings(protocols),
  isLoading,
  window: { startSec: 0, endSec: 0 }
});

const EARNINGS = walletEarnings([
  proto('savings', ['savings'], ok({ usd: 46.4 }), ok({ usd: 5 })),
  proto('pendle', ['fixed-0xmkt'], ok({ usd: 916.82 }), ok({ usd: 635.39 }), {
    pendleSplit: { realizedUsd: 895.05, markToMarketUsd: 916.82 }
  }),
  proto('stusds', ['stusds'], notAvailable('stusds-not-listed'), notAvailable('stusds-not-listed'))
]);

function renderSection(positions: SuppliedPosition[], earnings: WalletEarnings = EARNINGS) {
  return render(
    <I18nProvider i18n={i18n}>
      <AnalyticsFlowProvider>
        <PortfolioPositionsSection
          suppliedView={view(positions)}
          suppliedLoading={false}
          idleView={{ tokens: [] } as unknown as IdleView}
          idleSupplyInfo={new Map()}
          idleLoading={false}
          earnings={earnings}
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

  it('orders the stats My position → Rate → Accrued to date → Projected 1Y yield (at current rate)', () => {
    renderSection([VAULT]);
    const text = screen.getAllByTestId('position-card')[0].textContent ?? '';
    expect(text.indexOf('My position')).toBeLessThan(text.indexOf('Accrued to date'));
    expect(text.indexOf('Accrued to date')).toBeLessThan(
      text.indexOf('Projected 1Y yield (at current rate)')
    );
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

describe('PositionCard — Already earned (APP-450)', () => {
  afterEach(() => cleanup());

  const alreadyEarned = (card: HTMLElement) => within(card).getByTestId('position-already-earned');

  it("renders the position's total earned for an in-scope row", () => {
    renderSection([SAVINGS]);
    expect(alreadyEarned(screen.getAllByTestId('position-card')[0]).textContent).toBe('$46.40');
  });

  it('renders a dash for a row outside APP-450 scope', () => {
    renderSection([VAULT]); // 'vault-sky-1' matches no earnings source
    expect(alreadyEarned(screen.getAllByTestId('position-card')[0]).textContent).toBe('—');
  });

  it("explains the out-of-scope dash with a tooltip (review finding #2, it can't be silent)", () => {
    renderSection([VAULT]);
    const dash = within(alreadyEarned(screen.getAllByTestId('position-card')[0])).getByText('—');
    expect(dash.getAttribute('tabindex')).toBe('0');
  });

  it('renders a dash for the unlisted stUSDS row', () => {
    renderSection([position({ id: 'stusds', name: 'stUSDS' })]);
    expect(alreadyEarned(screen.getAllByTestId('position-card')[0]).textContent).toBe('—');
  });

  it('exposes the realized/mark-to-market split on the Pendle figure', () => {
    renderSection([position({ id: 'fixed-0xmkt', name: 'PT sUSDS', kind: 'fixed' })]);
    const card = screen.getAllByTestId('position-card')[0];
    expect(alreadyEarned(card).textContent).toBe('$916.82');
    expect(within(card).getByTestId('earnings-pendle-split')).toBeTruthy();
  });

  // Review finding #1: a partial per-position figure must flag its missing
  // contributor, exactly like the combined footer stat does.
  it("flags a partial 'Accrued to date' figure with the error-gap indicator", () => {
    const merklDown = walletEarnings([
      proto('morpho-vault-0xflagship', ['vault-sky-1'], ok({ usd: 20 }), ok({ usd: 10 })),
      proto('merkl', ['vault-sky-1'], notAvailable('source-error'), notAvailable('source-error'))
    ]);
    renderSection([VAULT], merklDown);
    const stat = alreadyEarned(screen.getAllByTestId('position-card')[0]);
    expect(stat.textContent).toContain('$20.00');
    expect(within(stat).getByTestId('earnings-partial')).toBeTruthy();
  });

  // Kuba 2026-08-21: non-Flagship vaults show PnL without their Merkl rewards;
  // the note is announced-class, never an error indicator.
  it("announces 'rewards not included' on a non-Flagship vault figure with the info glyph", () => {
    const withNote = walletEarnings([
      proto('morpho-vault-0xother', ['vault-sky-1'], ok({ usd: 12 }), ok({ usd: 3 }), {
        label: 'USDT Savings',
        coverage: 'rewards-not-included'
      })
    ]);
    renderSection([VAULT], withNote);
    const stat = alreadyEarned(screen.getAllByTestId('position-card')[0]);
    expect(stat.textContent).toContain('$12.00');
    expect(within(stat).getByTestId('earnings-info')).toBeTruthy();
    expect(within(stat).queryByTestId('earnings-partial')).toBeNull();
  });

  // Review finding #3: the savings balance spans chains, its earnings don't.
  it("announces the savings figure's mainnet-only coverage with the info glyph", () => {
    const withCoverage = walletEarnings([
      proto('savings', ['savings'], ok({ usd: 46.4 }), ok({ usd: 5 }), { coverage: 'mainnet-only' })
    ]);
    renderSection([SAVINGS], withCoverage);
    const stat = alreadyEarned(screen.getAllByTestId('position-card')[0]);
    expect(stat.textContent).toContain('$46.40');
    // Announced-class glyph — a coverage caveat is not an error.
    expect(within(stat).getByTestId('earnings-info')).toBeTruthy();
    expect(within(stat).queryByTestId('earnings-partial')).toBeNull();
  });

  it('keeps a complete per-position figure free of gap indicators', () => {
    renderSection([SAVINGS]);
    const stat = alreadyEarned(screen.getAllByTestId('position-card')[0]);
    expect(within(stat).queryByTestId('earnings-partial')).toBeNull();
    expect(within(stat).queryByTestId('earnings-info')).toBeNull();
  });

  it('shows a skeleton while the earnings hook loads', () => {
    const loading = walletEarnings(
      EARNINGS.protocols.map(p => ({
        ...p,
        totalEarned: notAvailable('loading'),
        earnedThisMonth: notAvailable('loading'),
        isLoading: true
      })),
      true
    );
    renderSection([SAVINGS], loading);
    const card = screen.getAllByTestId('position-card')[0];
    expect(within(card).getByTestId('earnings-stat-skeleton')).toBeTruthy();
  });
});
