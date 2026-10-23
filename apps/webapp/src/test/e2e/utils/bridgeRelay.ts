import { expect, type Page } from '@playwright/test';
import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  parseAbi,
  size,
  toHex,
  type Address,
  type Hash,
  type Hex
} from 'viem';
import { arbitrumInboxImplementationAbi } from '@/hooks/generated';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  OP_STACK_DEPOSIT,
  l1BridgeIsOpenAbi,
  type NativeDepositNetwork,
  type OpStackNetworkId
} from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { readOpStackDeposit, sendOpStackDeposit } from './opStackDepositRelay';
import { NetworkName } from './constants';

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
const messengerAbi = parseAbi([
  'event RelayedMessage(bytes32 indexed msgHash)',
  'event FailedRelayedMessage(bytes32 indexed msgHash)'
]);

const rpc = async <T>(network: NetworkName, method: string, params: unknown[]): Promise<T> => {
  const response = await fetch(await getRpcUrlFromFile(network), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method} on ${network}: ${body.error.message}`);
  return body.result as T;
};

const client = async (network: NetworkName) =>
  createPublicClient({ transport: http(await getRpcUrlFromFile(network)) });

/** The source tx hash of the newest pending bridge to `to`, read from the page's pending store. */
export const pendingDepositTxHash = (page: Page, to: string) =>
  page.evaluate(destination => {
    const entries = Object.keys(localStorage)
      .filter(key => key.startsWith('bridgePending:v1:') && !key.endsWith(':unreadable'))
      .flatMap(
        key =>
          JSON.parse(localStorage.getItem(key) ?? '[]') as {
            to: string;
            txHash?: string;
            startedAt: number;
          }[]
      )
      .filter(entry => entry.to === destination && entry.txHash)
      .sort((a, b) => b.startedAt - a.startedAt);
    return entries[0]?.txHash as `0x${string}` | undefined;
  }, to);

/** Waits for that hash: a bundle's card only gets it from the deposit scan, once the bundle is mined. */
export async function awaitDepositTxHash(page: Page, to: string) {
  let hash: Hash | undefined;
  await expect
    .poll(async () => (hash = await pendingDepositTxHash(page, to)), { timeout: 60_000 })
    .toBeTruthy();
  return hash!;
}

/** Relays an L1 OP Stack deposit on the L2 fork; returns the messenger events it emitted. */
export async function relayOpStackDeposit(
  network: OpStackNetworkId,
  l1TxHash: Hash,
  { gas }: { gas?: bigint } = {}
) {
  const deposit = await readOpStackDeposit(await client(NetworkName.mainnet), l1TxHash);
  const relay = await sendOpStackDeposit(
    await client(NetworkName[network]),
    await getRpcUrlFromFile(NetworkName[network]),
    deposit,
    { gas }
  );
  return relay.logs.flatMap(entry => {
    try {
      return [decodeEventLog({ abi: messengerAbi, ...entry }).eventName];
    } catch {
      return [];
    }
  });
}

export async function l2UsdsBalance(network: NativeDepositNetwork, account: Address) {
  const l2 = await client(NetworkName[network]);
  return l2.readContract({
    address: network === 'arbitrum' ? ARBITRUM_DEPOSIT.l2Usds : OP_STACK_DEPOSIT[network].l2Usds,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account]
  });
}

/** The account's Ethereum nonce and USDS balance: what any sent leg would move. */
export async function l1AccountState(account: Address) {
  const l1 = await client(NetworkName.mainnet);
  const [nonce, usds] = await Promise.all([
    l1.getTransactionCount({ address: account }),
    l1.readContract({ address: L1_USDS, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
  ]);
  return { nonce, usds };
}

const pad = (value: bigint | number) => toHex(value, { size: 32 });

/**
 * Closes a route's L1 bridge by zeroing the storage slot behind `isOpen()`,
 * found by probing; returns a restore that reopens it. Fork only.
 */
export async function closeOpStackBridge(network: OpStackNetworkId) {
  const bridge = OP_STACK_DEPOSIT[network].l1TokenBridge;
  const isOpen = async () =>
    BigInt(
      await rpc<string>(NetworkName.mainnet, 'eth_call', [
        { to: bridge, data: encodeFunctionData({ abi: l1BridgeIsOpenAbi, functionName: 'isOpen' }) },
        'latest'
      ])
    );
  for (let slot = 0; slot < 16; slot++) {
    const value = BigInt(
      await rpc<string>(NetworkName.mainnet, 'eth_getStorageAt', [bridge, pad(slot), 'latest'])
    );
    if (value !== 1n) continue;
    await rpc(NetworkName.mainnet, 'tenderly_setStorageAt', [bridge, pad(slot), pad(0)]);
    if ((await isOpen()) === 0n)
      return () => rpc(NetworkName.mainnet, 'tenderly_setStorageAt', [bridge, pad(slot), pad(1)]);
    await rpc(NetworkName.mainnet, 'tenderly_setStorageAt', [bridge, pad(slot), pad(1)]);
  }
  throw new Error(`isOpen slot not found on the ${network} L1 bridge`);
}

/** Inbox.calculateRetryableSubmissionFee for `data` at an Ethereum block, its base fee read there. */
export async function arbitrumSubmissionFee(data: Hex, blockNumber: bigint) {
  const l1 = await client(NetworkName.mainnet);
  const { baseFeePerGas } = await l1.getBlock({ blockNumber });
  return l1.readContract({
    address: ARBITRUM_DEPOSIT.inbox,
    abi: arbitrumInboxImplementationAbi,
    functionName: 'calculateRetryableSubmissionFee',
    args: [BigInt(size(data)), baseFeePerGas ?? 0n],
    blockNumber
  });
}
