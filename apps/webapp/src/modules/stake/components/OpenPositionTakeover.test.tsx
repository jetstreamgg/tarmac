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
  prepared: true,
  balance: undefined as bigint | undefined,
  // Simulation knobs (see the useSimulatedVault mock below).
  minCollateralForDust: 0n,
  dust: 0n,
  debtCeilingHeadroom: 0n
}));

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
    useDebounce: <T,>(value: T) => value,
    useTokenBalance: () => ({
      data: h.balance !== undefined ? { value: h.balance, decimals: 18, symbol: 'SKY' } : undefined,
      isLoading: false,
      error: null,
      refetch: () => undefined
    }),
    useCollateralData: () => ({
      data: {
        stabilityFee: 0.0851,
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
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useStakeRewardContracts: () => ({
      data: [
        { contractAddress: actual.lsSkySpkRewardAddress[1] },
        { contractAddress: actual.lsSkySkyRewardAddress[1] }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined
    }),
    useMultipleRewardsChartInfo: () => ({ data: [[]], isLoading: false, error: null }),
    useHighestRateFromChartData: () => ({ rate: '0.015' }),
    useStakeUserDelegates: () => ({
      data: [
        { id: DELEGATE_A, ownerAddress: DELEGATE_A, totalDelegated: 3122232n * WAD, metadata: null },
        { id: DELEGATE_B, ownerAddress: DELEGATE_B, totalDelegated: 1000n * WAD, metadata: null }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    })
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
        isLoading: false,
        error: null
      };
    }
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => null }));

import { lsSkySkyRewardAddress } from '@/hooks';
import { OpenPositionTakeover } from './OpenPositionTakeover';

const renderTakeover = () =>
  render(
    <I18nProvider i18n={i18n}>
      <OpenPositionTakeover />
    </I18nProvider>
  );

const typeStakeAmount = (value: string) =>
  fireEvent.change(screen.getByTestId('stake-takeover-stake-amount'), { target: { value } });

describe('OpenPositionTakeover', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=open');
    setSearchParamsMock.mockClear();
    h.launchSpy.mockClear();
    h.launchParams = undefined;
    h.prepared = true;
    h.balance = 1000n * WAD;
    h.minCollateralForDust = 0n;
    h.dust = 30n * WAD;
    h.debtCeilingHeadroom = parseUnits('1000000000', 18);
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('renders the three numbered cards with both optional cards off (A-Q1)', () => {
    renderTakeover();

    expect(screen.getByTestId('stake-takeover-stake-card')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-borrow-card')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-delegate-card')).toBeTruthy();
    // Collapsed bodies: no borrow input, no delegate search.
    expect(screen.queryByTestId('stake-takeover-borrow-amount')).toBeNull();
    expect(screen.queryByTestId('stake-takeover-delegate-search')).toBeNull();
    // Nothing staked yet → Confirm disabled.
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
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

  it('auto-defaults the reward contract to the SKY farm (A-Q2)', () => {
    renderTakeover();
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
  });

  it('disables Confirm when the amount exceeds the balance and shows the error', () => {
    renderTakeover();

    typeStakeAmount('2000');

    expect(screen.getByTestId('stake-takeover-stake-amount-error').textContent).toBe('Insufficient funds');
    expect((screen.getByTestId('stake-takeover-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('percent chips fill the input from the SKY balance', () => {
    renderTakeover();

    fireEvent.click(screen.getByTestId('stake-takeover-stake-amount-percent-50'));

    expect((screen.getByTestId('stake-takeover-stake-amount') as HTMLInputElement).value).toBe('500');
    expect(h.launchParams?.skyToLock).toBe(500n * WAD);
  });

  it('shows the est. annual rewards from the selected farm rate', () => {
    renderTakeover();

    typeStakeAmount('100');
    // 100 SKY × 1.50% = 1.5 SKY.
    expect(screen.getByTestId('stake-takeover-est-rewards').textContent).toContain('1.5');
  });

  it('borrow card: toggle expands, amount reaches the seam, risk pill and slider render', () => {
    renderTakeover();
    typeStakeAmount('1000');

    fireEvent.click(screen.getByTestId('stake-takeover-borrow-card-toggle'));
    const borrowInput = screen.getByTestId('stake-takeover-borrow-amount');
    fireEvent.change(borrowInput, { target: { value: '50' } });

    expect(h.launchParams?.usdsToBorrow).toBe(50n * WAD);
    expect(screen.getByTestId('stake-takeover-risk-pill').textContent).toBe('Medium');
    expect(screen.getByTestId('stake-takeover-borrow-slider')).toBeTruthy();
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

    expect(screen.getByTestId('stake-takeover-min-collateral-warning')).toBeTruthy();
    expect((screen.getByTestId('stake-takeover-borrow-amount') as HTMLInputElement).disabled).toBe(true);
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
