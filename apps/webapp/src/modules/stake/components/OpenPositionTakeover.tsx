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
  useStakeUrnAddress,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useTokenBalance,
  ZERO_ADDRESS
} from '@/hooks';
import { formatDecimalPercentage } from '@/utils';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky } from '@/modules/icons';
import { Button } from '@/components/ui/button';
import { TakeoverShell } from '@/components/product/TakeoverShell';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { useStakeFlowState } from '../hooks/useStakeFlowState';
import { useStakeLaunch } from '../hooks/useStakeLaunch';
import { useStakeManageLaunch, type StakeLaunchContentContext } from '../hooks/useStakeManageLaunch';
import { useFarmRewardSymbol } from '../hooks/useFarmRewardSymbol';
import { formatSimulationErrorMessage } from '../lib/simulationErrorMessage';
import { invalidateStakeQueries } from '../lib/invalidateStakeQueries';
import { StakeTakeoverStakeCard } from './StakeTakeoverStakeCard';
import { StakeTakeoverRewardCard } from './StakeTakeoverRewardCard';
import { StakeTakeoverBorrowCard } from './StakeTakeoverBorrowCard';
import { StakeTakeoverDelegateCard } from './StakeTakeoverDelegateCard';
import { StakeTakeoverConfirmSummary } from './StakeTakeoverConfirmSummary';
import { StakeConfirmGrid } from './StakeConfirmGrid';
import { calculateAvailableBorrow, isMinCollateralNotMet } from '../lib/maxBorrow';

const FOOTER_NOTE_CLASSES =
  'flex-1 text-center text-xs leading-[18px] md:max-w-[237px] md:flex-none md:text-left';

/** Reopen context (F6, C17): the takeover re-funds an EXISTING emptied urn. */
export interface ReopenContext {
  urnIndex: number;
  /** Borrow card starts ON — the urn's history had debt (UX 1194:21914). */
  borrowExpanded: boolean;
  /** Back to the position-details modal. */
  onBack: () => void;
  /** Abandon the whole manage flow (clears the manage params). */
  onClose: () => void;
}

/**
 * Open-position takeover (F4, hi-fi 486:32657): a single-page stacked form —
 * three simultaneously-visible numbered cards + one Confirm — mounted on
 * `flow=open`. The legacy StakeStep wizard sequence dies with this screen.
 *
 * Container/presentational split: all data wiring (simulation, balances,
 * validity, the launch seam) lives here; the cards render props. The legacy
 * Borrow.tsx math is reproduced verbatim (max borrow from debt-ceiling
 * headroom vs collateral, dust minimum, min-collateral constraint).
 *
 * With a `reopen` context (F6, UX 1194:21595/21914) the same form re-funds an
 * existing emptied urn: the launch swaps to the manage seam (no `open()` leg,
 * manage ordering/copy/analytics), the urn's current reward/delegate are the
 * picker baselines, and the selectFarm/selectVoteDelegate legs only fire when
 * the user stages a DIFFERENT selection — an untouched form must never emit
 * either (C18: with `undefined` the delegate leg would silently undelegate the
 * urn). The frames keep the "Open a position" header (C17a).
 */
export function OpenPositionTakeover({ reopen }: { reopen?: ReopenContext }) {
  const chainId = useChainId();
  const { address } = useConnection();
  const [, setSearchParams] = useAppSearchParams();
  const queryClient = useQueryClient();
  const [state, dispatch] = useStakeFlowState({ borrowEnabled: reopen?.borrowExpanded });

  // The reopened urn's live context (reads are inert in plain-open mode).
  const { data: reopenUrnAddress } = useStakeUrnAddress(BigInt(reopen?.urnIndex ?? 0));
  const reopenUrn = reopen ? reopenUrnAddress : undefined;
  const { data: urnRewardContract } = useStakeUrnSelectedRewardContract({
    urn: reopenUrn || ZERO_ADDRESS
  });
  const { data: urnVoteDelegate } = useStakeUrnSelectedVoteDelegate({ urn: reopenUrn || ZERO_ADDRESS });
  // Display-only baseline: the delegate card highlights a real delegate, never
  // the zero sentinel. The calldata gating below must use the RAW read instead —
  // clamping it to undefined on a never-delegated urn would make
  // needsDelegateUpdate compare undefined !== ZERO_ADDRESS and bake a spurious
  // selectVoteDelegate(0x0) into the reopen multicall.
  const currentUrnDelegate =
    reopen && urnVoteDelegate && urnVoteDelegate !== ZERO_ADDRESS ? urnVoteDelegate : undefined;
  const reopenDelegateBaseline = reopen ? urnVoteDelegate : undefined;

  const ilkName = getIlkName(2);
  const { data: skyBalance, isLoading: balanceLoading } = useTokenBalance({
    address,
    token: TOKENS.sky.address[chainId as keyof typeof TOKENS.sky.address],
    chainId
  });

  // Debounced amounts drive approval sizing, calldata and validation — the
  // legacy widget's exact arrangement (typing doesn't thrash the RPC reads).
  const debouncedSkyToLock = useDebounce(state.skyToLock);
  const debouncedUsdsToBorrow = useDebounce(state.usdsToBorrow);

  // Live simulation for the slider and display surfaces: useSimulatedVault's
  // per-amount work is pure math over cached chain reads, so it can track the
  // raw amounts frame-for-frame while the RPC-bound seams stay debounced.
  const { data: simulatedVault, isLoading: liveSimLoading } = useSimulatedVault(
    state.skyToLock,
    state.usdsToBorrow,
    0n,
    ilkName
  );
  // Same simulation with no new debt — feeds the slider's floor math.
  const { data: vaultNoBorrow } = useSimulatedVault(state.skyToLock, 0n, 0n, ilkName);
  // Debounced simulation for validation, so errors wait for typing to settle.
  const {
    data: debouncedVault,
    isLoading: simulationLoading,
    error: simulationError
  } = useSimulatedVault(debouncedSkyToLock, debouncedUsdsToBorrow, 0n, ilkName);
  const { data: collateralData, isLoading: collateralLoading } = useCollateralData(ilkName);

  // The reward picker card stages `selectedRewardContract`; the engine requires
  // a selectFarm call for rewards to accrue, so the card is always-on with the
  // SKY farm pre-selected (A-Q2 resolved by APP-516).
  const { data: rewardContracts } = useStakeRewardContracts();
  const skyFarm = lsSkySkyRewardAddress[chainId as keyof typeof lsSkySkyRewardAddress];
  const defaultRewardContract =
    rewardContracts?.find(contract => contract.contractAddress.toLowerCase() === skyFarm?.toLowerCase())
      ?.contractAddress ?? rewardContracts?.[0]?.contractAddress;
  // Reopen (C18): the urn's farm is the selection baseline — an untouched
  // picker passes the raw urn read through so the manage seam emits no
  // selectFarm leg; a never-farmed urn falls back to the SKY default (which
  // correctly stages one). "Never farmed" is a RESOLVED read of ZERO_ADDRESS —
  // `undefined` means the urnFarms read is still pending (or errored), and
  // falling back to the instantly-available SKY default during that window
  // would bake a spurious selectFarm(SKY) into the multicall of an urn that
  // farms something else. Until the read resolves, nothing is pre-selected and
  // Confirm stays gated below.
  const rewardBaselineResolved = !reopen || urnRewardContract !== undefined;
  const reopenRewardBaseline =
    reopen && urnRewardContract && urnRewardContract !== ZERO_ADDRESS ? urnRewardContract : undefined;
  const selectedRewardContract = rewardBaselineResolved
    ? (state.selectedRewardContract ?? reopenRewardBaseline ?? defaultRewardContract)
    : state.selectedRewardContract;

  // The selected farm's reward token, for the surfaces that echo the picker's
  // selection (address-book symbol, else the on-chain one for farms the books
  // don't know yet).
  const rewardSymbol = useFarmRewardSymbol(selectedRewardContract);

  // The selected farm's live rate → card-1 stats.
  const { data: rewardsChartInfo, isLoading: rateLoading } = useMultipleRewardsChartInfo({
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

  const { fromDebtCeiling: availableBorrowFromDebtCeiling, balance: availableBorrowBalance } =
    calculateAvailableBorrow(collateralData, simulatedVault?.maxSafeBorrowableIntAmount);

  const minCollateralNotMet = isMinCollateralNotMet(debouncedVault);

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
    // <= so the exact ceiling headroom (what the 100% chip stages when the
    // ceiling binds) stays valid — strict < left Confirm disabled with no error.
    ((debouncedUsdsToBorrow > 0n && debouncedUsdsToBorrow <= availableBorrowFromDebtCeiling) ||
      !debouncedUsdsToBorrow);
  // No amount gate: a lock-only simulation failure must still say why Confirm
  // is dead. minCollateralNotMet keeps its own warning card instead; at a
  // staged borrow of 0 the mapper swaps in generic copy (the amount can't be
  // the problem — see formatSimulationErrorMessage).
  const borrowError =
    debouncedUsdsToBorrow > availableBorrowFromDebtCeiling
      ? t`Requested borrow amount exceeds the debt ceiling`
      : minCollateralNotMet
        ? undefined
        : formatSimulationErrorMessage(simulationError?.message, debouncedVault?.dust, debouncedUsdsToBorrow);

  const formValid =
    stakeValid && borrowValid && !(state.borrowEnabled && minCollateralNotMet) && rewardBaselineResolved;

  const closeOpenFlow = useCallback(() => {
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);
  const close = reopen ? reopen.onClose : closeOpenFlow;

  const onSuccess = useCallback(() => {
    // Fresh positions/activity on return — the subgraph hooks re-query along
    // the shared lag trail; on-chain reads refetch once.
    invalidateStakeQueries(queryClient);
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        // Inert on the plain open flow; clears the reopen deep-link context.
        params.delete(QueryParams.UrnIndex);
        params.delete(QueryParams.StakeTab);
        params.set(QueryParams.Tab, 'positions');
        return params;
      },
      { replace: true }
    );
  }, [queryClient, setSearchParams]);

  // Amount heroes: the wallet/status screen's compact summary, and the top of
  // the review body. The farm the picker staged used to ride here as a chip —
  // it is now the grid's Reward cell, next to the delegate and the rates.
  const heroes = useMemo(
    () => <StakeTakeoverConfirmSummary skyToLock={debouncedSkyToLock} usdsToBorrow={debouncedUsdsToBorrow} />,
    [debouncedSkyToLock, debouncedUsdsToBorrow]
  );

  const effectiveDelegate = state.selectedDelegate ?? reopenDelegateBaseline;
  // Memoized so the review body below keeps its identity across renders — it
  // is a dep of the launch descriptor.
  const rewardFrom = useMemo(
    () => (selectedRewardContract ? { address: selectedRewardContract, symbol: rewardSymbol } : undefined),
    [selectedRewardContract, rewardSymbol]
  );

  // The review body is built at Confirm time from the engine's own calls, so
  // the grid can price the live network fee (see `transactionContent` on the
  // launch hooks). A new (or emptied, on reopen) position has no "before", so
  // every cell states what the transaction leaves behind.
  const renderConfirmSummary = useCallback(
    ({ calls }: StakeLaunchContentContext) => (
      <div className="flex flex-col gap-8">
        {heroes}
        <StakeConfirmGrid
          calls={calls}
          hasPosition={false}
          stakedBefore={debouncedSkyToLock}
          stakedAfter={debouncedSkyToLock}
          rewardsRate={rewardsRate}
          rateLoading={rateLoading}
          debtBefore={debouncedUsdsToBorrow}
          debtAfter={debouncedUsdsToBorrow}
          vaultBefore={debouncedVault}
          vaultAfter={debouncedVault}
          stabilityFee={collateralData?.stabilityFee}
          rewardFrom={rewardFrom}
          delegateFrom={effectiveDelegate}
          showSelections
        />
      </div>
    ),
    [
      heroes,
      debouncedSkyToLock,
      debouncedUsdsToBorrow,
      rewardsRate,
      rateLoading,
      debouncedVault,
      collateralData?.stabilityFee,
      rewardFrom,
      effectiveDelegate
    ]
  );

  const openLaunch = useStakeLaunch({
    skyToLock: debouncedSkyToLock,
    usdsToBorrow: debouncedUsdsToBorrow,
    selectedRewardContract,
    selectedDelegate: state.selectedDelegate,
    enabled: !reopen && formValid,
    transactionContent: renderConfirmSummary,
    transactionScreenContent: heroes,
    onSuccess
  });

  // Reopen = manage-flow semantics under this form (C17): flow 'manage', no
  // open() leg, MANAGE copy/analytics, and the C18 reward/delegate
  // pass-through — the urn's current selections are the baseline so an
  // untouched card emits nothing.
  const reopenLaunch = useStakeManageLaunch({
    urnIndex: BigInt(reopen?.urnIndex ?? 0),
    urnAddress: reopenUrn,
    skyToLock: debouncedSkyToLock,
    skyToFree: 0n,
    usdsToBorrow: debouncedUsdsToBorrow,
    usdsToWipe: 0n,
    wipeAll: false,
    selectedRewardContract,
    selectedDelegate: effectiveDelegate,
    enabled: !!reopen && formValid,
    transactionContent: renderConfirmSummary,
    transactionScreenContent: heroes,
    onSuccess
  });

  const {
    launch,
    prepared,
    isLoading: launchLoading,
    error: launchError
  } = reopen ? reopenLaunch : openLaunch;
  // This host outlives the transaction (page-mounted), so pass null while the
  // form is invalid — a stale execution error must not masquerade as a prepare
  // failure once the engine is disabled. Same while the engine is re-simulating
  // (`prepared` dips false with the previous run's write/mining error still
  // set): a genuine prepare failure survives the load and shows on settle.
  const launchErrorMessage = enginePrepareErrorMessage(
    prepared,
    formValid && !launchLoading ? launchError : null
  );

  // The launch seam prepares calldata from the DEBOUNCED amounts; until they
  // catch up with what's typed, `prepared` refers to stale calldata (e.g. an
  // [open]-only multicall before the first lock amount settles).
  const amountsSettled =
    debouncedSkyToLock === state.skyToLock && debouncedUsdsToBorrow === state.usdsToBorrow;

  const confirmDisabled = !formValid || !prepared || launchLoading || !amountsSettled;

  return (
    <TakeoverShell
      title={<Trans>Open a position</Trans>}
      onBack={reopen?.onBack}
      badge={
        <>
          <StakeSky className="h-4 w-4" />
          <Trans>SKY Staking</Trans>
        </>
      }
      onClose={close}
      dataTestId="stake-takeover"
      footer={
        <>
          {/* 237px is the comp's two-line measure for this copy (1036:209863).
              An engine prepare failure takes over the slot — the helper copy
              would be a lie next to a dead Confirm. Two elements (not one
              recolored <p>) so the alert mounts fresh for screen readers. */}
          {launchErrorMessage ? (
            <p
              className={`text-error ${FOOTER_NOTE_CLASSES}`}
              data-testid="stake-takeover-error"
              role="alert"
            >
              {launchErrorMessage}
            </p>
          ) : (
            <p className={`text-fgSecondary ${FOOTER_NOTE_CLASSES}`}>
              <Trans>Review the position details, and continue to confirm it in your wallet.</Trans>
            </p>
          )}
          <Button
            variant="primary"
            size="xl"
            onClick={launch}
            disabled={confirmDisabled}
            data-testid="stake-takeover-confirm"
            // min-w, not w: the comp's 160px button leaves ~80px of text box
            // inside the 40px insets, and `whitespace-nowrap` from the base
            // recipe would clip a longer translated label rather than wrap it.
            className="h-12 shrink-0 px-5 text-sm leading-4 tracking-[-0.28px] md:h-14 md:min-w-40 md:px-10 md:text-base md:leading-[18px] md:tracking-[-0.32px]"
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
        rateLoading={rateLoading}
        estAnnualRewards={estAnnualRewards}
        rewardSymbol={rewardSymbol}
        minStakeToBorrow={state.borrowEnabled ? simulatedVault?.minCollateralForDust : undefined}
        error={stakeError}
      />

      <StakeTakeoverRewardCard
        selectedRewardContract={selectedRewardContract}
        onSelect={rewardContract => dispatch({ type: 'selectRewardContract', rewardContract })}
        keepAddress={reopenRewardBaseline}
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
        simulationLoading={liveSimLoading}
        vaultNoBorrow={vaultNoBorrow}
        collateralData={collateralData}
        collateralLoading={collateralLoading}
        error={borrowError}
      />

      <StakeTakeoverDelegateCard
        enabled={state.delegateEnabled}
        onEnabledChange={enabled => dispatch({ type: 'setDelegateEnabled', enabled })}
        // Reopen shows the urn's preserved delegate as the selection baseline
        // (UX 1194:21595); staging a different one is the only way to change it.
        selectedDelegate={state.selectedDelegate ?? currentUrnDelegate}
        onSelect={delegate => dispatch({ type: 'selectDelegate', delegate })}
      />
    </TakeoverShell>
  );
}
