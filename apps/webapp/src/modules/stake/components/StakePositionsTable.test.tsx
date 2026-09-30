import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';
import type { StakeUrnBark, StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

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
    useAccount: () => ({ isConnected: true })
  };
});

const h = vi.hoisted(() => ({
  vault: { riskLevel: 'LOW' } as Record<string, unknown> | undefined,
  vaultByIndex: undefined as Record<number, Record<string, unknown>> | undefined,
  vaultError: null as Error | null,
  claimError: null as Error | null
}));

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = table mode).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

// Per-row reads: urn address, vault risk, claimable rewards, prices — all
// mocked to fixed values so the table logic is what's under test.
vi.mock('../hooks/useStakeRowVault', () => ({
  useStakeRowVault: (position: { index: number }) => ({
    data: h.vaultError ? undefined : (h.vaultByIndex?.[position.index] ?? h.vault),
    isLoading: false,
    error: h.vaultError
  }),
  useStakeRowVaultLookup: () => ({
    vaultOf: (index: number) => (h.vaultError ? undefined : (h.vaultByIndex?.[index] ?? h.vault)),
    isLoading: false,
    error: h.vaultError
  })
}));
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnAddress: () => ({ data: '0x1111111111111111111111111111111111111111', isLoading: false }),
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0x2222222222222222222222222222222222222222' }],
      isLoading: false
    }),
    useRewardContractsToClaim: () =>
      h.claimError
        ? { data: undefined, isLoading: false, error: h.claimError }
        : {
            data: [
              {
                contractAddress: '0x2222222222222222222222222222222222222222',
                claimBalance: 128900000000000000000n, // 128.9 SKY
                rewardSymbol: 'SKY'
              }
            ],
            isLoading: false,
            error: null
          },
    usePrices: () => ({ data: { SKY: { price: '1' } }, isLoading: false, error: null })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
const openPositionMock = vi.fn();
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: () => openPositionMock
}));
// The warmer only mounts the details-modal hooks; a marker is enough to assert which urns warm.
vi.mock('./StakePositionDetailWarmer', () => ({
  StakePositionDetailWarmer: ({ urnIndex }: { urnIndex: number }) => (
    <span data-testid={`stake-detail-warmer-${urnIndex}`} />
  )
}));

import { StakePositionsTable } from './StakePositionsTable';

function bark(overrides: Partial<StakeUrnBark> = {}) {
  return {
    id: '1-ilk-1',
    ilk: '0x4c534556322d534b592d41',
    clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
    clipperId: '1',
    ink: 1n,
    art: 1n,
    due: 1n,
    blockTimestamp: 1_700_000_000,
    transactionHash: '0xf90d3823abc',
    ...overrides
  };
}

const POSITIONS: StakeUserPosition[] = [
  {
    index: 0,
    urnAddress: '0x1111111111111111111111111111111111111111',
    skyLocked: 700550n * 10n ** 18n,
    usdsDebt: 30000n * 10n ** 18n,
    barks: [],
    lastMutationTimestamp: undefined
  },
  {
    index: 1,
    urnAddress: '0x1111111111111111111111111111111111111111',
    skyLocked: 50000n * 10n ** 18n,
    usdsDebt: 0n,
    barks: [],
    lastMutationTimestamp: undefined
  },
  {
    index: 2,
    urnAddress: '0x1111111111111111111111111111111111111111',
    skyLocked: 0n,
    usdsDebt: 0n,
    barks: [],
    lastMutationTimestamp: undefined
  } // inactive (emptied) urn
];

// A drag-selection the click leaves intact: the row click stands down on it.
const withTextSelection = (run: () => void) => {
  const spy = vi
    .spyOn(window, 'getSelection')
    .mockReturnValue({ isCollapsed: false, toString: () => '20,000' } as unknown as Selection);
  try {
    run();
  } finally {
    spy.mockRestore();
  }
};

const renderTable = (
  positions: StakeUserPosition[] | undefined = POSITIONS,
  isLoading = false,
  onRemediate = vi.fn(),
  contextError: Error | null = null
) =>
  render(
    <I18nProvider i18n={i18n}>
      <StakePositionsTable
        positions={positions}
        isLoading={isLoading}
        error={null}
        contextError={contextError}
        onRemediate={onRemediate}
      />
    </I18nProvider>
  );

describe('StakePositionsTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
    h.vault = { riskLevel: 'LOW' };
    h.vaultByIndex = undefined;
    h.vaultError = null;
    h.claimError = null;
  });

  afterEach(cleanup);

  it('renders the heading, one row per position, and 1-based position labels', () => {
    renderTable();

    expect(screen.getByText('Active positions')).toBeTruthy();
    expect(screen.getByTestId('stake-positions-table')).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    // Formatted staked/borrowed amounts.
    expect(screen.getByText('700,550.00')).toBeTruthy();
    expect(screen.getAllByText('30,000.00').length).toBeGreaterThan(0);
  });

  it('hides inactive positions by default and shows them when toggled on', () => {
    renderTable();

    // #3 is the emptied urn: hidden until Show inactive is switched on.
    expect(screen.queryByText('#3')).toBeNull();

    fireEvent.click(screen.getByTestId('stake-show-inactive-toggle'));

    expect(screen.getByText('#3')).toBeTruthy();
  });

  it('stubs the manage flow on row click: flow=manage + urn_index', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('stake-position-row-0'));

    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('0');
  });

  it('renders the LTV for a debt-carrying row and dashes LTV and risk without debt', () => {
    h.vault = { riskLevel: 'LOW', debtValue: 30n * 10n ** 18n, collateralValue: 100n * 10n ** 18n };
    renderTable();

    expect(screen.getByTestId('stake-position-ltv-0').textContent).toBe('30%');
    const noDebtRow = screen.getByTestId('stake-position-row-1');
    expect(noDebtRow.querySelector('[data-testid="stake-position-ltv-none"]')).toBeTruthy();
    expect(noDebtRow.querySelector('[data-testid="stake-position-risk-none"]')).toBeTruthy();
  });

  it('opens the manage flow from the row Manage button', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('stake-position-manage-1'));

    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('1');
  });

  it('opens the manage flow from Manage while text is selected, once', () => {
    renderTable();

    withTextSelection(() => fireEvent.click(screen.getByTestId('stake-position-manage-1')));

    expect(mockSearchParams.get('urn_index')).toBe('1');
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the row itself inert while text is selected', () => {
    renderTable();

    withTextSelection(() => fireEvent.click(screen.getByTestId('stake-position-row-1')));

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('renders the dashed open-position card below the table', () => {
    openPositionMock.mockClear();
    renderTable();

    fireEvent.click(screen.getByTestId('stake-open-position-card'));

    expect(openPositionMock).toHaveBeenCalled();
  });

  it('renders the risk cell as a text pill and the LTV with its mini bar (comp 3617:24391)', () => {
    h.vault = { riskLevel: 'LOW', debtValue: 30n * 10n ** 18n, collateralValue: 100n * 10n ** 18n };
    renderTable();

    const pill = screen.getByTestId('stake-position-risk-0');
    expect(pill.textContent).toBe('Low');
    expect(pill.className).toContain('h-6');
    expect(screen.getByTestId('stake-position-ltv-bar-0').style.width).toBe('30%');
  });

  it('colours the position iconbox by liquidation risk, info for staking-only (annotation on 3617:25258)', () => {
    const border = (index: number) =>
      screen.getByTestId(`stake-position-id-${index}`).querySelector('span > span')!.className;

    for (const [riskLevel, token] of [
      ['LOW', 'border-iconboxPosition'],
      ['MEDIUM', 'border-statusWarningBorder'],
      ['HIGH', 'border-statusErrorBorder']
    ] as const) {
      h.vault = { riskLevel };
      renderTable();
      expect(border(0)).toContain(token);
      expect(border(1)).toContain('border-statusInfoBorder');
      cleanup();
    }
  });

  it('renders a dash, not an unlit meter, when the vault read fails on a debt-carrying row', () => {
    h.vaultError = new Error('rpc down');
    renderTable();

    // Only the row with subgraph debt reports the failure; the zero-debt row
    // shows the plain no-debt dash.
    expect(screen.getAllByTestId('stake-position-risk-unavailable').length).toBe(1);
  });

  it('renders the empty state when the user has no positions', () => {
    renderTable([]);

    expect(screen.getByTestId('stake-positions-empty')).toBeTruthy();
    expect(screen.getByText("You don't have any staking and borrowing position yet.")).toBeTruthy();
  });

  it('shows the liquidation badge instead of the risk meter for a liquidated position', () => {
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [bark()],
        lastMutationTimestamp: undefined
      }
    ];
    renderTable(positions);

    expect(screen.getByTestId('stake-position-liquidated-badge')).toBeTruthy();
    expect(screen.getByText('Liquidation')).toBeTruthy();
  });

  it('keeps a liquidated-but-empty urn visible while hiding a plain inactive one', () => {
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [bark()],
        lastMutationTimestamp: undefined
      }, // liquidated
      {
        index: 1,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [],
        lastMutationTimestamp: undefined
      } // plain inactive
    ];
    renderTable(positions);

    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.queryByText('#2')).toBeNull();
  });

  it('keeps an emptied urn with unknown liquidation state visible and marks its risk cell', () => {
    // Subgraph down: barks undefined. The urn may be a liquidated one, so the
    // hide-inactive filter must not hide it, and the risk cell can't claim
    // "no risk" nor "liquidated".
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: undefined,
        lastMutationTimestamp: undefined
      }
    ];
    renderTable(positions);

    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByTestId('stake-position-liquidation-unknown')).toBeTruthy();
    expect(screen.queryByTestId('stake-position-liquidated-badge')).toBeNull();
    expect(screen.queryByTestId('stake-position-liquidated-banner')).toBeNull();
  });

  it('disables the show-inactive toggle and hints when the bark context failed', () => {
    const unknownPositions = POSITIONS.map(position => ({ ...position, barks: undefined }));
    renderTable(unknownPositions, false, vi.fn(), new Error('indexer down'));

    // Every row shows, including the emptied urn.
    expect(screen.getByText('#3')).toBeTruthy();
    const toggle = screen.getByTestId('stake-show-inactive-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByTestId('stake-show-inactive-unavailable')).toBeTruthy();
  });

  it('renders the row banner directly under its matching row', () => {
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [bark()],
        lastMutationTimestamp: undefined
      }
    ];
    renderTable(positions);

    expect(screen.getByTestId('stake-position-liquidated-banner')).toBeTruthy();
  });

  it('routes the warning banner CTAs through the onRemediate table prop for the clicked position', () => {
    h.vault = {
      debtValue: 30000n * 10n ** 18n,
      liquidationProximityPercentage: 65,
      liquidationPrice: 1n * 10n ** 18n
    };
    const onRemediate = vi.fn();
    renderTable(POSITIONS, false, onRemediate);

    fireEvent.click(screen.getAllByTestId('stake-warning-stake-cta')[0]);
    expect(onRemediate).toHaveBeenCalledWith(POSITIONS[0], 'stake');

    fireEvent.click(screen.getAllByTestId('stake-warning-repay-cta')[0]);
    expect(onRemediate).toHaveBeenCalledWith(POSITIONS[0], 'repay');
  });
});

describe('StakePositionsTable — borrowed cell', () => {
  it('renders the position debt without depending on the per-row vault read', () => {
    h.vault = undefined;
    renderTable([
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 10n * 10n ** 18n,
        usdsDebt: 31000n * 10n ** 18n,
        barks: [],
        lastMutationTimestamp: 1
      }
    ]);
    expect(screen.getByTestId('stake-position-row-0').textContent).toContain('31,000');
  });
});

describe('StakePositionsTable — mobile cards (M5)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
    h.vault = { riskLevel: 'LOW' };
    h.vaultError = null;
    h.claimError = null;
  });

  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders position cards with the column data and keeps tap-to-manage', () => {
    renderTable();

    expect(screen.queryByRole('table')).toBeNull();
    // One field-label pair per visible position card.
    expect(screen.getAllByText('Staked (SKY)')).toHaveLength(2);
    expect(screen.getAllByText('Borrowed (USDS)')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('stake-position-row-0'));
    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('0');
  });

  it('opens the manage flow from View more while text is selected, once', () => {
    renderTable();

    withTextSelection(() => fireEvent.click(screen.getAllByRole('button', { name: 'View more' })[1]));

    expect(mockSearchParams.get('urn_index')).toBe('1');
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the liquidation banner under its matching card', () => {
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 0n,
        usdsDebt: 0n,
        barks: [bark()],
        lastMutationTimestamp: undefined
      }
    ];
    renderTable(positions);

    expect(screen.getByTestId('stake-position-liquidated-banner')).toBeTruthy();
  });
});

describe('StakePositionsTable — details prefetch', () => {
  afterEach(cleanup);

  const many: StakeUserPosition[] = Array.from({ length: 5 }, (_, index) => ({
    ...POSITIONS[0],
    index
  }));

  it('warms the first rows on load and no others', () => {
    renderTable(many);
    expect(screen.getByTestId('stake-detail-warmer-0')).toBeTruthy();
    expect(screen.getByTestId('stake-detail-warmer-2')).toBeTruthy();
    expect(screen.queryByTestId('stake-detail-warmer-3')).toBeNull();
    expect(screen.queryByTestId('stake-detail-warmer-4')).toBeNull();
  });

  it('warms a later row once the pointer or focus lands on it', () => {
    renderTable(many);
    fireEvent.pointerEnter(screen.getByTestId('stake-position-row-3'));
    expect(screen.getByTestId('stake-detail-warmer-3')).toBeTruthy();
    fireEvent.focus(screen.getByTestId('stake-position-row-4'));
    expect(screen.getByTestId('stake-detail-warmer-4')).toBeTruthy();
  });
});

describe('StakePositionsTable — sorting', () => {
  afterEach(cleanup);

  const rowOrder = () =>
    screen
      .getAllByTestId(/^stake-position-row-\d+$/)
      .map(row => row.getAttribute('data-testid')!.replace('stake-position-row-', ''));

  const positions: StakeUserPosition[] = [
    { ...POSITIONS[0], index: 0, skyLocked: 100n, usdsDebt: 10n },
    { ...POSITIONS[0], index: 1, skyLocked: 300n, usdsDebt: 0n },
    { ...POSITIONS[0], index: 2, skyLocked: 200n, usdsDebt: 20n }
  ];

  it('defaults to Position ID ascending, marked on its header', () => {
    renderTable([positions[2], positions[0], positions[1]]);
    expect(rowOrder()).toEqual(['0', '1', '2']);
    expect(screen.getByTestId('stake-positions-sort-position').closest('th')?.getAttribute('aria-sort')).toBe(
      'ascending'
    );
  });

  it('sorts a new column largest first and flips on a second click', () => {
    renderTable(positions);
    fireEvent.click(screen.getByTestId('stake-positions-sort-staked'));
    expect(rowOrder()).toEqual(['1', '2', '0']);
    expect(screen.getByTestId('stake-positions-sort-staked').closest('th')?.getAttribute('aria-sort')).toBe(
      'descending'
    );
    expect(screen.getByTestId('stake-positions-sort-position').closest('th')?.hasAttribute('aria-sort')).toBe(
      false
    );

    fireEvent.click(screen.getByTestId('stake-positions-sort-staked'));
    expect(rowOrder()).toEqual(['0', '2', '1']);
  });

  it('sorts risk by the vault figures, debt-free rows last', () => {
    h.vaultByIndex = {
      0: { riskLevel: 'LOW', liquidationProximityPercentage: 20 },
      2: { riskLevel: 'MEDIUM', liquidationProximityPercentage: 60 }
    };
    renderTable(positions);
    fireEvent.click(screen.getByTestId('stake-positions-sort-risk'));
    expect(rowOrder()).toEqual(['2', '0', '1']);
    fireEvent.click(screen.getByTestId('stake-positions-sort-risk'));
    expect(rowOrder()).toEqual(['0', '2', '1']);
  });
});
