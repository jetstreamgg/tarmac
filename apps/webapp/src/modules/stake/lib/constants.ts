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

export const claimTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Claim your rewards`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Successfully claimed your rewards`,
  [TxStatus.ERROR]: msg`Error`
};

/** 1-based display index for an urn ("Position 1" is urn index 0). */
export function formatUrnIndex(index: bigint): string {
  return (index + 1n).toString();
}
