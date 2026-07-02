import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPositionsSection } from './PortfolioPositionsSection';
import type { SuppliedPosition, SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ navigate: vi.fn(), openSupply: vi.fn(), openWithdraw: vi.fn(), chainId: 1 }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => h.navigate }));

// The resolver reads the connected chain to gate in-place supply; keep real wagmi
// exports, override only useChainId.
vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => h.chainId };
});

// The savings trigger under test — capture its opener.
vi.mock('@/modules/savings/hooks/useSavingsModal', () => ({
  useSavingsModal: () => ({ openSupply: h.openSupply, openWithdraw: h.openWithdraw })
}));
vi.mock('@/modules/morpho/hooks/useVaultModal', () => ({
  useVaultModal: () => ({ openSupply: vi.fn(), openWithdraw: vi.fn() })
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
  amountUsd: 100,
  rate: 0.05,
  color: '#000',
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
  activePositions: positions.length,
  suppliedTokens: [],
  networksWithPositions: [1]
});

function renderSection(positions: SuppliedPosition[]) {
  return render(
    <I18nProvider i18n={i18n}>
      <PortfolioPositionsSection
        suppliedView={view(positions)}
        suppliedLoading={false}
        idleView={{ tokens: [] } as unknown as IdleView}
        idleSupplyInfo={new Map()}
        idleLoading={false}
        tab="supplied"
        onTabChange={() => undefined}
      />
    </I18nProvider>
  );
}

describe('PortfolioPositionsSection — supply routing', () => {
  beforeEach(() => {
    h.navigate.mockClear();
    h.openSupply.mockClear();
    h.openWithdraw.mockClear();
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

  it('navigates (does not open the modal) when the savings card is on a non-connected chain', () => {
    h.chainId = 1; // wallet on mainnet
    // Savings position scoped to Base — the in-place modal would supply on mainnet.
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

    expect(h.openSupply).not.toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate.mock.calls[0][0].to).toBe('/earn/savings');
  });
});
