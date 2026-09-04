import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

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
    useChainId: () => 1,
    useChains: () => [{ id: 1 }] as unknown as ReturnType<typeof actual.useChains>,
    useConnection: () => ({ address: h.address }) as unknown as ReturnType<typeof actual.useConnection>
  };
});

// The page reads the positions query only to pick the default tab (statistics
// for disconnected/known-empty states); the tab bodies themselves stay stubbed.
vi.mock('../hooks/useStakeUserPositions', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeUserPositions')>();
  return {
    ...actual,
    useStakeUserPositions: () => ({
      data: h.positions,
      isLoading: h.positionsLoading,
      error: null,
      mutate: vi.fn()
    })
  };
});

// The header sub-components pull in wagmi providers/contexts we don't exercise
// here; stub them so the test stays scoped to the tab/param behavior.
vi.mock('@/modules/ui/components/NetworkSelect', () => ({
  NetworkSelect: ({ chainIds }: { chainIds?: number[] }) => (
    <div data-testid="chain-modal-stub" data-chain-ids={JSON.stringify(chainIds ?? [])} />
  )
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

// The Statistics tab body is hook-driven (useQuery/wagmi reads); Radix keeps
// every panel mounted, so stub it to keep this shell test scoped to tab/param
// behavior rather than standing up query/wallet providers.
vi.mock('./StakeStatisticsTab', () => ({
  StakeStatisticsTab: () => <div data-testid="stake-statistics-tab-stub" />
}));

// Same rationale for the About tab body (corpus + engine-card reads).
vi.mock('./StakeAboutTab', () => ({
  StakeAboutTab: () => <div data-testid="stake-about-tab-stub" />
}));

const h = vi.hoisted(() => ({
  positionsTabProps: undefined as Record<string, unknown> | undefined,
  manageFlowProps: undefined as Record<string, unknown> | undefined,
  address: '0x1234567890123456789012345678901234567890' as string | undefined,
  positions: [{ index: 0 }] as unknown[] | undefined,
  positionsLoading: false
}));

// And for the My positions tab body (subgraph + per-urn reads).
vi.mock('./StakePositionsTab', () => ({
  StakePositionsTab: (props: Record<string, unknown>) => {
    h.positionsTabProps = props;
    return <div data-testid="stake-positions-tab-stub" />;
  }
}));

// The F4 takeover is fully covered by OpenPositionTakeover.test.tsx; here we
// only assert the flow=open mount contract.
vi.mock('./OpenPositionTakeover', () => ({
  OpenPositionTakeover: () => <div data-testid="stake-takeover-stub" />
}));

// Likewise the F5 manage flow (PositionManageFlow.test.tsx owns its behavior);
// `manageActionInit` stays real since it's a pure mapping this page relies on.
vi.mock('./PositionManageFlow', async importOriginal => {
  const actual = await importOriginal<typeof import('./PositionManageFlow')>();
  return {
    ...actual,
    PositionManageFlow: (props: Record<string, unknown>) => {
      h.manageFlowProps = props;
      return <div data-testid="stake-manage-flow-stub" />;
    }
  };
});

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
    h.positionsTabProps = undefined;
    h.manageFlowProps = undefined;
    h.address = '0x1234567890123456789012345678901234567890';
    h.positions = [{ index: 0 }];
    h.positionsLoading = false;
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
    expect(screen.getByTestId('stake-header-icon')).toBeTruthy();
    expect(screen.getByTestId('chain-modal-stub')).toBeTruthy();
    expect(screen.getByText('SKY Staking')).toBeTruthy();
  });

  it('defaults to the positions tab when no tab param is present', () => {
    renderPage();

    expect(activeTab()).toBe('positions');
  });

  it('defaults to the statistics tab when disconnected', () => {
    h.address = undefined;
    h.positions = undefined;
    renderPage();

    expect(activeTab()).toBe('statistics');
  });

  it('defaults to the statistics tab when the positions query settles empty', () => {
    h.positions = [];
    renderPage();

    expect(activeTab()).toBe('statistics');
  });

  it('stays on the positions tab while the positions query is still loading', () => {
    h.positions = undefined;
    h.positionsLoading = true;
    renderPage();

    expect(activeTab()).toBe('positions');
  });

  it('lets an explicit tab=positions param beat the statistics default', () => {
    h.address = undefined;
    h.positions = undefined;
    mockSearchParams = new URLSearchParams('tab=positions');
    renderPage();

    expect(activeTab()).toBe('positions');
  });

  it('pins the positions tab when clicked while active, so an empty settle cannot yank the view', () => {
    h.positions = undefined;
    h.positionsLoading = true;
    const view = renderPage();
    expect(activeTab()).toBe('positions');

    // Clicking the already-active trigger must still write the param …
    fireEvent.click(screen.getByTestId('stake-tab-positions'));
    expect(mockSearchParams.get('tab')).toBe('positions');

    // … so when the query settles empty, the pinned tab wins over the
    // statistics default.
    h.positions = [];
    h.positionsLoading = false;
    view.rerender(
      <I18nProvider i18n={i18n}>
        <StakeProductPage />
      </I18nProvider>
    );
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

  it('mounts the open-position takeover only when flow=open', () => {
    renderPage();
    expect(screen.queryByTestId('stake-takeover-stub')).toBeNull();
    cleanup();

    mockSearchParams = new URLSearchParams('flow=open');
    renderPage();
    expect(screen.getByTestId('stake-takeover-stub')).toBeTruthy();
  });

  it('mounts the manage flow only on flow=manage — never the open takeover', () => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=0');
    renderPage();

    expect(screen.queryByTestId('stake-takeover-stub')).toBeNull();
    expect(screen.getByTestId('stake-manage-flow-stub')).toBeTruthy();
    cleanup();

    mockSearchParams = new URLSearchParams('flow=open');
    renderPage();
    expect(screen.queryByTestId('stake-manage-flow-stub')).toBeNull();
  });

  it('scopes the network selector to the stake product networks', () => {
    renderPage();

    // productNetworks(STAKE_INTENT, [1]) — mainnet is the only stake network.
    const stub = screen.getByTestId('chain-modal-stub');
    expect(JSON.parse(stub.getAttribute('data-chain-ids') || '[]')).toContain(1);
  });

  it('routes a table onRemediate into a staged manage-flow deep link', () => {
    renderPage();

    const onRemediate = h.positionsTabProps?.onRemediate as (
      position: StakeUserPosition,
      action: 'stake' | 'repay'
    ) => void;
    act(() => onRemediate({ index: 3 } as StakeUserPosition, 'repay'));

    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('3');
    expect(h.manageFlowProps?.initialSheetInit).toEqual({ borrowCard: 'repay' });
  });

  it('clears the pending sheet init once the manage flow reports it consumed', () => {
    renderPage();

    const onRemediate = h.positionsTabProps?.onRemediate as (
      position: StakeUserPosition,
      action: 'stake' | 'repay'
    ) => void;
    act(() => onRemediate({ index: 1 } as StakeUserPosition, 'stake'));
    expect(h.manageFlowProps?.initialSheetInit).toEqual({ stakeCard: 'stake' });

    act(() => (h.manageFlowProps!.onInitialSheetInitConsumed as () => void)());
    expect(h.manageFlowProps?.initialSheetInit).toBeUndefined();
  });
});
