import {
  getStakeDrawCalldata,
  getStakeFreeCalldata,
  getStakeGetRewardCalldata,
  getStakeLockCalldata,
  getStakeOpenCalldata,
  getStakeSelectDelegateCalldata,
  getStakeSelectRewardContractCalldata,
  getStakeWipeAllCalldata,
  getStakeWipeCalldata,
  ZERO_ADDRESS
} from '@/hooks';

/**
 * Flow selector for {@link generateStakeCalldata}.
 *
 * Module-local by design — do NOT import `StakeFlow` from the legacy
 * `widgets/StakeModuleWidget` (that would invert the strangler-fig direction and
 * break when F7 deletes the widget). The legacy context branches on
 * `widgetState.flow === StakeFlow.OPEN` and treats everything else (MANAGE *and*
 * CLAIM) as the manage ordering, so callers must map legacy CLAIM flows to
 * `'manage'`.
 */
export type StakeCalldataFlow = 'open' | 'manage';

/**
 * Copied VERBATIM from `widgets/StakeModuleWidget/lib/utils.ts` (do not import
 * from the widget; do not modify the widget). Exported for golden-master tests.
 *
 * Determines if a reward contract update is needed:
 * - For a new URN: true if a reward contract is selected
 * - For an existing URN: true if the selected reward contract differs from the current one
 */
export function needsRewardUpdate(
  urnAddress: `0x${string}` | undefined,
  selectedRewardContract: `0x${string}` | undefined,
  urnSelectedRewardContract: `0x${string}` | undefined
) {
  const needRewardContractUpdate =
    !!(!urnAddress && selectedRewardContract && selectedRewardContract !== ZERO_ADDRESS) ||
    (urnAddress && selectedRewardContract?.toLowerCase() !== urnSelectedRewardContract?.toLowerCase());

  return needRewardContractUpdate;
}

/**
 * Copied VERBATIM from `widgets/StakeModuleWidget/lib/utils.ts` (do not import
 * from the widget; do not modify the widget). Exported for golden-master tests.
 *
 * Determines if a delegate update is needed:
 * - For a new URN: true if a delegate is selected
 * - For an existing URN: true if the selected delegate differs from the current one
 */
export function needsDelegateUpdate(
  urnAddress: `0x${string}` | undefined,
  selectedDelegate: `0x${string}` | undefined,
  urnSelectedVoteDelegate: `0x${string}` | undefined
) {
  const needDelegateUpdate =
    !!(!urnAddress && selectedDelegate && selectedDelegate !== ZERO_ADDRESS) ||
    (urnAddress && selectedDelegate?.toLowerCase() !== urnSelectedVoteDelegate?.toLowerCase());

  return needDelegateUpdate;
}

export interface GenerateStakeCalldataParams {
  /** `'open'` opens a new urn; `'manage'` manages the existing one (legacy CLAIM maps here). */
  flow: StakeCalldataFlow;
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  /** Active urn address when managing; `undefined` when opening a new position. */
  urnAddress: `0x${string}` | undefined;
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToWipe: bigint;
  wipeAll: boolean;
  usdsToBorrow: bigint;
  selectedRewardContract: `0x${string}` | undefined;
  selectedDelegate: `0x${string}` | undefined;
  urnSelectedRewardContract: `0x${string}` | undefined;
  urnSelectedVoteDelegate: `0x${string}` | undefined;
  rewardContractsToClaim: `0x${string}`[] | undefined;
  restakeSkyRewards: boolean;
  restakeSkyAmount: bigint;
  referralCode?: number;
}

/**
 * Pure, flow-parameterized copy of the legacy `generateAllCalldata`
 * (`widgets/StakeModuleWidget/context/context.tsx`). Produces the exact same
 * `0x${string}[]` — same encoder calls, same ordering, same gating — so the new
 * takeover (F4) and manage (F5) surfaces can consume it without the widget
 * context. The legacy logic is *copied*, not moved; the widget dies at F7.
 *
 * Known asymmetry preserved on purpose (PRD Decision 6): the lock term here is
 * `skyToLock + (restakeSkyRewards ? restakeSkyAmount : 0n)` with NO
 * `isSkyRewardPosition` guard, even though the approval math in
 * `calculateStakeApprovalAmounts` HAS one. Byte-identical means reproducing both.
 */
export function generateStakeCalldata({
  flow,
  ownerAddress,
  urnIndex,
  urnAddress,
  skyToLock,
  skyToFree,
  usdsToWipe,
  wipeAll,
  usdsToBorrow,
  selectedRewardContract,
  selectedDelegate,
  urnSelectedRewardContract,
  urnSelectedVoteDelegate,
  rewardContractsToClaim,
  restakeSkyRewards,
  restakeSkyAmount,
  referralCode = 0
}: GenerateStakeCalldataParams): `0x${string}`[] {
  // If we have a urn address, we're not opening a new one, we're managing an existing one
  const openCalldata = !urnAddress ? getStakeOpenCalldata({ urnIndex }) : undefined;

  const totalSkyLockAmount = skyToLock + (restakeSkyRewards ? restakeSkyAmount : 0n);

  // SKY to lock
  const lockSkyCalldata =
    totalSkyLockAmount > 0n
      ? getStakeLockCalldata({
          ownerAddress,
          urnIndex,
          amount: totalSkyLockAmount,
          refCode: referralCode
        })
      : undefined;

  // USDS to wipe
  const repayCalldata =
    !wipeAll && usdsToWipe && usdsToWipe > 0n
      ? getStakeWipeCalldata({ ownerAddress, urnIndex, amount: usdsToWipe })
      : undefined;

  // Wipe All USDS
  const repayAllCalldata = wipeAll ? getStakeWipeAllCalldata({ ownerAddress, urnIndex }) : undefined;

  // SKY to free
  const freeSkyCalldata =
    skyToFree && skyToFree > 0n
      ? getStakeFreeCalldata({ ownerAddress, urnIndex, toAddress: ownerAddress, amount: skyToFree })
      : undefined;

  // USDS to borrow
  const borrowUsdsCalldata =
    usdsToBorrow && usdsToBorrow > 0n
      ? getStakeDrawCalldata({
          ownerAddress,
          urnIndex,
          toAddress: ownerAddress,
          amount: usdsToBorrow
        })
      : undefined;

  // Select reward
  const selectRewardContractCalldata = needsRewardUpdate(
    urnAddress,
    selectedRewardContract,
    urnSelectedRewardContract
  )
    ? getStakeSelectRewardContractCalldata({
        ownerAddress,
        urnIndex,
        rewardContractAddress: selectedRewardContract || ZERO_ADDRESS,
        refCode: referralCode
      })
    : undefined;

  // Select delegate
  const selectDelegateCalldata = needsDelegateUpdate(urnAddress, selectedDelegate, urnSelectedVoteDelegate)
    ? getStakeSelectDelegateCalldata({
        ownerAddress,
        urnIndex,
        delegateAddress: selectedDelegate || ZERO_ADDRESS
      })
    : undefined;

  // Claim rewards
  const claimRewardsCalldatas = rewardContractsToClaim
    ? rewardContractsToClaim.map(rewardContractToClaim =>
        getStakeGetRewardCalldata({
          ownerAddress,
          urnIndex,
          rewardContractAddress: rewardContractToClaim,
          toAddress: ownerAddress
        })
      )
    : undefined;

  // Order calldata based on the flow
  const sortedCalldata =
    flow === 'open'
      ? [
          openCalldata,
          lockSkyCalldata,
          borrowUsdsCalldata,
          selectRewardContractCalldata,
          selectDelegateCalldata
        ]
      : [
          /* For the manage flow, we need to sort the calldatas that unseal SKY before the ones that seal it
           * to avoid conflicts with the selectDelegate calldata, as the DSChief has a protection that
           * prevents `lock`ing and then `free`ing SKY in the same block
           * Also, sort repay before free to prevent free from failing due to the position becoming unsafe */
          repayCalldata,
          repayAllCalldata,
          freeSkyCalldata,
          ...(claimRewardsCalldatas || []),
          selectRewardContractCalldata,
          selectDelegateCalldata,
          lockSkyCalldata,
          borrowUsdsCalldata
        ];

  // Filter out undefined calldata
  const filteredCalldata = sortedCalldata.filter(calldata => !!calldata) as `0x${string}`[];

  return filteredCalldata;
}
