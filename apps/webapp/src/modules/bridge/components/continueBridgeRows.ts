import { t } from '@lingui/core/macro';
import { formatAddress } from '@/utils';
import { sendsToOther } from '../model/recipient';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { CCTP_ETA_MINUTES } from '../model/resolveRoute';
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
    label: t`Transaction`,
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
      { kind: 'text', label: t`Estimated arrival`, value: t`${CCTP_ETA_MINUTES} min after sending` }
    ],
    [{ kind: 'text', label: t`Bridge type`, value: bridgeTypeLabel('cctp'), logo: 'cctp' }, swapTx],
    ...(sendsToOther(swap.recipient, account)
      ? [[{ kind: 'text', label: t`Recipient`, value: formatAddress(swap.recipient, 6, 4) } as const]]
      : [])
  ];
}
