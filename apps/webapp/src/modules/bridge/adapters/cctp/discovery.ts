import { decodeEventLog, getAbiItem, isAddressEqual, type Address, type Hex, type Log } from 'viem';
import { WITHDRAWAL_SCAN_BLOCKS } from '../nativeWithdrawal/discovery';
import type { ChainReader } from '../types';
import { TOKEN_MESSENGER_V2, cctpL2Contracts, tokenMessengerV2Abi, type CctpL2NetworkId } from './contracts';

const DEPOSIT_FOR_BURN = getAbiItem({ abi: tokenMessengerV2Abi, name: 'DepositForBurn' });

/** A USDC burn the account sent from an L2 through CCTP, as its event says. */
export type DiscoveredBurn = {
  txHash: Hex;
  blockNumber: bigint;
  /** USDC units. */
  amount: bigint;
  mintRecipient: Hex;
  destinationDomain: number;
};

/** The USDC burns of `network` among `logs` that the account sent, once each. */
export function burnsInLogs(logs: Log[], network: CctpL2NetworkId, account: string): DiscoveredBurn[] {
  const { usdc } = cctpL2Contracts(network);
  const found = new Map<string, DiscoveredBurn>();
  for (const log of logs) {
    if (!log.transactionHash || log.blockNumber === null || log.removed) continue;
    if (!isAddressEqual(log.address, TOKEN_MESSENGER_V2)) continue;
    try {
      const { args } = decodeEventLog({ abi: [DEPOSIT_FOR_BURN], data: log.data, topics: log.topics });
      if (!isAddressEqual(args.burnToken, usdc) || !isAddressEqual(args.depositor, account as Address))
        continue;
      const burn = {
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        amount: args.amount,
        mintRecipient: args.mintRecipient.toLowerCase() as Hex,
        destinationDomain: args.destinationDomain
      };
      const key = [burn.txHash.toLowerCase(), burn.amount, burn.mintRecipient, burn.destinationDomain].join(
        ':'
      );
      if (!found.has(key)) found.set(key, burn);
    } catch {
      // Another event of the TokenMessenger.
    }
  }
  return [...found.values()];
}

/**
 * The USDC burns the account sent from `network`, in the network's scan
 * window up to `toBlock`, in one query filtered by token and sender. Logs that
 * can't be read leave `complete` false.
 */
export async function discoverCctpBurns({
  l2,
  network,
  account,
  toBlock
}: {
  l2: Pick<ChainReader, 'getLogs'>;
  network: CctpL2NetworkId;
  account: string;
  toBlock: bigint;
}): Promise<{ burns: DiscoveredBurn[]; complete: boolean }> {
  const window = WITHDRAWAL_SCAN_BLOCKS[network];
  try {
    const logs = await l2.getLogs({
      fromBlock: toBlock >= window ? toBlock - window + 1n : 0n,
      toBlock,
      strict: true,
      address: TOKEN_MESSENGER_V2,
      event: DEPOSIT_FOR_BURN,
      args: { burnToken: cctpL2Contracts(network).usdc, depositor: account as Address }
    });
    return { burns: burnsInLogs(logs as Log[], network, account), complete: true };
  } catch {
    return { burns: [], complete: false };
  }
}
