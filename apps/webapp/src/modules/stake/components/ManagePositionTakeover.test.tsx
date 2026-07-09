import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import type { SetSearchParams } from '@/lib/navigation';
import type { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';

i18n.load('en', {});
i18n.activate('en');

const WAD = 10n ** 18n;
const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const URN_ADDRESS = '0x8888888888888888888888888888888888888888' as const;
const CURRENT_DELEGATE = '0x5555555555555555555555555555555555555555' as const;
const OTHER_DELEGATE = '0x4444444444444444444444444444444444444444' as const;

const h = vi.hoisted(() => ({
  launchSpy: vi.fn(),
  launchParams: undefined as Record<string, unknown> | undefined,
  prepared: true,
  // When true, the useDebounce mock lags behind: bigint values report 0n,
  // reproducing the window where typed amounts haven't settled yet.
  debounceLag: false,
  skyBalance: 0n,
  usdsBalance: 0n,
  existingCollateral: 0n,
  existingDebt: 0n,
  dust: 0n,
  voteDelegate: undefined as `0x${string}` | undefined,
  // Simulation knobs.
  simLiqPrice: 432n * 10n ** 14n,
  simDelayedPrice: 608n * 10n ** 14n,
  simProximity: 36,
  minCollateralForDust: 0n,
  debtCeiling: 0n
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
    useDebounce: <T,>(value: T) => (h.debounceLag && typeof value === 'bigint' ? (0n as T) : value),
    useTokenBalance: ({ token }: { token: `0x${string}` }) => ({
      data: {
        value:
          token?.toLowerCase() === actual.TOKENS.sky.address[1].toLowerCase() ? h.skyBalance : h.usdsBalance,
        decimals: 18,
        symbol: 'X'
      },
      isLoading: false,
      error: null,
      refetch: () => undefined
    }),
    useCollateralData: () => ({
      data: {
        stabilityFee: 0.0851,
        debtCeiling: h.debtCeiling,
        totalDaiDebt: 0n,
        debtCeilingUtilization: 0.5
      },
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    // Deterministic simulation: borrowable = 10% of collateral, risk from debt.
    useSimulatedVault: (collateral: bigint, desiredDebt: bigint) => ({
      data: {
        collateralAmount: collateral,
        debtValue: desiredDebt,
        maxSafeBorrowableIntAmount: collateral / 10n,
        maxSafeBorrowableIntAmountNoCap: collateral / 10n,
        dust: h.dust,
        minCollateralForDust: h.minCollateralForDust,
        riskLevel: desiredDebt > 0n ? actual.RiskLevel.MEDIUM : actual.RiskLevel.LOW,
        liquidationProximityPercentage: desiredDebt > 0n ? h.simProximity : 0,
        liquidationPrice: h.simLiqPrice,
        delayedPrice: h.simDelayedPrice
      },
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useStakeUserDelegates: () => ({
      data: [
        { id: CURRENT_DELEGATE, ownerAddress: CURRENT_DELEGATE, totalDelegated: 5000n * WAD, metadata: null },
        { id: OTHER_DELEGATE, ownerAddress: OTHER_DELEGATE, totalDelegated: 1000n * WAD, metadata: null }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    })
  };
});

vi.mock('../hooks/useStakePositionDetail', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakePositionDetail')>();
  void actual;
  return {
    useStakePositionDetail: () => ({
      urnAddress: URN_ADDRESS,
      vault: {
        collateralType: 'LSEV2-SKY-A',
        collateralAmount: h.existingCollateral,
        debtValue: h.existingDebt,
        dust: h.dust,
        riskLevel: h.existingDebt > 0n ? 'MEDIUM' : 'LOW',
        liquidationProximityPercentage: h.existingDebt > 0n ? 30 : 0,
        liquidationPrice: h.simLiqPrice,
        delayedPrice: h.simDelayedPrice
      },
      vaultLoading: false,
      hasDebt: h.existingDebt > 0n,
      rewardContract: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc',
      rewardSymbol: 'SKY',
      voteDelegate: h.voteDelegate,
      rewardsRate: 0.015,
      estAnnualRewardsSky: (h.existingCollateral * 15n) / 1000n,
      claimableUsd: 0,
      claimableSymbols: ['SKY'],
      claimableTokenAmount: 0n,
      claimableLoading: false,
      rewardsEarnedUsd: 12.5,
      stabilityFee: 0.0851,
      skyPriceUsd: 0.05,
      stakedUsd: 100,
      borrowedUsd: Number(h.existingDebt / WAD)
    })
  };
});

vi.mock('../hooks/useStakeManageLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeManageLaunch')>();
  return {
    ...actual,
    useStakeManageLaunch: (params: Record<string, unknown>) => {
      h.launchParams = params;
      return {
        launch: h.launchSpy,
        execute: () => undefined,
        steps: [],
        calldata: [],
        hasDelegateChange: false,
        urnSelectedVoteDelegate: h.voteDelegate,
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

import { ManagePositionTakeover } from './ManagePositionTakeover';

const renderSheet = (init: StakeManageFlowInit = {}) => {
  const onBack = vi.fn();
  const onClose = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <ManagePositionTakeover urnIndex={0} init={init} onBack={onBack} onClose={onClose} />
    </I18nProvider>
  );
  return { onBack, onClose };
};

const confirmButton = () => screen.getByTestId('stake-manage-confirm') as HTMLButtonElement;

describe('ManagePositionTakeover', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=0');
    setSearchParamsMock.mockClear();
    h.launchSpy.mockClear();
    h.launchParams = undefined;
    h.prepared = true;
    h.debounceLag = false;
    h.skyBalance = 1_000_000n * WAD;
    h.usdsBalance = 100_000n * WAD;
    h.existingCollateral = 3_000_000n * WAD;
    h.existingDebt = 30_000n * WAD;
    h.dust = 30_000n * WAD;
    h.voteDelegate = CURRENT_DELEGATE;
    h.simLiqPrice = 432n * 10n ** 14n;
    h.simDelayedPrice = 608n * 10n ** 14n;
    h.simProximity = 36;
    h.minCollateralForDust = 1_440_000n * WAD;
    h.debtCeiling = parseUnits('1000000000', 18);
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('renders summary strip + three cards, all off by default, Confirm disabled', () => {
    renderSheet();

    expect(screen.getByTestId('stake-manage-position-summary')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-stake-card')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-borrow-card')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-delegate-card')).toBeTruthy();
    expect(screen.queryByTestId('stake-manage-stake-amount')).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it('pre-toggles cards per the deep-link init', () => {
    renderSheet({ stakeCard: 'withdraw', borrowCard: 'repay' });

    expect(screen.getByTestId('stake-manage-stake-amount')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-stake-card-mode-withdraw').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByTestId('stake-manage-borrow-card-mode-repay').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('keeps Confirm disabled while the typed amount has not debounced yet', () => {
    // The seam prepares calldata from the DEBOUNCED amounts; clicking Confirm
    // inside the debounce window would launch stale calldata. The gate must
    // wait for the amounts to settle.
    h.debounceLag = true;
    renderSheet({ stakeCard: 'stake' });

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '1000' } });

    expect(confirmButton().disabled).toBe(true);
  });

  it('stake mode stages skyToLock; withdraw mode stages skyToFree', () => {
    renderSheet({ stakeCard: 'stake' });

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '1000' } });
    expect(h.launchParams?.skyToLock).toBe(1000n * WAD);
    expect(h.launchParams?.skyToFree).toBe(0n);
    expect(confirmButton().disabled).toBe(false);

    fireEvent.click(screen.getByTestId('stake-manage-stake-card-mode-withdraw'));
    // Mode switch clears the amount (M21).
    expect(h.launchParams?.skyToLock).toBe(0n);
    expect(h.launchParams?.skyToFree).toBe(0n);

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '500' } });
    expect(h.launchParams?.skyToFree).toBe(500n * WAD);
    expect(h.launchParams?.skyToLock).toBe(0n);
  });

  it('flags a withdraw above the staked amount', () => {
    renderSheet({ stakeCard: 'withdraw' });

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '4000000' } });
    expect(screen.getByTestId('stake-manage-stake-amount-error').textContent).toBe('Insufficient funds');
    expect(confirmButton().disabled).toBe(true);
  });

  it('flags the capped-OSM withdraw (liquidation price above the delayed price)', () => {
    h.simLiqPrice = 700n * 10n ** 14n; // above delayedPrice 608
    renderSheet({ stakeCard: 'withdraw' });

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '1000000' } });
    expect(screen.getByTestId('stake-manage-stake-amount-error').textContent).toBe(
      'Liquidation price is higher than the capped OSM SKY price'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('prefers the capped-OSM message when the F8 proximity short-circuit also maxes the risk error', () => {
    // Real hook behavior once liq price ≥ delayed price: proximity reports
    // 100, so BOTH error conditions hold — the specific copy must win.
    h.simLiqPrice = 700n * 10n ** 14n;
    h.simProximity = 100;
    renderSheet({ stakeCard: 'withdraw' });

    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '1000000' } });
    expect(screen.getByTestId('stake-manage-stake-amount-error').textContent).toBe(
      'Liquidation price is higher than the capped OSM SKY price'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('repay: the 100% chip stages wipeAll when the balance covers the debt (M11)', () => {
    renderSheet({ borrowCard: 'repay' });

    fireEvent.click(screen.getByTestId('stake-manage-borrow-amount-percent-100'));
    expect(h.launchParams?.usdsToWipe).toBe(30_000n * WAD);
    expect(h.launchParams?.wipeAll).toBe(true);

    // Typing afterwards clears wipeAll (legacy Repay onChange).
    fireEvent.change(screen.getByTestId('stake-manage-borrow-amount'), { target: { value: '10000' } });
    expect(h.launchParams?.wipeAll).toBe(false);
  });

  it('repay: a full-left slider drag stages wipeAll like the 100% chip (M11)', () => {
    renderSheet({ borrowCard: 'repay' });

    // Radix slider: Home jumps to the minimum → stages the exact full debt.
    // Without wipeAll this would launch a plain wipe that strands sub-dust
    // accrued interest (vat dust revert).
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' });

    expect(h.launchParams?.usdsToWipe).toBe(30_000n * WAD);
    expect(h.launchParams?.wipeAll).toBe(true);
  });

  it('repay: sub-dust remainder is rejected with the legacy message', () => {
    renderSheet({ borrowCard: 'repay' });

    // 30k debt − 15k repay = 15k < 30k dust → minDebtNotMet.
    fireEvent.change(screen.getByTestId('stake-manage-borrow-amount'), { target: { value: '15000' } });
    expect(screen.getByTestId('stake-manage-borrow-amount-error').textContent).toContain(
      'Debt must be paid off entirely'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('full repay renders the No-position delta row (M13)', () => {
    renderSheet({ borrowCard: 'repay' });

    fireEvent.click(screen.getByTestId('stake-manage-borrow-amount-percent-100'));
    expect(screen.getByTestId('stake-manage-risk-row').textContent).toContain('No position');
    expect(screen.getByTestId('stake-manage-borrow-rate-row').textContent).toContain('0.00%');
  });

  it('repay on a debt-free urn: input disabled, zero max (unstake-repay No-Debt port)', () => {
    // Port of unstake-repay.spec.ts "No Debt UI": after a full repay the repay
    // surface must refuse input rather than stage an impossible wipe.
    h.existingDebt = 0n;
    renderSheet({ borrowCard: 'repay' });

    expect((screen.getByTestId('stake-manage-borrow-amount') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('stake-manage-borrow-amount').closest('section')?.textContent).toContain(
      'max. 0'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('borrow: amount reaches the seam and the borrowed line shows the delta', () => {
    renderSheet({ borrowCard: 'borrow' });

    fireEvent.change(screen.getByTestId('stake-manage-borrow-amount'), { target: { value: '10000' } });
    expect(h.launchParams?.usdsToBorrow).toBe(10_000n * WAD);
    expect(screen.getByTestId('stake-manage-borrowed-line').textContent).toContain('→');
  });

  it('borrow: the 100% chip at a binding debt ceiling keeps Confirm enabled (boundary)', () => {
    // Ceiling headroom (40k) below the collateral max (3M/10 = 300k) → the
    // 100% chip stages exactly the headroom. Equality must stay valid: with
    // the old strict < gate, Confirm went dead with no error at the very max
    // the card itself advertised.
    h.debtCeiling = 40_000n * WAD;
    renderSheet({ borrowCard: 'borrow' });

    fireEvent.click(screen.getByTestId('stake-manage-borrow-amount-percent-100'));

    expect(h.launchParams?.usdsToBorrow).toBe(40_000n * WAD);
    expect(screen.queryByTestId('stake-manage-borrow-amount-error')).toBeNull();
    expect(confirmButton().disabled).toBe(false);
  });

  it('borrow: above the ceiling headroom shows the debt-ceiling error and disables Confirm', () => {
    h.debtCeiling = 40_000n * WAD;
    renderSheet({ borrowCard: 'borrow' });

    fireEvent.change(screen.getByTestId('stake-manage-borrow-amount'), { target: { value: '40001' } });

    expect(screen.getByTestId('stake-manage-borrow-amount-error').textContent).toBe(
      'Requested borrow amount exceeds the debt ceiling'
    );
    expect(confirmButton().disabled).toBe(true);
  });

  it('delegate: picking a different delegate stages the change and enables Confirm', () => {
    renderSheet({ delegateCard: true });
    expect(confirmButton().disabled).toBe(true);

    // The current delegate renders pre-selected.
    expect(
      screen
        .getByTestId(`stake-manage-delegate-${CURRENT_DELEGATE.toLowerCase()}`)
        .getAttribute('aria-pressed')
    ).toBe('true');

    fireEvent.click(screen.getByTestId(`stake-manage-delegate-${OTHER_DELEGATE.toLowerCase()}`));
    expect(h.launchParams?.selectedDelegate).toBe(OTHER_DELEGATE);
    expect(confirmButton().disabled).toBe(false);
  });

  it('delegate: re-selecting the current delegate stages no change', () => {
    renderSheet({ delegateCard: true });

    fireEvent.click(screen.getByTestId(`stake-manage-delegate-${CURRENT_DELEGATE.toLowerCase()}`));
    // Click-again-to-deselect on the pre-selected row → staged selection gone,
    // effective delegate back to current → no change staged.
    expect(h.launchParams?.selectedDelegate).toBe(CURRENT_DELEGATE);
    expect(confirmButton().disabled).toBe(true);
  });

  it('back and close route through the controller callbacks', () => {
    const { onBack, onClose } = renderSheet();

    fireEvent.click(screen.getByTestId('stake-manage-takeover-back'));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('stake-manage-takeover-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('launches the confirm modal from the footer', () => {
    renderSheet({ stakeCard: 'stake' });
    fireEvent.change(screen.getByTestId('stake-manage-stake-amount'), { target: { value: '1000' } });
    fireEvent.click(confirmButton());
    expect(h.launchSpy).toHaveBeenCalledTimes(1);
  });
});
