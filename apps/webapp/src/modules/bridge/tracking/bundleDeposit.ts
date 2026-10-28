import { isAddress, isAddressEqual, type Address, type Hex, type Log } from 'viem';
import { isCctpL2Network } from '../adapters/cctp/contracts';
import { sourceBurnMessages } from '../adapters/cctp/message';
import { isNativeDepositNetwork, isOpStackNetwork } from '../adapters/nativeDeposit/contracts';
import { depositsInLogs, type DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import { arbitrumWithdrawalMessage } from '../adapters/nativeWithdrawal/arbitrum';
import { opStackWithdrawalMessage } from '../adapters/nativeWithdrawal/opStack';
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

// A wallet's receipt logs carry no hash or block of their own.
const minedLogs = (receipts: readonly BundleReceipt[]) =>
  receipts
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

/** The receipt of the bundle's native withdrawal from its account, of its amount, to its recipient: only when exactly one matches. */
function withdrawalIn(bridge: PendingBridge, receipts: readonly BundleReceipt[]) {
  const { from } = bridge;
  if (!isNativeDepositNetwork(from)) return undefined;
  const { account } = bridge;
  const recipient = bridge.recipient ?? account;
  if (!isAddress(account) || !isAddress(recipient)) return undefined;
  const matching = receipts.filter(receipt => {
    const logs = minedLogs([receipt]);
    const message = isOpStackNetwork(from)
      ? opStackWithdrawalMessage(logs, from)
      : arbitrumWithdrawalMessage(logs);
    return (
      !!message &&
      message.amount === bridge.amount &&
      isAddressEqual(message.from, account) &&
      isAddressEqual(message.to, recipient)
    );
  });
  return matching.length === 1
    ? { txHash: matching[0].transactionHash, blockNumber: matching[0].blockNumber }
    : undefined;
}

/**
 * The send a wallet bundle's card stands for among its receipts: a native
 * deposit of its network, amount and recipient, a native withdrawal or a CCTP
 * burn of its amount from its account to its recipient. A withdrawal or a
 * burn is the bundle's only when exactly one matches, as the progress reads it.
 */
export function bundleDepositIn(
  bridge: PendingBridge,
  receipts: readonly BundleReceipt[]
): Pick<DiscoveredDeposit, 'txHash' | 'blockNumber'> | undefined {
  const logs = minedLogs(receipts);
  if (bridge.routeKind === 'cctp' && bridge.to === 'ethereum' && isCctpL2Network(bridge.from)) {
    const mintRecipient = bridge.recipient ?? bridge.account;
    if (!isAddress(bridge.account) || !isAddress(mintRecipient)) return undefined;
    const expected = {
      from: bridge.from,
      amount: bridge.amount,
      sender: bridge.account,
      mintRecipient
    };
    const burns = logs.filter(log => sourceBurnMessages([log], expected).length > 0);
    return burns.length === 1 && burns[0].transactionHash && burns[0].blockNumber !== null
      ? { txHash: burns[0].transactionHash, blockNumber: burns[0].blockNumber }
      : undefined;
  }
  if (bridge.routeKind === 'native' && bridge.to === 'ethereum') return withdrawalIn(bridge, receipts);
  if (bridge.from !== 'ethereum') return undefined;
  return depositsInLogs(logs, bridge.account as Address).find(
    deposit => deposit.to === bridge.to && deposit.amount === bridge.amount && sendsTo(bridge, deposit)
  );
}
