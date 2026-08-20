import { useCallback, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { TakeoverShell } from '@/components/product/TakeoverShell';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { calculateMaxRepayable } from '../lib/manageRepay';
import { formatSimulationErrorMessage } from '../lib/simulationErrorMessage';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';
import { useFarmRewardSymbol } from '../hooks/useFarmRewardSymbol';
import { StakeManageFlowInit, useStakeManageFlowState } from '../hooks/useStakeManageFlowState';
import { useStakePositionDetail } from '../hooks/useStakePositionDetail';
import { useStakeManageLaunch } from '../hooks/useStakeManageLaunch';
import { StakeManageStakeCard } from './StakeManageStakeCard';
import { StakeManageBorrowCard, RiskBadge } from './StakeManageBorrowCard';
import { UpdatedHourlyBadge } from './StakeManageCard';
import { StakeManageRewardCard } from './StakeManageRewardCard';
import { StakeManageDelegateCard } from './StakeManageDelegateCard';
import { StakeManageConfirmSummary } from './StakeManageConfirmSummary';

const NO_VALUE = '–';

/**
 * "Manage a position" full-page sheet (F5, UX 1050:21454+): a position-summary
 * strip and four independently-toggleable cards over one Confirm. All data
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

  // Live-composed amounts for the slider and display surfaces:
  // useSimulatedVault's per-amount work is pure math over cached chain reads,
  // so it can track the raw amounts frame-for-frame while the RPC-bound seams
  // and validation stay debounced.
  const liveSkyToLock = state.stakeEnabled && state.stakeMode === 'stake' ? state.skyAmount : 0n;
  const liveSkyToFree = state.stakeEnabled && state.stakeMode === 'withdraw' ? state.skyAmount : 0n;
  const liveUsdsToBorrow = state.borrowEnabled && state.borrowMode === 'borrow' ? state.usdsAmount : 0n;
  const liveUsdsToWipe = state.borrowEnabled && state.borrowMode === 'repay' ? state.usdsAmount : 0n;
  const liveCollateralAmount = existingCollateral + liveSkyToLock - liveSkyToFree;
  const liveDebtValue = existingDebt + liveUsdsToBorrow - liveUsdsToWipe;
  const { data: simulatedVault, isLoading: liveSimLoading } = useSimulatedVault(
    liveCollateralAmount > 0n ? liveCollateralAmount : 0n,
    liveDebtValue > 0n ? liveDebtValue : 0n,
    existingDebt,
    ilkName
  );
  // Slider floor/ceiling baseline: same collateral, unchanged debt.
  const { data: vaultNoBorrow } = useSimulatedVault(
    liveCollateralAmount > 0n ? liveCollateralAmount : 0n,
    existingDebt,
    existingDebt,
    ilkName
  );
  // Debounced simulation for validation, so errors wait for typing to settle.
  const {
    data: debouncedVault,
    isLoading: simulationLoading,
    error: simulationError
  } = useSimulatedVault(
    newCollateralAmount > 0n ? newCollateralAmount : 0n,
    newDebtValue > 0n ? newDebtValue : 0n,
    existingDebt,
    ilkName
  );
  const { data: collateralData, isLoading: collateralLoading } = useCollateralData(ilkName);

  const { data: skyBalance, isLoading: skyBalanceLoading } = useTokenBalance({
    address,
    token: TOKENS.sky.address[chainId as keyof typeof TOKENS.sky.address],
    chainId
  });
  const { data: usdsBalance, isLoading: usdsBalanceLoading } = useTokenBalance({
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
    debouncedVault?.liquidationProximityPercentage &&
    liquidationThreshold &&
    debouncedVault.liquidationProximityPercentage > liquidationThreshold
  );
  const isCappedOsmError = !!(
    skyToFree &&
    skyToFree > 0n &&
    !!debouncedVault?.delayedPrice &&
    !!debouncedVault?.liquidationPrice &&
    debouncedVault.liquidationPrice > debouncedVault.delayedPrice
  );
  const stakeError =
    state.stakeMode === 'stake'
      ? skyBalance !== undefined && state.skyAmount > skyBalance.value && state.skyAmount !== 0n
        ? t`Insufficient funds`
        : undefined
      : // Never validate against the unresolved vault read's 0n fallback.
        existingVault !== undefined && state.skyAmount > existingCollateral && state.skyAmount !== 0n
        ? t`Insufficient funds`
        : // The capped-OSM state implies max liquidation risk (the F8 proximity
          // short-circuit reports 100 whenever liquidation price ≥ delayed
          // price), so the more specific message must win the tie — after it,
          // the generic risk error is unreachable-shadowed, not the reverse.
          isCappedOsmError
          ? t`Liquidation price is higher than the capped OSM SKY price`
          : isLiquidationError
            ? t`Liquidation risk too high`
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
    debouncedVault?.collateralAmount !== undefined &&
    debouncedVault?.minCollateralForDust !== undefined &&
    debouncedVault.collateralAmount <= debouncedVault.minCollateralForDust;

  const maxRepayable = calculateMaxRepayable({
    debtValue: existingDebt,
    dust: existingVault?.dust,
    balance: usdsBalance?.value
  });

  // Legacy Repay.tsx error ladder (M11).
  const minDebtNotMet = newDebtValue > 0n && newDebtValue < (existingVault?.dust ?? 0n) && usdsToWipe > 0n;
  const hasEnoughUsds =
    !!usdsBalance?.value && usdsBalance.value > 0n && usdsBalance.value >= debouncedUsdsAmount;

  // No amount gates on the simulation branches: a lock/free-only simulation
  // failure must still say why Confirm is dead. minCollateralNotMet keeps its
  // own warning card instead; at a staged amount of 0 the mapper swaps in
  // generic copy (the amount can't be the problem — see
  // formatSimulationErrorMessage).
  const borrowError =
    state.borrowMode === 'borrow'
      ? usdsToBorrow > availableBorrowFromDebtCeiling
        ? t`Requested borrow amount exceeds the debt ceiling`
        : minCollateralNotMet
          ? undefined
          : formatSimulationErrorMessage(simulationError?.message, existingVault?.dust, usdsToBorrow)
      : minDebtNotMet
        ? t`Debt must be paid off entirely, or left with a minimum of ${formatBigInt(existingVault?.dust ?? 0n)}`
        : !hasEnoughUsds && usdsToWipe > 0n
          ? t`Not enough USDS in your wallet`
          : newDebtValue < 0n
            ? t`Amount exceeds debt`
            : formatSimulationErrorMessage(simulationError?.message, undefined, usdsToWipe);

  const borrowCardValid =
    !state.borrowEnabled ||
    (state.borrowMode === 'borrow'
      ? !minCollateralNotMet &&
        // <= so the exact ceiling headroom (what the 100% chip stages when the
        // ceiling binds) stays valid — strict < left Confirm disabled with no error.
        ((usdsToBorrow > 0n && usdsToBorrow <= availableBorrowFromDebtCeiling) || !usdsToBorrow) &&
        !simulationError &&
        !simulationLoading
      : (state.usdsAmount === 0n && !state.wipeAll) ||
        (!borrowError && !simulationError && !simulationLoading));

  // ---- Reward change (APP-516) ----------------------------------------------
  const currentRewardContract =
    detail.rewardContract && detail.rewardContract !== ZERO_ADDRESS ? detail.rewardContract : undefined;
  const rewardChanged =
    state.rewardEnabled &&
    !!state.selectedRewardContract &&
    state.selectedRewardContract.toLowerCase() !== detail.rewardContract?.toLowerCase();
  // Effective reward: staged change, else the urn's current one so the calldata
  // gating sees "no change" — the delegate recipe (M12).
  const effectiveRewardContract = rewardChanged ? state.selectedRewardContract : detail.rewardContract;
  // The staged farm's reward token for the review screen — the picker offers
  // every indexer farm, including ones the address books don't know yet.
  const stagedRewardSymbol = useFarmRewardSymbol(rewardChanged ? state.selectedRewardContract : undefined);

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
    skyToLock > 0n ||
    skyToFree > 0n ||
    usdsToBorrow > 0n ||
    usdsToWipe > 0n ||
    wipeAll ||
    rewardChanged ||
    delegateChanged;
  // Every staged change is relative to the existing position, so nothing may
  // confirm against an unresolved vault read.
  const formValid = hasChange && debounceSettled && stakeCardValid && borrowCardValid && !detail.vaultLoading;

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const onSuccess = useCallback(() => {
    // Fresh positions/activity AND fresh on-chain reads (vault, balances,
    // allowances) on return — manage txs change what every read hook reports.
    invalidateStakeQueries(queryClient);
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
        rewardFrom={
          currentRewardContract ? { address: currentRewardContract, symbol: detail.rewardSymbol } : undefined
        }
        rewardTo={
          rewardChanged && state.selectedRewardContract
            ? { address: state.selectedRewardContract, symbol: stagedRewardSymbol }
            : undefined
        }
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
      detail.rewardSymbol,
      currentRewardContract,
      rewardChanged,
      state.selectedRewardContract,
      stagedRewardSymbol,
      currentDelegate,
      delegateChanged,
      state.selectedDelegate
    ]
  );

  const {
    launch,
    prepared,
    isLoading: launchLoading,
    error: launchError
  } = useStakeManageLaunch({
    urnIndex: BigInt(urnIndex),
    urnAddress: detail.urnAddress,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    wipeAll,
    selectedRewardContract: effectiveRewardContract,
    selectedDelegate: effectiveDelegate,
    enabled: formValid,
    transactionContent: confirmSummary,
    onSuccess
  });

  const confirmDisabled = !formValid || !prepared || launchLoading;
  // This host outlives the transaction (page-mounted), so pass null while the
  // form is invalid — a stale execution error must not masquerade as a prepare
  // failure once the engine is disabled. Same while the engine is re-simulating
  // (`prepared` dips false with the previous run's write/mining error still
  // set): a genuine prepare failure survives the load and shows on settle.
  const launchErrorMessage = enginePrepareErrorMessage(
    prepared,
    formValid && !launchLoading ? launchError : null
  );

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
          <StakeSky className="h-4 w-4" />
          <Trans>SKY Staking</Trans>
        </>
      }
      onBack={onBack}
      onClose={close}
      dataTestId="stake-manage-takeover"
      footer={
        <>
          {/* An engine prepare failure takes over the slot — the helper copy
              would be a lie next to a dead Confirm. Two elements (not one
              recolored <p>) so the alert mounts fresh for screen readers. */}
          {launchErrorMessage ? (
            <p className="text-error max-w-xs text-sm" data-testid="stake-manage-error" role="alert">
              {launchErrorMessage}
            </p>
          ) : (
            <p className="text-textSecondary max-w-xs text-sm">
              <Trans>Review the changes to your position, and continue to confirm it in your wallet.</Trans>
            </p>
          )}
          <Button
            variant="primary"
            size="xl"
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
      {/* Position summary strip (comp 1036:213826; flows UX 1050:21454) */}
      <section
        data-testid="stake-manage-position-summary"
        className="flex flex-col gap-8 px-2"
        aria-label="Position summary"
      >
        <h3 className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          <Trans>Position summary</Trans>
        </h3>
        <div className="flex flex-wrap items-center gap-9">
          <div className="flex flex-col gap-3.5">
            <span className="text-textSecondary text-xs leading-[18px]">
              <Trans>Staked amount</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-3 text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
              <TokenIcon token={{ symbol: 'SKY' }} width={40} className="h-10 w-10" showChainIcon={false} />
              {detail.vaultLoading ? (
                <Skeleton className="h-[35px] w-24" />
              ) : (
                formatBigInt(existingCollateral)
              )}
            </span>
          </div>
          <span className="bg-borderPrimary h-12 w-px shrink-0 self-center" aria-hidden />
          <div className="flex flex-col gap-3.5">
            <span className="text-textSecondary text-xs leading-[18px]">
              <Trans>Borrowed amount</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-3 text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
              <TokenIcon token={{ symbol: 'USDS' }} width={40} className="h-10 w-10" showChainIcon={false} />
              {detail.vaultLoading ? <Skeleton className="h-[35px] w-24" /> : formatBigInt(existingDebt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-xs leading-[18px]">
              <Trans>Rewards received</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px]">
              {detail.rewardsEarnedLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                `+${formatUsd(detail.rewardsEarnedUsd)}`
              )}
              {detail.rewardSymbol && (
                <TokenIcon
                  token={{ symbol: detail.rewardSymbol }}
                  width={12}
                  className="h-3 w-3"
                  showChainIcon={false}
                />
              )}
            </span>
          </div>
          <span className="bg-borderPrimary h-8 w-px shrink-0 self-center" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-xs leading-[18px]">
              <Trans>Liquidation risk</Trans>
            </span>
            <span className="text-text font-circle flex h-4 items-center text-sm leading-4 font-medium tracking-[-0.28px]">
              {detail.vaultLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : existingDebt > 0n && existingVault?.riskLevel ? (
                <RiskBadge riskLevel={existingVault.riskLevel} />
              ) : (
                NO_VALUE
              )}
            </span>
          </div>
          <span className="bg-borderPrimary h-8 w-px shrink-0 self-center" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary text-xs leading-[18px]">
              <Trans>Liquidation price</Trans>
            </span>
            <span className="text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
              {detail.vaultLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : existingDebt > 0n && existingVault?.liquidationPrice !== undefined ? (
                `$${formatBigInt(existingVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              ) : (
                NO_VALUE
              )}
            </span>
          </div>
          <span className="bg-borderPrimary h-8 w-px shrink-0 self-center" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-textSecondary flex items-center gap-1 text-xs leading-[18px]">
              <Trans>Protocol SKY Price</Trans>
              <Info className="h-3 w-3" aria-hidden />
            </span>
            <span className="text-text font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]">
              {detail.vaultLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : existingVault?.delayedPrice !== undefined ? (
                `$${formatBigInt(existingVault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              ) : (
                NO_VALUE
              )}
              <UpdatedHourlyBadge />
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
        stakedAmountLoading={detail.vaultLoading}
        rewardsRate={detail.rewardsRate}
        rateLoading={detail.rateLoading}
        estCurrentSky={detail.estAnnualRewardsSky}
        estNextSky={estNextSky}
        minStakeToBorrow={simulatedVault?.minCollateralForDust}
        minStakeToBorrowLoading={liveSimLoading}
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
        positionLoading={detail.vaultLoading}
        simulatedVault={simulatedVault}
        simulationLoading={liveSimLoading}
        vaultNoBorrow={vaultNoBorrow}
        collateralData={collateralData}
        collateralLoading={collateralLoading}
        maxBorrowable={availableBorrowBalance}
        maxRepayable={maxRepayable}
        usdsBalanceLoading={usdsBalanceLoading}
        wipeAll={state.wipeAll}
        minCollateralNotMet={minCollateralNotMet}
        minCollateralForDust={simulatedVault?.minCollateralForDust}
        currentCollateral={newCollateralAmount > 0n ? newCollateralAmount : 0n}
        error={borrowError}
      />

      <StakeManageRewardCard
        enabled={state.rewardEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setRewardEnabled', enabled })}
        currentRewardContract={currentRewardContract}
        stagedRewardContract={state.selectedRewardContract}
        onSelect={rewardContract => dispatch({ type: 'selectRewardContract', rewardContract })}
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
