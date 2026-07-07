import { useCallback, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  getIlkName,
  lsSkySkyRewardAddress,
  TOKENS,
  useCollateralData,
  useDebounce,
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useSimulatedVault,
  useStakeRewardContracts,
  useTokenBalance
} from '@/hooks';
import { formatDecimalPercentage } from '@/utils';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky } from '@/modules/icons';
import { Button } from '@/components/ui/button';
import { TakeoverShell } from '@/components/product/TakeoverShell';
import { useStakeFlowState } from '../hooks/useStakeFlowState';
import { useStakeLaunch } from '../hooks/useStakeLaunch';
import { StakeTakeoverStakeCard } from './StakeTakeoverStakeCard';
import { StakeTakeoverBorrowCard } from './StakeTakeoverBorrowCard';
import { StakeTakeoverDelegateCard } from './StakeTakeoverDelegateCard';
import { StakeTakeoverConfirmSummary } from './StakeTakeoverConfirmSummary';

/**
 * Open-position takeover (F4, hi-fi 486:32657): a single-page stacked form —
 * three simultaneously-visible numbered cards + one Confirm — mounted on
 * `flow=open`. The legacy StakeStep wizard sequence dies with this screen.
 *
 * Container/presentational split: all data wiring (simulation, balances,
 * validity, the launch seam) lives here; the cards render props. The legacy
 * Borrow.tsx math is reproduced verbatim (max borrow from debt-ceiling
 * headroom vs collateral, dust minimum, min-collateral constraint).
 */
export function OpenPositionTakeover() {
  const chainId = useChainId();
  const { address } = useConnection();
  const [, setSearchParams] = useAppSearchParams();
  const queryClient = useQueryClient();
  const [state, dispatch] = useStakeFlowState();

  const ilkName = getIlkName(2);
  const { data: skyBalance, isLoading: balanceLoading } = useTokenBalance({
    address,
    token: TOKENS.sky.address[chainId as keyof typeof TOKENS.sky.address],
    chainId
  });

  // Debounced amounts drive simulation, approval sizing and calldata — the
  // legacy widget's exact arrangement (typing doesn't thrash the RPC reads).
  const debouncedSkyToLock = useDebounce(state.skyToLock);
  const debouncedUsdsToBorrow = useDebounce(state.usdsToBorrow);

  const {
    data: simulatedVault,
    isLoading: simulationLoading,
    error: simulationError
  } = useSimulatedVault(debouncedSkyToLock, debouncedUsdsToBorrow, 0n, ilkName);
  // Same simulation with no new debt — feeds the slider's floor math.
  const { data: vaultNoBorrow } = useSimulatedVault(debouncedSkyToLock, 0n, 0n, ilkName);
  const { data: collateralData } = useCollateralData(ilkName);

  // A-Q2 (recorded on APP-311): the baseline takeover has no reward picker; the
  // engine still requires a selectFarm call, so default to the SKY farm. The
  // reducer field stays so a picker can slot in when product rules.
  const { data: rewardContracts } = useStakeRewardContracts();
  const skyFarm = lsSkySkyRewardAddress[chainId as keyof typeof lsSkySkyRewardAddress];
  const defaultRewardContract =
    rewardContracts?.find(contract => contract.contractAddress.toLowerCase() === skyFarm?.toLowerCase())
      ?.contractAddress ?? rewardContracts?.[0]?.contractAddress;
  const selectedRewardContract = state.selectedRewardContract ?? defaultRewardContract;

  // The selected farm's live rate → card-1 stats.
  const { data: rewardsChartInfo } = useMultipleRewardsChartInfo({
    rewardContractAddresses: selectedRewardContract ? [selectedRewardContract] : []
  });
  const highestRateData = useHighestRateFromChartData(rewardsChartInfo ?? []);
  const parsedRate = highestRateData ? parseFloat(highestRateData.rate) : NaN;
  const rewardsRate = Number.isFinite(parsedRate) ? parsedRate : null;
  // Rate scaled at 1e9 so BA Labs rates (8 decimal places) survive intact —
  // 1e6 truncated e.g. 5.692243% and drifted the estimate by whole tokens.
  const estAnnualRewards =
    rewardsRate !== null && state.skyToLock > 0n
      ? (state.skyToLock * BigInt(Math.round(rewardsRate * 1_000_000_000))) / 1_000_000_000n
      : null;

  // Max borrow — legacy Borrow.tsx:359-375 verbatim: debt-ceiling headroom
  // (total debt padded 0.001% for rate drift) capped by the collateral's safe max.
  const adjustedTotalDebt =
    collateralData?.totalDaiDebt !== undefined ? (collateralData.totalDaiDebt * 100001n) / 100000n : 0n;
  const availableBorrowFromDebtCeiling =
    collateralData?.debtCeiling !== undefined && collateralData?.totalDaiDebt !== undefined
      ? collateralData.debtCeiling - adjustedTotalDebt < 0n
        ? 0n
        : collateralData.debtCeiling - adjustedTotalDebt
      : 0n;
  const availableBorrowFromCollateral = simulatedVault?.maxSafeBorrowableIntAmount ?? 0n;
  const availableBorrowBalance =
    availableBorrowFromDebtCeiling > availableBorrowFromCollateral
      ? availableBorrowFromCollateral
      : availableBorrowFromDebtCeiling;

  const minCollateralNotMet =
    simulatedVault?.collateralAmount !== undefined &&
    simulatedVault?.minCollateralForDust !== undefined &&
    simulatedVault.collateralAmount <= simulatedVault.minCollateralForDust;

  // Validity — legacy Lock.tsx / Borrow.tsx effects, computed during render.
  const hasSufficientBalance = !!skyBalance && state.skyToLock <= skyBalance.value;
  const stakeValid = state.skyToLock > 0n && hasSufficientBalance;
  const stakeError =
    address && skyBalance !== undefined && state.skyToLock > skyBalance.value && state.skyToLock !== 0n
      ? t`Insufficient funds`
      : undefined;

  const borrowValid =
    debouncedUsdsToBorrow === state.usdsToBorrow &&
    !simulationError &&
    !simulationLoading &&
    ((debouncedUsdsToBorrow > 0n && debouncedUsdsToBorrow < availableBorrowFromDebtCeiling) ||
      !debouncedUsdsToBorrow);
  const borrowError =
    debouncedUsdsToBorrow > availableBorrowFromDebtCeiling
      ? t`Requested borrow amount exceeds the debt ceiling`
      : minCollateralNotMet
        ? undefined
        : debouncedUsdsToBorrow > 0n
          ? (simulationError?.message ?? undefined)
          : undefined;

  const formValid = stakeValid && borrowValid && !(state.borrowEnabled && minCollateralNotMet);

  const close = useCallback(() => {
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const onSuccess = useCallback(() => {
    // Fresh positions/activity on return — the subgraph hooks re-query.
    queryClient.invalidateQueries({ queryKey: ['stake-user-positions'] });
    queryClient.invalidateQueries({ queryKey: ['stake-history'] });
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        params.set(QueryParams.Tab, 'positions');
        return params;
      },
      { replace: true }
    );
  }, [queryClient, setSearchParams]);

  const confirmSummary = useMemo(
    () => <StakeTakeoverConfirmSummary skyToLock={debouncedSkyToLock} usdsToBorrow={debouncedUsdsToBorrow} />,
    [debouncedSkyToLock, debouncedUsdsToBorrow]
  );

  const {
    launch,
    prepared,
    isLoading: launchLoading
  } = useStakeLaunch({
    skyToLock: debouncedSkyToLock,
    usdsToBorrow: debouncedUsdsToBorrow,
    selectedRewardContract,
    selectedDelegate: state.selectedDelegate,
    enabled: formValid,
    transactionContent: confirmSummary,
    onSuccess
  });

  const confirmDisabled = !formValid || !prepared || launchLoading;

  return (
    <TakeoverShell
      title={<Trans>Open a position</Trans>}
      badge={
        <>
          <StakeSky className="h-3.5 w-3.5" />
          <Trans>SKY Staking</Trans>
        </>
      }
      onClose={close}
      dataTestId="stake-takeover"
      footer={
        <>
          <p className="text-textSecondary max-w-xs text-sm">
            <Trans>Review the position details, and continue to confirm it in your wallet.</Trans>
          </p>
          <Button
            variant="primary"
            onClick={launch}
            disabled={confirmDisabled}
            data-testid="stake-takeover-confirm"
            className="px-10"
          >
            <Trans>Confirm</Trans>
          </Button>
        </>
      }
    >
      <StakeTakeoverStakeCard
        amount={state.skyToLock}
        onAmountChange={amount => dispatch({ type: 'setSkyToLock', amount })}
        balance={skyBalance?.value}
        balanceLoading={balanceLoading}
        rewardsRate={rewardsRate !== null ? formatDecimalPercentage(rewardsRate) : null}
        estAnnualRewards={estAnnualRewards}
        rewardSymbol="SKY"
        minStakeToBorrow={state.borrowEnabled ? simulatedVault?.minCollateralForDust : undefined}
        error={stakeError}
      />

      <StakeTakeoverBorrowCard
        enabled={state.borrowEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setBorrowEnabled', enabled })}
        usdsToBorrow={state.usdsToBorrow}
        onAmountChange={amount => dispatch({ type: 'setUsdsToBorrow', amount })}
        maxBorrowable={availableBorrowBalance}
        dust={simulatedVault?.dust}
        minCollateralNotMet={minCollateralNotMet}
        minCollateralForDust={simulatedVault?.minCollateralForDust}
        skyToLock={debouncedSkyToLock}
        simulatedVault={simulatedVault}
        vaultNoBorrow={vaultNoBorrow}
        collateralData={collateralData}
        error={borrowError}
      />

      <StakeTakeoverDelegateCard
        enabled={state.delegateEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setDelegateEnabled', enabled })}
        selectedDelegate={state.selectedDelegate}
        onSelect={delegate => dispatch({ type: 'selectDelegate', delegate })}
      />
    </TakeoverShell>
  );
}
