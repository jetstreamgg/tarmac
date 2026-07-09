import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { TxStatus } from '@/widgets/shared/constants';
import { TxCardCopyText } from '@/widgets/shared/types/txCardCopyText';

// Relocated VERBATIM from `widgets/StakeModuleWidget/lib/constants.ts` when F7
// deleted the legacy widget. The msgids double as e2e/analytics anchors and the
// Lingui catalogs key on the exact strings — reused, not forked (UI Spec §3).
// Only the symbols the V2 stake module consumes survived the move.

export enum StakeFlow {
  OPEN = 'open',
  MANAGE = 'manage',
  CLAIM = 'claim'
}

export function getStakeTitle(
  txStatus: Omit<TxStatus, TxStatus.CANCELLED>,
  flow: StakeFlow
): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return flow === StakeFlow.OPEN
        ? msg`Confirm your transaction`
        : msg`Confirm the change in your position`;
    case TxStatus.LOADING:
      return msg`In progress`;
    case TxStatus.SUCCESS:
      return msg`Success!`;
    case TxStatus.ERROR:
    case TxStatus.CANCELLED:
    default:
      return msg`Error`;
  }
}

export function getStakeSubtitle({
  flow,
  txStatus,
  collateralToLock,
  borrowAmount,
  collateralToFree,
  borrowToRepay,
  selectedToken
}: {
  flow: StakeFlow;
  txStatus: Omit<TxStatus, TxStatus.CANCELLED>;
  collateralToLock?: string;
  borrowAmount?: string;
  collateralToFree?: string;
  borrowToRepay?: string;
  selectedToken?: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return flow === StakeFlow.OPEN
        ? msg`Your transaction is being processed on the blockchain to create your position. Please wait.`
        : msg`Your transaction is being processed on the blockchain to change your position. Please wait.`;
    case TxStatus.SUCCESS:
      return flow === StakeFlow.OPEN
        ? collateralToLock && borrowAmount
          ? msg`You've borrowed ${borrowAmount} USDS by staking ${collateralToLock} ${selectedToken ?? ''}. Your new position is open.`
          : collateralToLock
            ? msg`You've staked ${collateralToLock} ${selectedToken ?? ''}. Your new position is open.`
            : msg`You just opened your position`
        : collateralToFree && borrowToRepay
          ? msg`You've unstaked ${collateralToFree} ${selectedToken ?? ''} and repaid ${borrowToRepay} USDS to exit your position.`
          : collateralToFree
            ? msg`You've unstaked ${collateralToFree} ${selectedToken ?? ''} to exit your position.`
            : borrowToRepay
              ? msg`You've repaid ${borrowToRepay} USDS to exit your position.`
              : collateralToLock && borrowAmount
                ? msg`You've borrowed ${borrowAmount} USDS by staking ${collateralToLock} ${selectedToken ?? ''}. Your position is updated.`
                : collateralToLock
                  ? msg`You've staked ${collateralToLock} ${selectedToken ?? ''}. Your position is updated.`
                  : borrowAmount
                    ? msg`You've borrowed ${borrowAmount} USDS. Your position is updated.`
                    : msg`You just updated your position`;
    case TxStatus.ERROR:
    default:
      return flow === StakeFlow.OPEN
        ? msg`An error occurred while opening your position`
        : msg`An error occurred while changing your position`;
  }
}

export const claimTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Claim your rewards`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Successfully claimed your rewards`,
  [TxStatus.ERROR]: msg`Error`
};

export const claimSubtitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Please confirm that you want to claim your rewards directly to your wallet.`,
  [TxStatus.LOADING]: msg`Your claim is being processed on the blockchain. Please wait.`,
  [TxStatus.SUCCESS]: msg`You’ve claimed your rewards`,
  [TxStatus.ERROR]: msg`An error occurred while claiming your rewards`
};

/** 1-based display index for an urn ("Position 1" is urn index 0). */
export function formatUrnIndex(index: bigint): string {
  return (index + 1n).toString();
}
