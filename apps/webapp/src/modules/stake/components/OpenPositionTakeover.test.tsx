import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import type { SetSearchParams } from '@/lib/navigation';

i18n.load('en', {});
i18n.activate('en');

const WAD = 10n ** 18n;
const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const DELEGATE_A = '0x1111111111111111111111111111111111111111' as const;
const DELEGATE_B = '0x2222222222222222222222222222222222222222' as const;

const h = vi.hoisted(() => ({
  launchSpy: vi.fn(),
  launchParams: undefined as Record<string, unknown> | undefined,
  manageLaunchSpy: vi.fn(),
  manageLaunchParams: undefined as Record<string, unknown> | undefined,
  prepared: true,
  balance: undefined as bigint | undefined,
  // When true, the useDebounce mock lags behind: bigint values report 0n,
  // reproducing the window where typed amounts haven't settled yet.
  debounceLag: false,
  // The reopened urn's on-chain context (reopen-mode tests).
  urnDelegate: undefined as string | undefined,
  urnRewardContract: undefined as string | undefined,
  // Indexer farm outside the generated address books, and the on-chain
  // rewardsToken symbols backing the useRewardContractTokens mock.
  extraFarm: undefined as `0x${string}` | undefined,
  farmTokenSymbols: {} as Record<string, string>,
  // Simulation knobs (see the useSimulatedVault mock below).
  minCollateralForDust: 0n,
  dust: 0n,
  debtCeilingHeadroom: 0n,
  simulationError: null as Error | null,
  // Launch-engine knobs (see the useStakeLaunch/useStakeManageLaunch mocks).
  launchError: null as Error | null,
  launchLoading: false
}));

const URN_ADDRESS = '0x8888888888888888888888888888888888888888' as const;

let mockSearchParams = new URLSearchParams();
const setSearchParamsMock = vi.fn<SetSearchParams>(next => {
  mockSearchParams =
    typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
});

// The confirm grid runs its own live reads (fee estimate, delegate metadata) —
// out of scope here. Stubbed to expose the reward/delegate context this
// takeover hands it, which IS this component's job to get right.
vi.mock('./StakeConfirmGrid', () => ({
  StakeConfirmGrid: ({
    rewardFrom,
    rewardTo,
    delegateFrom,
    delegateTo
  }: {
    rewardFrom?: { address: string; symbol?: string };
    rewardTo?: { address: string; symbol?: string };
    delegateFrom?: string;
    delegateTo?: string;
  }) => (
    <div data-testid="stake-confirm-grid-stub">
      <span data-testid="stake-confirm-grid-reward">{JSON.stringify({ rewardFrom, rewardTo })}</span>
      <span data-testid="stake-confirm-grid-delegate">{JSON.stringify({ delegateFrom, delegateTo })}</span>
    </div>
  )
}));

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
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true })
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => undefined })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useDebounce: <T,>(value: T) => (h.debounceLag && typeof value === 'bigint' ? (0n as T) : value),
    useTokenBalance: () => ({
      data: h.balance !== undefined ? { value: h.balance, decimals: 18, symbol: 'SKY' } : undefined,
      isLoading: false,
      error: null,
      refetch: () => undefined
    }),
    useCollateralData: () => ({
      data: {
        // 8.51% as the WAD-scaled annual rate the real hook returns.
        stabilityFee: 851n * 10n ** 14n,
        debtCeiling: h.debtCeilingHeadroom,
        totalDaiDebt: 0n,
        debtCeilingUtilization: 0.5
      },
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    // Deterministic simulation: borrowable = 10% of collateral count (as USDS),
    // risk MEDIUM once there is debt.
    useSimulatedVault: (collateral: bigint, desiredDebt: bigint) => ({
      data: {
        collateralAmount: collateral,
        debtValue: desiredDebt,
        maxSafeBorrowableIntAmount: collateral / 10n,
        maxSafeBorrowableIntAmountNoCap: collateral / 10n,
        dust: h.dust,
        minCollateralForDust: h.minCollateralForDust,
        riskLevel: desiredDebt > 0n ? actual.RiskLevel.MEDIUM : actual.RiskLevel.LOW,
        liquidationProximityPercentage: desiredDebt > 0n ? 36 : 0,
        liquidationPrice: 432n * 10n ** 14n,
        delayedPrice: 608n * 10n ** 14n
      },
      isLoading: false,
      error: h.simulationError,
      mutate: () => undefined,
      dataSources: []
    }),
    useStakeRewardContracts: () => ({
      data: [
        { contractAddress: actual.lsSkySpkRewardAddress[1] },
        { contractAddress: actual.lsSkyUsdsRewardAddress[1] },
        { contractAddress: actual.lsSkySkyRewardAddress[1] },
        ...(h.extraFarm ? [{ contractAddress: h.extraFarm }] : [])
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined
    }),
    useRewardContractTokens: (address?: `0x${string}`) => ({
      data:
        address && h.farmTokenSymbols[address.toLowerCase()]
          ? { rewardsToken: { symbol: h.farmTokenSymbols[address.toLowerCase()] } }
          : undefined,
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useMultipleRewardsChartInfo: () => ({ data: [[]], isLoading: false, error: null }),
    useHighestRateFromChartData: () => ({ rate: '0.015' }),
    // $0.05/SKY — the est. annual rewards stat is quoted in USD.
    useSkyPrice: () => ({ data: 5n * 10n ** 16n, priceString: '0.05', isLoading: false, error: null }),
    useStakeUserDelegates: () => ({
      data: [
        { id: DELEGATE_A, ownerAddress: DELEGATE_A, totalDelegated: 3122232n * WAD, metadata: null },
        { id: DELEGATE_B, ownerAddress: DELEGATE_B, totalDelegated: 1000n * WAD, metadata: null }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    // The reopened urn's context (inert in plain-open mode).
    useStakeUrnAddress: () => ({ data: URN_ADDRESS, isLoading: false, error: null }),
    useStakeUrnSelectedRewardContract: () => ({
      data: h.urnRewardContract,
      isLoading: false,
      error: null,
      refetch: () => undefined
    }),
    useStakeUrnSelectedVoteDelegate: () => ({
      data: h.urnDelegate,
      isLoading: false,
      error: null,
      refetch: () => undefined
    })
  };
});

vi.mock('../hooks/useStakeManageLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeManageLaunch')>();
  void actual;
  return {
    useStakeManageLaunch: (params: Record<string, unknown>) => {
      h.manageLaunchParams = params;
      return {
        launch: h.manageLaunchSpy,
        execute: () => undefined,
        steps: [],
        calldata: [],
        hasDelegateChange: false,
        urnSelectedVoteDelegate: h.urnDelegate,
        shouldUseBatch: false,
        prepared: h.prepared,
        isLoading: h.launchLoading,
        error: h.launchError
      };
    }
  };
});

vi.mock('../hooks/useStakeLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeLaunch')>();
  return {
    ...actual,
    useStakeLaunch: (params: Record<string, unknown>) => {
      h.launchParams = params;
      return {
        launch: h.launchSpy,
        execute: () => undefined,
        steps: ['Stake SKY'],
        calldata: [],
        needsSkyAllowance: false,
        shouldUseBatch: false,
        prepared: h.prepared,
        isLoading: h.launchLoading,
        error: h.launchError
      };
    }
  };
});

// The takeover's own enhanced-screening hold (APP-517 via APP-550): the
// provider's injected preflight, read through the context helper.
const preflight = vi.hoisted(() => ({
  state: { kind: 'clear' } as { kind: 'clear' } | { kind: 'pending' } | { kind: 'blocked'; message: string },
  contexts: [] as Array<{ usdValue: number | undefined; actionable: boolean }>
}));
vi.mock('@/modules/ui/context/TransactionContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/TransactionContext')>();
  return {
    ...actual,
    useTransactionPreflight: (context: { usdValue: number | undefined; actionable: boolean }) => {
      preflight.contexts.push(context);
      return preflight.state;
    }
  };
});
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => null }));

import { lsSkySkyRewardAddress, lsSkySpkRewardAddress, lsSkyUsdsRewardAddress, ZERO_ADDRESS } from '@/hooks';
import { OpenPositionTakeover } from './OpenPositionTakeover';

const renderTakeover = () =>
  render(
    <I18nProvider i18n={i18n}>
      <OpenPositionTakeover />
    </I18nProvider>
  );

const typeStakeAmount = (value: string) =>
  fireEvent.change(screen.getByTestId('stake-takeover-stake-amount'), { target: { value } });

/**
 * The review body is a render function — the launch hook feeds it the engine's
 * live routing so the grid can price the network fee. Nothing here simulates,
 * so an empty routing is enough.
 */
const renderConfirmSummary = (params: Record<string, unknown> | undefined = h.launchParams) => {
  const build = params?.transactionContent as (context: {
    calls: unknown[];
    isBatch: boolean;
    legCount: number;
  }) => React.ReactNode;
  return render(<I18nProvider i18n={i18n}>{build({ calls: [], isBatch: false, legCount: 1 })}</I18nProvider>);
};

describe('OpenPositionTakeover', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=open');
    setSearchParamsMock.mockClear();
    h.launchSpy.mockClear();
    h.launchParams = undefined;
    h.manageLaunchSpy.mockClear();
    h.manageLaunchParams = undefined;
    h.urnDelegate = undefined;
    h.urnRewardContract = undefined;
    h.extraFarm = undefined;
    h.farmTokenSymbols = {};
    h.prepared = true;
    h.balance = 1000n * WAD;
    h.debounceLag = false;
    h.minCollateralForDust = 0n;
    h.dust = 30n * WAD;
    h.debtCeilingHeadroom = parseUnits('1000000000', 18);
    h.simulationError = null;
    h.launchError = null;
    h.launchLoading = false;
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('renders the four numbered cards with both optional cards off (A-Q1)', () => {
    renderTakeover();

    expect(screen.getByTestId('stake-takeover-stake-card')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-reward-card')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-borrow-card')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-delegate-card')).toBeTruthy();
    // The reward card is always-on (no toggle): the list renders expanded.
    expect(screen.getByTestId('stake-takeover-reward-list')).toBeTruthy();
    expect(screen.queryByTestId('stake-takeover-reward-card-toggle')).toBeNull();
    // Collapsed bodies: no borrow input, no delegate search.
    expect(screen.queryByTestId('stake-takeover-borrow-amount')).toBeNull();
    expect(screen.queryByTestId('stake-takeover-delegate-search')).toBeNull();
    // Nothing staked yet → Confirm disabled.
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reward picker: offers only non-deprecated farms with SKY pre-selected (APP-516)', () => {
    renderTakeover();

    // SPK is deprecated and never offered on a plain open.
    expect(
      screen.queryByTestId(`stake-takeover-reward-${lsSkySpkRewardAddress[1].toLowerCase()}`)
    ).toBeNull();
    const skyRow = screen.getByTestId(`stake-takeover-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`);
    const usdsRow = screen.getByTestId(`stake-takeover-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`);
    expect(skyRow.getAttribute('aria-pressed')).toBe('true');
    expect(usdsRow.getAttribute('aria-pressed')).toBe('false');
  });

  it('reward picker: a selection reaches the open seam and the confirm summary', () => {
    renderTakeover();
    typeStakeAmount('100');

    fireEvent.click(screen.getByTestId(`stake-takeover-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`));
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkyUsdsRewardAddress[1]);

    // Switching back re-selects SKY — plain single-select, never empty.
    fireEvent.click(screen.getByTestId(`stake-takeover-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`));
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
  });

  it('labels an out-of-address-book farm by its on-chain reward token, never SKY', () => {
    // The indexer can list a farm before the webapp ships its generated
    // addresses; the review surfaces must name its real reward token — a
    // hardcoded SKY fallback would sign the user up for a different farm than
    // the summary shows.
    const unknownFarm = '0x9999999999999999999999999999999999999999' as const;
    h.extraFarm = unknownFarm;
    h.farmTokenSymbols[unknownFarm] = 'FOO';
    renderTakeover();
    typeStakeAmount('100');

    const row = screen.getByTestId(`stake-takeover-reward-${unknownFarm}`);
    expect(row.textContent).toContain('0x9999...9999');
    fireEvent.click(row);
    expect(h.launchParams?.selectedRewardContract).toBe(unknownFarm);

    renderConfirmSummary();
    const reward = screen.getByTestId('stake-confirm-grid-reward').textContent!;
    expect(reward).toContain('FOO');
    expect(reward).not.toContain('SKY');
  });

  it('falls back to the shortened farm address while the on-chain symbol is unresolved', () => {
    const unknownFarm = '0x9999999999999999999999999999999999999999' as const;
    h.extraFarm = unknownFarm;
    renderTakeover();
    typeStakeAmount('100');

    fireEvent.click(screen.getByTestId(`stake-takeover-reward-${unknownFarm}`));
    renderConfirmSummary();
    // No symbol resolved: the grid gets the farm address and renders the
    // shortened form (see stakeModalRows.test.ts).
    const reward = JSON.parse(screen.getByTestId('stake-confirm-grid-reward').textContent!);
    expect(reward.rewardFrom).toMatchObject({ address: unknownFarm });
    expect(reward.rewardFrom.symbol).toBeUndefined();
  });

  it('enables Confirm for a valid stake amount and launches the confirm modal', () => {
    renderTakeover();

    typeStakeAmount('100');

    const confirm = screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    expect(h.launchSpy).toHaveBeenCalledTimes(1);
    expect(h.launchParams?.skyToLock).toBe(100n * WAD);
    expect(h.launchParams?.usdsToBorrow).toBe(0n);
    expect(h.launchParams?.enabled).toBe(true);
  });

  it('runs the enhanced-screening preflight itself — the takeover is the review (APP-550)', () => {
    preflight.contexts = [];
    renderTakeover();
    // Nothing staged → not actionable: a user playing with the form never
    // triggers a screening call.
    expect(preflight.contexts.at(-1)?.actionable).toBe(false);

    typeStakeAmount('100');
    expect(preflight.contexts.at(-1)?.actionable).toBe(true);
  });

  it('holds Confirm on a pending verdict and blocks it, with the reason, on a denial (APP-550)', () => {
    preflight.state = { kind: 'pending' };
    const { rerender } = renderTakeover();
    typeStakeAmount('100');
    const confirm = screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement;
    // The DS loading state disables the button while the verdict is in flight.
    expect(confirm.disabled).toBe(true);

    preflight.state = { kind: 'blocked', message: 'This wallet did not pass the additional verification.' };
    rerender(
      <I18nProvider i18n={i18n}>
        <OpenPositionTakeover />
      </I18nProvider>
    );
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('stake-takeover-preflight-blocked').textContent).toContain(
      'did not pass the additional verification'
    );
    fireEvent.click(screen.getByTestId('stake-takeover-confirm'));
    expect(h.launchSpy).not.toHaveBeenCalled();
    preflight.state = { kind: 'clear' };
  });

  it('keeps Confirm disabled while the typed amount has not debounced yet', () => {
    // The seam prepares calldata from the DEBOUNCED amounts; clicking Confirm
    // inside the debounce window would launch stale calldata (an [open]-only
    // multicall → an empty urn). The gate must wait for the amounts to settle.
    h.debounceLag = true;
    renderTakeover();

    typeStakeAmount('100');

    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('pre-selects the SKY farm as the picker default (A-Q2 resolved: APP-516)', () => {
    renderTakeover();
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
  });

  it('disables Confirm when the amount exceeds the balance and shows the error', () => {
    renderTakeover();

    typeStakeAmount('2000');

    expect(screen.getByTestId('stake-takeover-stake-amount-error').textContent).toBe('Insufficient funds');
    // The error is announced by screen readers via the aria-describedby link.
    const input = screen.getByTestId('stake-takeover-stake-amount');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('stake-takeover-stake-amount-error');
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('percent chips fill the input from the SKY balance', () => {
    renderTakeover();

    fireEvent.click(screen.getByTestId('stake-takeover-stake-amount-percent-50'));

    expect((screen.getByTestId('stake-takeover-stake-amount') as HTMLInputElement).value).toBe('500');
    expect(h.launchParams?.skyToLock).toBe(500n * WAD);
  });

  it('the stake slider tracks the typed share of the balance (1036:209724)', () => {
    renderTakeover();

    const slider = screen.getByTestId('stake-takeover-stake-slider').querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuenow')).toBe('0');

    // Balance is 1000 SKY, so a quarter of it puts the thumb at 25%.
    fireEvent.click(screen.getByTestId('stake-takeover-stake-amount-percent-25'));
    expect(slider?.getAttribute('aria-valuenow')).toBe('25');

    // Typing past the balance pins the thumb rather than running it off-track.
    typeStakeAmount('5000');
    expect(slider?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('the stake slider still reads whole percents on a dust-bearing balance', () => {
    // Staging floors, so a balance that is not a round multiple of 100 wei used
    // to read back one percent LOW (25% chip → thumb at 24) when the projection
    // floored as well. Real balances are all of this shape.
    h.balance = 1234567891234567891234n;
    renderTakeover();

    const slider = screen.getByTestId('stake-takeover-stake-slider').querySelector('[role="slider"]');

    fireEvent.click(screen.getByTestId('stake-takeover-stake-amount-percent-25'));
    expect(slider?.getAttribute('aria-valuenow')).toBe('25');
    expect(slider?.getAttribute('aria-valuetext')).toBe('25%');

    fireEvent.click(screen.getByTestId('stake-takeover-stake-amount-percent-100'));
    expect(slider?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('dragging the stake slider stages the matching share of the balance', () => {
    renderTakeover();

    const slider = screen.getByTestId('stake-takeover-stake-slider').querySelector('[role="slider"]');
    (slider as HTMLElement).focus();
    // One keyboard step off zero is 1% of the 1000 SKY balance.
    fireEvent.keyDown(slider as HTMLElement, { key: 'ArrowRight' });

    expect(slider?.getAttribute('aria-valuenow')).toBe('1');
    expect((screen.getByTestId('stake-takeover-stake-amount') as HTMLInputElement).value).toBe('10');
    expect(h.launchParams?.skyToLock).toBe(10n * WAD);
  });

  it('shows the est. annual rewards from the selected farm rate, in USD', () => {
    renderTakeover();

    typeStakeAmount('1000');
    // 1,000 SKY × 1.50% = 15 SKY-equivalent of value, at $0.05/SKY = $0.75. The
    // BA Labs rate is a VALUE APR, so the projection is never a token count.
    expect(screen.getByTestId('stake-takeover-est-rewards').textContent).toContain('$0.75');
  });

  it('borrow card: toggle expands, amount reaches the seam, risk pill and slider render', () => {
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    const borrowInput = screen.getByTestId('stake-takeover-borrow-amount');
    fireEvent.change(borrowInput, { target: { value: '50' } });

    expect(h.launchParams?.usdsToBorrow).toBe(50n * WAD);
    expect(screen.getByTestId('stake-takeover-risk-pill').textContent).toBe('Medium');
    const slider = screen.getByTestId('stake-takeover-borrow-slider');
    expect(slider).toBeTruthy();
    // The risk slider uses the design-system range treatment (H7): the
    // orange→yellow fill instead of the default brand gradient.
    const range = slider.querySelector('[data-slot=slider-range]');
    expect(range?.className).toContain('from-slider-yellow-start');
    // Card 1 now shows the min-stake-to-borrow stat.
    expect(screen.getByTestId('stake-takeover-min-stake')).toBeTruthy();
  });

  it('disabling the borrow toggle zeroes the borrow leg', () => {
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    fireEvent.change(screen.getByTestId('stake-takeover-borrow-amount'), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));

    expect(h.launchParams?.usdsToBorrow).toBe(0n);
    expect(screen.queryByTestId('stake-takeover-borrow-amount')).toBeNull();
  });

  it('min-collateral constraint: warning box shown, borrow input disabled, Confirm disabled (C.3)', () => {
    h.minCollateralForDust = 715104n * WAD;
    h.dust = 30000n * WAD;
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));

    const warning = screen.getByTestId('stake-takeover-min-collateral-warning');
    expect(warning).toBeTruthy();
    // The callout prose spells the dust floor out in full (UX 1104:19793).
    expect(warning.textContent).toContain('30,000 USDS');
    expect(warning.textContent).not.toContain('30K USDS');
    expect((screen.getByTestId('stake-takeover-borrow-amount') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('borrow: staging exactly the ceiling headroom keeps Confirm enabled (boundary)', () => {
    // Ceiling headroom (50) below the collateral max (1000/10 = 100).
    // Equality must stay valid: with the old strict < gate, Confirm went dead
    // with no error at the very max the card itself advertised.
    h.debtCeilingHeadroom = 50n * WAD;
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    fireEvent.change(screen.getByTestId('stake-takeover-borrow-amount'), { target: { value: '50' } });

    expect(h.launchParams?.usdsToBorrow).toBe(50n * WAD);
    expect(screen.queryByTestId('stake-takeover-borrow-amount-error')).toBeNull();
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('borrow: the top chip is 75% and stages three quarters of the max, whole-USDS rounded', () => {
    h.debtCeilingHeadroom = 50n * WAD;
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    expect(screen.queryByTestId('stake-takeover-borrow-amount-percent-100')).toBeNull();
    fireEvent.click(screen.getByTestId('stake-takeover-borrow-amount-percent-75'));

    expect(h.launchParams?.usdsToBorrow).toBe(37n * WAD);
  });

  it('borrow above the ceiling headroom shows the debt-ceiling error and disables Confirm', () => {
    h.debtCeilingHeadroom = 50n * WAD;
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    fireEvent.change(screen.getByTestId('stake-takeover-borrow-amount'), { target: { value: '51' } });

    expect(screen.getByTestId('stake-takeover-borrow-amount-error').textContent).toBe(
      'Requested borrow amount exceeds the debt ceiling'
    );
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('delegate card: toggle expands the list, selection is single-select and reaches the seam', () => {
    renderTakeover();
    typeStakeAmount('100');

    fireEvent.click(screen.getByTestId('stake-takeover-delegate-card-toggle'));
    const rowA = screen.getByTestId(`stake-takeover-delegate-${DELEGATE_A}`);
    fireEvent.click(rowA);

    expect(rowA.getAttribute('aria-pressed')).toBe('true');
    expect(h.launchParams?.selectedDelegate).toBe(DELEGATE_A);

    fireEvent.click(screen.getByTestId(`stake-takeover-delegate-${DELEGATE_B}`));
    expect(h.launchParams?.selectedDelegate).toBe(DELEGATE_B);
    expect(rowA.getAttribute('aria-pressed')).toBe('false');
  });

  it('closing the takeover clears the flow param', () => {
    renderTakeover();

    fireEvent.click(screen.getByTestId('stake-takeover-close'));

    expect(mockSearchParams.get('flow')).toBeNull();
  });
});

describe('OpenPositionTakeover — reopen mode (F6, UX 1194:21595 / 1194:21914)', () => {
  const renderReopen = (borrowExpanded = false) => {
    const onClose = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <OpenPositionTakeover reopen={{ urnIndex: 2, borrowExpanded, onClose }} />
      </I18nProvider>
    );
    return { onClose };
  };

  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2');
    setSearchParamsMock.mockClear();
    h.launchSpy.mockClear();
    h.launchParams = undefined;
    h.manageLaunchSpy.mockClear();
    h.manageLaunchParams = undefined;
    h.urnDelegate = DELEGATE_A;
    h.urnRewardContract = lsSkySkyRewardAddress[1];
    h.extraFarm = undefined;
    h.farmTokenSymbols = {};
    h.prepared = true;
    h.balance = 1000n * WAD;
    h.debounceLag = false;
    h.minCollateralForDust = 0n;
    h.dust = 30n * WAD;
    h.debtCeilingHeadroom = parseUnits('1000000000', 18);
    h.simulationError = null;
    h.launchError = null;
    h.launchLoading = false;
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('routes the launch through the manage seam with the urn context (C17)', () => {
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.urnIndex).toBe(2n);
    expect(h.manageLaunchParams?.urnAddress).toBe(URN_ADDRESS);
    expect(h.manageLaunchParams?.skyToLock).toBe(100n * WAD);
    expect(h.manageLaunchParams?.enabled).toBe(true);
    // The plain-open seam stays parked.
    expect(h.launchParams?.enabled).toBe(false);

    fireEvent.click(screen.getByTestId('stake-takeover-confirm'));
    expect(h.manageLaunchSpy).toHaveBeenCalledTimes(1);
    expect(h.launchSpy).not.toHaveBeenCalled();
  });

  it('passes the urn delegate through while the card is untouched (C18: never undelegate)', () => {
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.selectedDelegate).toBe(DELEGATE_A);
  });

  it('passes the RAW zero delegate through for a never-delegated urn (no spurious selectVoteDelegate)', () => {
    // The urn's on-chain read returns ZERO_ADDRESS when it never delegated. The
    // gating fallback must be that raw value — an `undefined` here would make
    // needsDelegateUpdate fire and bake selectVoteDelegate(0x0) into the reopen.
    h.urnDelegate = ZERO_ADDRESS;
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.selectedDelegate).toBe(ZERO_ADDRESS);
  });

  it('stages a different delegate once the user selects one', () => {
    renderReopen();
    typeStakeAmount('100');

    fireEvent.click(screen.getByTestId('stake-takeover-delegate-card-toggle'));
    fireEvent.click(screen.getByTestId(`stake-takeover-delegate-${DELEGATE_B.toLowerCase()}`));

    expect(h.manageLaunchParams?.selectedDelegate).toBe(DELEGATE_B);
  });

  it('passes the urn farm through while the picker is untouched (C18: no spurious selectFarm)', () => {
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
    // And the picker highlights it as the baseline.
    expect(
      screen
        .getByTestId(`stake-takeover-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`)
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('holds the picker and Confirm until the urn farm read resolves (no spurious selectFarm)', () => {
    // urnFarms answers ZERO_ADDRESS for a never-farmed urn, so `undefined`
    // means the read is pending or errored. Falling back to the SKY default
    // during that window would bake selectFarm(SKY) into the multicall of an
    // urn farming something else — and pre-highlighting SKY would invite a
    // click that pins the wrong selection past the read resolving.
    h.urnRewardContract = undefined;
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.selectedRewardContract).toBeUndefined();
    expect(h.manageLaunchParams?.enabled).toBe(false);
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen
        .getByTestId(`stake-takeover-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`)
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('falls back to the SKY default only once the read RESOLVES to zero (never-farmed urn)', () => {
    h.urnRewardContract = ZERO_ADDRESS;
    renderReopen();
    typeStakeAmount('100');

    expect(h.manageLaunchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
    expect(h.manageLaunchParams?.enabled).toBe(true);
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('stages a different farm once the user selects one (switch without unstaking)', () => {
    renderReopen();
    typeStakeAmount('100');

    fireEvent.click(screen.getByTestId(`stake-takeover-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`));
    expect(h.manageLaunchParams?.selectedRewardContract).toBe(lsSkyUsdsRewardAddress[1]);
  });

  it('keeps a deprecated current farm visible with its chip so the holder can switch away', () => {
    h.urnRewardContract = lsSkySpkRewardAddress[1];
    renderReopen();

    const spkRow = screen.getByTestId(`stake-takeover-reward-${lsSkySpkRewardAddress[1].toLowerCase()}`);
    expect(spkRow.getAttribute('aria-pressed')).toBe('true');
    expect(spkRow.textContent).toContain('Deprecated');
    // The legacy choose-another-reward warning returns with it.
    expect(screen.getByTestId('stake-takeover-reward-deprecated-warning')).toBeTruthy();
  });

  it('opens with the borrow card expanded for a borrowed-history urn (C19)', () => {
    renderReopen(true);
    expect(screen.getByTestId('stake-takeover-borrow-amount')).toBeTruthy();
  });

  it('keeps the borrow card collapsed for a staked-only history urn', () => {
    renderReopen(false);
    expect(screen.queryByTestId('stake-takeover-borrow-amount')).toBeNull();
  });

  it('draws no back chevron — × is the only way out (Design QA 2800:91832)', () => {
    const { onClose } = renderReopen();
    expect(screen.queryByTestId('stake-takeover-back')).toBeNull();
    fireEvent.click(screen.getByTestId('stake-takeover-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the manage seam disabled in plain-open mode', () => {
    render(
      <I18nProvider i18n={i18n}>
        <OpenPositionTakeover />
      </I18nProvider>
    );
    typeStakeAmount('100');
    expect(h.manageLaunchParams?.enabled).toBe(false);
    expect(h.launchParams?.enabled).toBe(true);
  });
});

describe('OpenPositionTakeover — simulation and engine errors (APP-490)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=open');
    setSearchParamsMock.mockClear();
    h.launchSpy.mockClear();
    h.launchParams = undefined;
    h.manageLaunchSpy.mockClear();
    h.manageLaunchParams = undefined;
    h.urnDelegate = undefined;
    h.urnRewardContract = undefined;
    h.prepared = true;
    h.balance = 1000n * WAD;
    h.debounceLag = false;
    h.minCollateralForDust = 0n;
    h.dust = 30n * WAD;
    h.debtCeilingHeadroom = parseUnits('1000000000', 18);
    h.simulationError = null;
    h.launchError = null;
    h.launchLoading = false;
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('shows generic copy for a simulation failure at borrow = 0 — never "Insufficient collateral"', () => {
    // A vat/spot read failure surfaces as new Error('Insufficient collateral')
    // (useSimulatedVault folds read errors into that string). With nothing
    // staged to borrow, that copy would be a lie next to an empty field.
    h.simulationError = new Error('Insufficient collateral');
    renderTakeover();
    typeStakeAmount('100');
    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));

    expect(screen.getByTestId('stake-takeover-borrow-amount-error').textContent).toBe(
      'Unable to simulate the transaction. Please try again.'
    );
    // The simulation failure still blocks Confirm.
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the simulation message verbatim once an amount is staged', () => {
    h.simulationError = new Error('Insufficient collateral');
    renderTakeover();
    typeStakeAmount('100');
    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    fireEvent.change(screen.getByTestId('stake-takeover-borrow-amount'), { target: { value: '50' } });

    expect(screen.getByTestId('stake-takeover-borrow-amount-error').textContent).toBe(
      'Insufficient collateral'
    );
  });

  it('suppresses a stale engine error while the engine is re-simulating (no prepare-failure flash)', () => {
    // After a failed tx the wagmi write/mining error persists in the
    // page-mounted engine. Editing an amount dips `prepared` false while the
    // new simulation is in flight — the stale error must not flash as a
    // prepare failure in that window.
    h.prepared = false;
    h.launchError = new Error('execution reverted');
    h.launchLoading = true;
    renderTakeover();
    typeStakeAmount('100');

    expect(screen.queryByTestId('stake-takeover-error')).toBeNull();
  });

  it('surfaces the engine error once the simulation settles unprepared', () => {
    h.prepared = false;
    h.launchError = new Error('execution reverted');
    h.launchLoading = false;
    renderTakeover();
    typeStakeAmount('100');

    expect(screen.getByTestId('stake-takeover-error').textContent).toBe(
      'Something went wrong preparing the transaction. Please try again.'
    );
  });
});
