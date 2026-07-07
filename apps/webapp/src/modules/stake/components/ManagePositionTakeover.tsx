import { useCallback, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ArrowUpRight, Info } from 'lucide-react';
import {
  getIlkName,
  RISK_LEVEL_THRESHOLDS,
  RiskLevel,
  TOKENS,
  useCollateralData,
  useDebounce,
  useSimulatedVault,
  useTokenBalance,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt, formatUsd, WAD_PRECISION } from '@/utils';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky } from '@/modules/icons';
import { Button } from '@/components/ui/button';
import { TakeoverShell } from '@/components/product/TakeoverShell';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { calculateMaxRepayable } from '../lib/manageRepay';
import { StakeManageFlowInit, useStakeManageFlowState } from '../hooks/useStakeManageFlowState';
import { useStakePositionDetail } from '../hooks/useStakePositionDetail';
import { useStakeManageLaunch } from '../hooks/useStakeManageLaunch';
import { StakeManageStakeCard } from './StakeManageStakeCard';
import { StakeManageBorrowCard, RiskValue } from './StakeManageBorrowCard';
import { StakeManageDelegateCard } from './StakeManageDelegateCard';
import { StakeManageConfirmSummary } from './StakeManageConfirmSummary';

const NO_VALUE = '–';

/**
 * "Manage a position" full-page sheet (F5, UX 1050:21454+): a position-summary
 * strip and three independently-toggleable cards over one Confirm. All data
 * wiring lives here; the cards render props. Simulation composes the legacy
 * Free/Repay math verbatim (M9): collateral = existing + lock − free, debt =
 * existing + borrow − wipe, both floored at zero, simulated against the
 * existing debt. One launch stages the combined actions through the F1 manage
 * calldata (legacy MANAGE multicall semantics).
 */
export function ManagePositionTakeover({
  urnIndex,
  init,
  onBack,
  onClose
}: {
  urnIndex: number;
  init: StakeManageFlowInit;
  onBack: () => void;
  onClose: () => void;
}) {
  const chainId = useChainId();
  const { address } = useConnection();
  const [, setSearchParams] = useAppSearchParams();
  const queryClient = useQueryClient();
  const ilkName = getIlkName(2);

  const detail = useStakePositionDetail(urnIndex);
  const existingVault = detail.vault;
  const existingDebt = existingVault?.debtValue ?? 0n;
  const existingCollateral = existingVault?.collateralAmount ?? 0n;

  const [state, dispatch] = useStakeManageFlowState(init);

  // Amounts routed through each card's mode; the reducer clears amounts on
  // toggle-off and mode switches, so these stay consistent by construction.
  const debouncedSkyAmount = useDebounce(state.skyAmount);
  const debouncedUsdsAmount = useDebounce(state.usdsAmount);
  const skyToLock = state.stakeEnabled && state.stakeMode === 'stake' ? debouncedSkyAmount : 0n;
  const skyToFree = state.stakeEnabled && state.stakeMode === 'withdraw' ? debouncedSkyAmount : 0n;
  const usdsToBorrow = state.borrowEnabled && state.borrowMode === 'borrow' ? debouncedUsdsAmount : 0n;
  const usdsToWipe = state.borrowEnabled && state.borrowMode === 'repay' ? debouncedUsdsAmount : 0n;
  const wipeAll = state.borrowEnabled && state.borrowMode === 'repay' && state.wipeAll;

  // Legacy Free.tsx/Repay.tsx simulation inputs, composed (M9).
  const newCollateralAmount = existingCollateral + skyToLock - skyToFree;
  const newDebtValue = existingDebt + usdsToBorrow - usdsToWipe;
  const {
    data: simulatedVault,
    isLoading: simulationLoading,
    error: simulationError
  } = useSimulatedVault(
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingDebt,
    ilkName
  );
  // Slider floor/ceiling baseline: same collateral, unchanged debt.
  const { data: vaultNoBorrow } = useSimulatedVault(
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    existingDebt,
    existingDebt,
    ilkName
  );
  const { data: collateralData } = useCollateralData(ilkName);

  const { data: skyBalance, isLoading: skyBalanceLoading } = useTokenBalance({
    address,
    token: TOKENS.sky.address[chainId as keyof typeof TOKENS.sky.address],
    chainId
  });
  const { data: usdsBalance } = useTokenBalance({
    address,
    token: TOKENS.usds.address[chainId as keyof typeof TOKENS.usds.address],
    chainId
  });

  // ---- Card 1 validation ----------------------------------------------------
  const liquidationThreshold = RISK_LEVEL_THRESHOLDS.find(
    risk => risk.level === RiskLevel.LIQUIDATION
  )?.threshold;
  // Legacy Free.tsx:51-77 verbatim (M10).
  const isLiquidationError = !!(
    skyToFree &&
    skyToFree > 0n &&
    simulatedVault?.liquidationProximityPercentage &&
    liquidationThreshold &&
    simulatedVault.liquidationProximityPercentage > liquidationThreshold
  );
  const isCappedOsmError = !!(
    skyToFree &&
    skyToFree > 0n &&
    !!simulatedVault?.delayedPrice &&
    !!simulatedVault?.liquidationPrice &&
    simulatedVault.liquidationPrice > simulatedVault.delayedPrice
  );
  const stakeError =
    state.stakeMode === 'stake'
      ? skyBalance !== undefined && state.skyAmount > skyBalance.value && state.skyAmount !== 0n
        ? t`Insufficient funds`
        : undefined
      : state.skyAmount > existingCollateral && state.skyAmount !== 0n
        ? t`Insufficient funds`
        : isLiquidationError
          ? t`Liquidation risk too high`
          : isCappedOsmError
            ? t`Liquidation price is higher than the capped OSM SKY price`
            : undefined;
  const stakeCardValid = !state.stakeEnabled || state.skyAmount === 0n || !stakeError;

  // ---- Card 2 validation ----------------------------------------------------
  // Max borrow — legacy Borrow.tsx:359-375 verbatim (F4 parity).
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
    state.borrowMode === 'borrow' &&
    simulatedVault?.collateralAmount !== undefined &&
    simulatedVault?.minCollateralForDust !== undefined &&
    simulatedVault.collateralAmount <= simulatedVault.minCollateralForDust;

  const maxRepayable = calculateMaxRepayable({
    debtValue: existingDebt,
    dust: existingVault?.dust,
    balance: usdsBalance?.value
  });

  // Legacy Repay.tsx error ladder (M11).
  const minDebtNotMet = newDebtValue > 0n && newDebtValue < (existingVault?.dust ?? 0n) && usdsToWipe > 0n;
  const hasEnoughUsds =
    !!usdsBalance?.value && usdsBalance.value > 0n && usdsBalance.value >= debouncedUsdsAmount;

  const borrowError =
    state.borrowMode === 'borrow'
      ? usdsToBorrow > availableBorrowFromDebtCeiling
        ? t`Requested borrow amount exceeds the debt ceiling`
        : minCollateralNotMet
          ? undefined
          : usdsToBorrow > 0n
            ? (simulationError?.message ?? undefined)
            : undefined
      : minDebtNotMet
        ? t`Debt must be paid off entirely, or left with a minimum of ${formatBigInt(existingVault?.dust ?? 0n)}`
        : !hasEnoughUsds && usdsToWipe > 0n
          ? t`Not enough USDS in your wallet`
          : newDebtValue < 0n
            ? t`Amount exceeds debt`
            : usdsToWipe > 0n
              ? (simulationError?.message ?? undefined)
              : undefined;

  const borrowCardValid =
    !state.borrowEnabled ||
    (state.borrowMode === 'borrow'
      ? !minCollateralNotMet &&
        ((usdsToBorrow > 0n && usdsToBorrow < availableBorrowFromDebtCeiling) || !usdsToBorrow) &&
        !simulationError &&
        !simulationLoading
      : (state.usdsAmount === 0n && !state.wipeAll) ||
        (!borrowError && !simulationError && !simulationLoading));

  // ---- Delegate change ------------------------------------------------------
  const currentDelegate =
    detail.voteDelegate && detail.voteDelegate !== ZERO_ADDRESS ? detail.voteDelegate : undefined;
  const delegateChanged =
    state.delegateEnabled &&
    !!state.selectedDelegate &&
    state.selectedDelegate.toLowerCase() !== detail.voteDelegate?.toLowerCase();
  // Effective delegate (M12): staged change, else the urn's current one so the
  // calldata gating sees "no change".
  const effectiveDelegate = delegateChanged ? state.selectedDelegate : detail.voteDelegate;

  // ---- Confirm gating (M20) -------------------------------------------------
  const debounceSettled = debouncedSkyAmount === state.skyAmount && debouncedUsdsAmount === state.usdsAmount;
  const hasChange =
    skyToLock > 0n || skyToFree > 0n || usdsToBorrow > 0n || usdsToWipe > 0n || wipeAll || delegateChanged;
  const formValid = hasChange && debounceSettled && stakeCardValid && borrowCardValid;

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const onSuccess = useCallback(() => {
    // Fresh positions/activity AND fresh on-chain reads (vault, balances,
    // allowances) on return — manage txs change what every read hook reports.
    queryClient.invalidateQueries({ queryKey: ['stake-user-positions'] });
    queryClient.invalidateQueries({ queryKey: ['stake-history'] });
    queryClient.invalidateQueries({ queryKey: ['readContract'] });
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        params.delete(QueryParams.UrnIndex);
        params.delete(QueryParams.StakeTab);
        params.set(QueryParams.Tab, 'positions');
        return params;
      },
      { replace: true }
    );
  }, [queryClient, setSearchParams]);

  const confirmSummary = useMemo(
    () => (
      <StakeManageConfirmSummary
        skyToLock={skyToLock}
        skyToFree={skyToFree}
        usdsToBorrow={usdsToBorrow}
        usdsToWipe={usdsToWipe}
        skyPriceUsd={detail.skyPriceUsd}
        delegateFrom={currentDelegate}
        delegateTo={delegateChanged ? state.selectedDelegate : undefined}
      />
    ),
    [
      skyToLock,
      skyToFree,
      usdsToBorrow,
      usdsToWipe,
      detail.skyPriceUsd,
      currentDelegate,
      delegateChanged,
      state.selectedDelegate
    ]
  );

  const {
    launch,
    prepared,
    isLoading: launchLoading
  } = useStakeManageLaunch({
    urnIndex: BigInt(urnIndex),
    urnAddress: detail.urnAddress,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    wipeAll,
    selectedDelegate: effectiveDelegate,
    enabled: formValid,
    transactionContent: confirmSummary,
    onSuccess
  });

  const confirmDisabled = !formValid || !prepared || launchLoading;

  // Est. annual rewards delta for card 1 (M22): rate × simulated collateral.
  const estNextSky =
    detail.rewardsRate !== null && state.stakeEnabled && state.skyAmount > 0n
      ? ((newCollateralAmount > 0n ? newCollateralAmount : 0n) *
          BigInt(Math.round(detail.rewardsRate * 1_000_000_000))) /
        1_000_000_000n
      : null;

  return (
    <TakeoverShell
      title={<Trans>Manage a position</Trans>}
      badge={
        <>
          <StakeSky className="h-3.5 w-3.5" />
          <Trans>SKY Staking</Trans>
        </>
      }
      onBack={onBack}
      onClose={close}
      dataTestId="stake-manage-takeover"
      footer={
        <>
          <p className="text-textSecondary max-w-xs text-sm">
            <Trans>Review the changes to your position, and continue to confirm it in your wallet.</Trans>
          </p>
          <Button
            variant="primary"
            onClick={launch}
            disabled={confirmDisabled}
            data-testid="stake-manage-confirm"
            className="px-10"
          >
            <Trans>Confirm</Trans>
          </Button>
        </>
      }
    >
      {/* Position summary strip (UX 1050:21454) */}
      <section
        data-testid="stake-manage-position-summary"
        className="flex flex-col gap-5 px-2"
        aria-label="Position summary"
      >
        <h3 className="text-text text-lg font-medium">
          <Trans>Position summary</Trans>
        </h3>
        <div className="flex flex-wrap items-start gap-10">
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-sm">
              <Trans>Staked amount</Trans>
            </span>
            <span className="text-text flex items-center gap-2 text-3xl font-medium tracking-tight">
              <TokenIcon token={{ symbol: 'SKY' }} width={28} className="h-7 w-7" showChainIcon={false} />
              {formatBigInt(existingCollateral)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-sm">
              <Trans>Borrowed amount</Trans>
            </span>
            <span className="text-text flex items-center gap-2 text-3xl font-medium tracking-tight">
              <TokenIcon token={{ symbol: 'USDS' }} width={28} className="h-7 w-7" showChainIcon={false} />
              {formatBigInt(existingDebt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-sm">
              <Trans>Rewards earned</Trans>
            </span>
            <span className="text-bullish flex items-center gap-1 text-sm font-medium">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              {`+${formatUsd(detail.rewardsEarnedUsd)}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-sm">
              <Trans>Liquidation risk</Trans>
            </span>
            <span className="text-text text-sm font-medium">
              {existingDebt > 0n && existingVault?.riskLevel ? (
                <RiskValue riskLevel={existingVault.riskLevel} />
              ) : (
                NO_VALUE
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-sm">
              <Trans>Liquidation price</Trans>
            </span>
            <span className="text-text text-sm font-medium">
              {existingDebt > 0n && existingVault?.liquidationPrice !== undefined
                ? `$${formatBigInt(existingVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
                : NO_VALUE}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary flex items-center gap-1 text-sm">
              <Trans>Protocol SKY Price</Trans>
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-text text-sm font-medium">
              {existingVault?.delayedPrice !== undefined
                ? `$${formatBigInt(existingVault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
                : NO_VALUE}
            </span>
          </div>
        </div>
      </section>

      <StakeManageStakeCard
        mode={state.stakeMode}
        onModeChange={mode => dispatch({ type: 'setStakeMode', mode })}
        enabled={state.stakeEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setStakeEnabled', enabled })}
        amount={state.skyAmount}
        onAmountChange={amount => dispatch({ type: 'setSkyAmount', amount })}
        walletBalance={skyBalance?.value}
        walletBalanceLoading={skyBalanceLoading}
        stakedAmount={existingCollateral}
        rewardsRate={detail.rewardsRate}
        estCurrentSky={detail.estAnnualRewardsSky}
        estNextSky={estNextSky}
        minStakeToBorrow={simulatedVault?.minCollateralForDust}
        error={stakeError}
      />

      <StakeManageBorrowCard
        mode={state.borrowMode}
        onModeChange={mode => dispatch({ type: 'setBorrowMode', mode })}
        enabled={state.borrowEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setBorrowEnabled', enabled })}
        amount={state.usdsAmount}
        onAmountChange={(amount, stagedWipeAll) =>
          dispatch({ type: 'setUsdsAmount', amount, wipeAll: stagedWipeAll })
        }
        existingVault={existingVault}
        simulatedVault={simulatedVault}
        vaultNoBorrow={vaultNoBorrow}
        collateralData={collateralData}
        maxBorrowable={availableBorrowBalance}
        maxRepayable={maxRepayable}
        wipeAll={state.wipeAll}
        minCollateralNotMet={minCollateralNotMet}
        minCollateralForDust={simulatedVault?.minCollateralForDust}
        currentCollateral={newCollateralAmount > 0n ? newCollateralAmount : 0n}
        error={borrowError}
      />

      <StakeManageDelegateCard
        enabled={state.delegateEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setDelegateEnabled', enabled })}
        currentDelegate={currentDelegate}
        stagedDelegate={state.selectedDelegate}
        onSelect={delegate => dispatch({ type: 'selectDelegate', delegate })}
      />
    </TakeoverShell>
  );
}
