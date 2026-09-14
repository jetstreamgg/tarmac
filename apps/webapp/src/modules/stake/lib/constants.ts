import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { TxStatus } from '@/widgets/shared/constants';

// Relocated VERBATIM from `widgets/StakeModuleWidget/lib/constants.ts` when F7
// deleted the legacy widget. The msgids double as e2e/analytics anchors and the
// Lingui catalogs key on the exact strings — reused, not forked (UI Spec §3).
// Only the symbols the V2 stake module consumes survived the move.

export enum StakeFlow {
  OPEN = 'open',
  MANAGE = 'manage'
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
