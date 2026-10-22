import { t } from '@lingui/core/macro';
import { formatAddress } from '@/utils';
import { sendsToOther } from '../model/recipient';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { bridgeTypeLabel } from './bridgeModalRows';
import { bridgeTxHref, type PendingBridgeCell } from './pendingBridgeRows';

/** Cells for an unfinished CCTP swap's card, paired as a pending bridge card's. */
export function buildContinueBridgeRows(
  swap: UnfinishedCctpSwap,
  account: string | undefined,
  familyChainId: number
): PendingBridgeCell[][] {
  const swapTx: PendingBridgeCell = {
    kind: 'link',
    label: t`Swap transaction`,
    value: formatAddress(swap.swapTxHash, 6, 4),
    href: bridgeTxHref(swap.network, swap.swapTxHash, familyChainId)
  };
  return [
    [
      { kind: 'network', label: t`Source`, network: swap.network },
      { kind: 'network', label: t`Destination`, network: 'ethereum' }
    ],
    [
      { kind: 'status', label: t`Status`, status: 'pending', value: t`Not sent` },
      { kind: 'text', label: t`Bridge type`, value: bridgeTypeLabel('cctp') }
    ],
    sendsToOther(swap.recipient, account)
      ? [swapTx, { kind: 'text', label: t`Recipient`, value: formatAddress(swap.recipient, 6, 4) }]
      : [swapTx]
  ];
}
