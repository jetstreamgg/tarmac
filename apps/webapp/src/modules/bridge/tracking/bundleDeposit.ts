import type { Address, Hex, Log } from 'viem';
import { depositsInLogs, type DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { PendingBridge } from '../model/types';

/** A receipt of a mined bundle, as the wallet (EIP-5792) or the chain reports it. */
export type BundleReceipt = {
  status: 'success' | 'reverted';
  transactionHash: Hex;
  blockNumber: bigint;
  logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[];
};

/** The deposit pays the bridge's recipient, or its sender when it has none. */
export const sendsTo = (bridge: PendingBridge, deposit: DiscoveredDeposit) =>
  (bridge.recipient ?? bridge.account).toLowerCase() === deposit.recipient.toLowerCase();

/** The deposit a wallet bundle's card stands for among its receipts: its network, amount and recipient. */
export function bundleDepositIn(
  bridge: PendingBridge,
  receipts: readonly BundleReceipt[]
): DiscoveredDeposit | undefined {
  if (bridge.from !== 'ethereum') return undefined;
  // A wallet's receipt logs carry no hash or block of their own.
  const logs = receipts
    .filter(receipt => receipt.status === 'success')
    .flatMap(receipt =>
      receipt.logs.map(
        log =>
          ({
            ...log,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            removed: false
          }) as unknown as Log
      )
    );
  return depositsInLogs(logs, bridge.account as Address).find(
    deposit => deposit.to === bridge.to && deposit.amount === bridge.amount && sendsTo(bridge, deposit)
  );
}
