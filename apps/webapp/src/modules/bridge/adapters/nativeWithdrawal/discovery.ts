import { decodeEventLog, getAbiItem, isAddressEqual, type Address, type Hex, type Log } from 'viem';
import {
  ARBITRUM_DEPOSIT,
  isOpStackNetwork,
  L1_USDS,
  OP_STACK_DEPOSIT,
  type NativeDepositNetwork
} from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import { arbitrumL2TokenGatewayAbi, opStackL2TokenBridgeAbi } from './contracts';

const BRIDGE_INITIATED = getAbiItem({ abi: opStackL2TokenBridgeAbi, name: 'ERC20BridgeInitiated' });
const WITHDRAWAL_INITIATED = getAbiItem({ abi: arbitrumL2TokenGatewayAbi, name: 'WithdrawalInitiated' });

/**
 * L2 blocks a scan covers, read in one query: the primary upstream returns large filtered ranges
 * whole, and the fallback's 10-block cap fails any useful range. About 23 days of Base or OP,
 * 11 of Unichain, 30 of Arbitrum.
 */
export const WITHDRAWAL_SCAN_BLOCKS: Record<NativeDepositNetwork, bigint> = {
  base: 1_000_000n,
  optimism: 1_000_000n,
  unichain: 1_000_000n,
  arbitrum: 10_500_000n
};

/** An L2 transaction with a USDS withdrawal to Ethereum the account sent or receives. */
export type DiscoveredWithdrawal = { txHash: Hex; blockNumber: bigint };

const touches = (account: Address, from: Address, to: Address) =>
  isAddressEqual(from, account) || isAddressEqual(to, account);

function isAccountWithdrawal(log: Log, network: NativeDepositNetwork, account: Address): boolean {
  try {
    if (isOpStackNetwork(network)) {
      const { l2TokenBridge, l2Usds } = OP_STACK_DEPOSIT[network];
      if (!isAddressEqual(log.address, l2TokenBridge)) return false;
      const { args } = decodeEventLog({ abi: [BRIDGE_INITIATED], data: log.data, topics: log.topics });
      return (
        isAddressEqual(args.localToken, l2Usds) &&
        isAddressEqual(args.remoteToken, L1_USDS) &&
        touches(account, args.from, args.to)
      );
    }
    if (!isAddressEqual(log.address, ARBITRUM_DEPOSIT.l2Gateway)) return false;
    const { args } = decodeEventLog({ abi: [WITHDRAWAL_INITIATED], data: log.data, topics: log.topics });
    return isAddressEqual(args.l1Token, L1_USDS) && touches(account, args._from, args._to);
  } catch {
    return false;
  }
}

/** The transactions among `logs` with a USDS withdrawal from `network` the account sent or receives, once each. */
export function withdrawalsInLogs(
  logs: Log[],
  network: NativeDepositNetwork,
  account: string
): DiscoveredWithdrawal[] {
  const found = new Map<string, DiscoveredWithdrawal>();
  for (const log of logs) {
    if (!log.transactionHash || log.blockNumber === null || log.removed) continue;
    const key = log.transactionHash.toLowerCase();
    if (!found.has(key) && isAccountWithdrawal(log, network, account as Address))
      found.set(key, { txHash: log.transactionHash, blockNumber: log.blockNumber });
  }
  return [...found.values()];
}

/**
 * The account's USDS withdrawals to Ethereum from `network`, sent or received,
 * in the network's scan window up to `toBlock`, in one query. The logs
 * are filtered by token only (traffic is tiny), so sender and recipient come
 * back alike. Logs that can't be read leave `complete` false.
 */
export async function discoverNativeWithdrawals({
  l2,
  network,
  account,
  toBlock
}: {
  l2: Pick<ChainReader, 'getLogs'>;
  network: NativeDepositNetwork;
  account: string;
  toBlock: bigint;
}): Promise<{ withdrawals: DiscoveredWithdrawal[]; complete: boolean }> {
  const window = WITHDRAWAL_SCAN_BLOCKS[network];
  const range = { fromBlock: toBlock >= window ? toBlock - window + 1n : 0n, toBlock, strict: true } as const;
  let logs: Log[];
  try {
    const read = isOpStackNetwork(network)
      ? await l2.getLogs({
          ...range,
          address: OP_STACK_DEPOSIT[network].l2TokenBridge,
          event: BRIDGE_INITIATED,
          args: { localToken: OP_STACK_DEPOSIT[network].l2Usds }
        })
      : await l2.getLogs({ ...range, address: ARBITRUM_DEPOSIT.l2Gateway, event: WITHDRAWAL_INITIATED });
    logs = read as Log[];
  } catch {
    return { withdrawals: [], complete: false };
  }
  return { withdrawals: withdrawalsInLogs(logs, network, account), complete: true };
}
