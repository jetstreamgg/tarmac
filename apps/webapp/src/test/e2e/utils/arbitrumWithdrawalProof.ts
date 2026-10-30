import { type Page } from '@playwright/test';
import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  hexToBigInt,
  http,
  keccak256,
  parseAbi,
  toHex,
  zeroHash,
  type Hash,
  type Hex
} from 'viem';
import { NODE_INTERFACE } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import {
  arbitrumExecuteCall,
  arbitrumItemHash,
  arbitrumWithdrawalMessage,
  type ArbitrumWithdrawalMessage
} from '@/modules/bridge/adapters/nativeWithdrawal/arbitrum';
import {
  ARBITRUM_WITHDRAWAL,
  nodeInterfaceOutboxAbi
} from '@/modules/bridge/adapters/nativeWithdrawal/contracts';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { aggregate3Answer, rpcAt, same } from './rpcShim';
import { ANYONE, NetworkName } from './constants';

const outboxAbi = parseAbi([
  'function calculateItemHash(address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes data) pure returns (bytes32)',
  'function calculateMerkleRoot(bytes32[] proof, uint256 path, bytes32 item) pure returns (bytes32)',
  'function updateSendRoot(bytes32 root, bytes32 l2BlockHash)',
  'function isSpent(uint256 index) view returns (bool)'
]);

/** The outbox's slots probed for its `spent` bitmap, 255 leaves per word. */
const MAX_SLOT = 20n;

/**
 * Plays the rollup for the withdrawal in `l2TxHash`: the Ethereum fork's outbox gets a send
 * root that commits to it, from the rollup, and the page's Arbitrum reads get what ArbOS
 * would answer for that root (the block's send count and NodeInterface's proof), which the
 * Arbitrum fork can't. Outbox, gateway and escrow then run for real on the execute.
 * Returns the message and its proof, for an execute sent from outside the page.
 */
export async function confirmArbitrumWithdrawalOnFork(
  page: Page,
  l2TxHash: Hash
): Promise<{ message: ArbitrumWithdrawalMessage; proof: Hex[] }> {
  const l1Url = await getRpcUrlFromFile(NetworkName.mainnet);
  const l2Url = await getRpcUrlFromFile(NetworkName.arbitrum);
  const l1 = createPublicClient({ transport: http(l1Url) });
  const l2 = createPublicClient({ transport: http(l2Url) });
  const l1Rpc = rpcAt(l1Url);
  const l2Rpc = rpcAt(l2Url);
  const { outbox, rollup } = ARBITRUM_WITHDRAWAL;

  const receipt = await l2.getTransactionReceipt({ hash: l2TxHash });
  const message = arbitrumWithdrawalMessage(receipt.logs);
  if (!message) throw new Error(`No USDS withdrawal in ${l2TxHash}`);
  const item = arbitrumItemHash(message);
  const onchainItem = await l1.readContract({
    address: outbox,
    abi: outboxAbi,
    functionName: 'calculateItemHash',
    args: [
      message.l2Sender,
      message.destination,
      message.arbBlockNum,
      message.ethBlockNum,
      message.timestamp,
      message.callvalue,
      message.data
    ]
  });
  if (onchainItem !== item) throw new Error('The outbox hashes the withdrawal differently from the app');
  await unspendOnFork(l1, l1Rpc, message.position);

  // The smallest tree that reaches the message's position, with empty siblings.
  const proof: Hex[] = Array(Math.max(1, message.position.toString(2).length)).fill(zeroHash);
  const root = await l1.readContract({
    address: outbox,
    abi: outboxAbi,
    functionName: 'calculateMerkleRoot',
    args: [proof, message.position, item]
  });
  const hash = await l1Rpc('eth_sendTransaction', [
    {
      from: rollup,
      to: outbox,
      data: encodeFunctionData({
        abi: outboxAbi,
        functionName: 'updateSendRoot',
        args: [root, receipt.blockHash]
      })
    }
  ]);
  const sent = await l1.waitForTransactionReceipt({ hash });
  if (sent.status !== 'success') throw new Error('The send root update reverted');

  const proofResult = encodeFunctionResult({
    abi: nodeInterfaceOutboxAbi,
    functionName: 'constructOutboxProof',
    result: [item, root, proof]
  });
  const answerCall = (to: unknown, data: Hex): Hex | undefined => {
    if (!same(to, NODE_INTERFACE)) return undefined;
    try {
      const call = decodeFunctionData({ abi: nodeInterfaceOutboxAbi, data });
      return call.args[1] === message.position ? proofResult : undefined;
    } catch {
      return undefined;
    }
  };

  await page.route(
    target => target.href === l2Url,
    async route => {
      let request: { id: number; method: string; params?: unknown[] };
      try {
        request = JSON.parse(route.request().postData() ?? '');
      } catch {
        return route.fallback();
      }
      if (Array.isArray(request)) return route.fallback();
      const { method, params = [] } = request;
      let result: unknown;
      if (method === 'eth_getBlockByHash' && same(params[0], receipt.blockHash)) {
        // The fork doesn't count sends: the root's block holds every message up to this one.
        const block = await l2Rpc(method, params);
        result = { ...block, sendCount: toHex(message.position + 1n) };
      } else if (method === 'eth_call') {
        const { to, data, input } = params[0] as { to?: string; data?: Hex; input?: Hex };
        const callData = data ?? input;
        if (callData)
          result =
            answerCall(to, callData) ??
            (await aggregate3Answer(l2Rpc, { to, data: callData, block: params[1] }, answerCall));
      }
      if (result === undefined) return route.fallback();
      return route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result } });
    }
  );
  return { message, proof };
}

/** Executes a confirmed withdrawal on the Ethereum fork's outbox from an unrelated account, as anyone may. */
export async function executeArbitrumWithdrawalOnFork(confirmed: {
  message: ArbitrumWithdrawalMessage;
  proof: Hex[];
}): Promise<void> {
  const l1Url = await getRpcUrlFromFile(NetworkName.mainnet);
  const l1 = createPublicClient({ transport: http(l1Url) });
  const { address, abi, functionName, args } = arbitrumExecuteCall(confirmed);
  const hash = await rpcAt(l1Url)('eth_sendTransaction', [
    {
      from: ANYONE,
      to: address,
      data: encodeFunctionData({ abi, functionName, args }),
      gas: toHex(1_000_000n),
      gasPrice: '0x0'
    }
  ]);
  const receipt = await l1.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The execute reverted');
}

/**
 * The Arbitrum fork's ArbOS doesn't advance, so it numbers a new message with an old leaf the
 * outbox already spent on mainnet: clears that leaf's bit alone in the `spent` bitmap.
 */
async function unspendOnFork(
  l1: ReturnType<typeof createPublicClient>,
  l1Rpc: ReturnType<typeof rpcAt>,
  position: bigint
) {
  const { outbox } = ARBITRUM_WITHDRAWAL;
  const spent = () =>
    l1.readContract({ address: outbox, abi: outboxAbi, functionName: 'isSpent', args: [position] });
  if (!(await spent())) return;
  const bit = 1n << (position % 255n);
  for (let slot = 0n; slot < MAX_SLOT; slot++) {
    const word = keccak256(
      encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [position / 255n, slot])
    );
    const value = hexToBigInt((await l1.getStorageAt({ address: outbox, slot: word })) ?? '0x0');
    if (!(value & bit)) continue;
    await l1Rpc('tenderly_setStorageAt', [outbox, word, toHex(value & ~bit, { size: 32 })]);
    if (!(await spent())) return;
    await l1Rpc('tenderly_setStorageAt', [outbox, word, toHex(value, { size: 32 })]);
  }
  throw new Error("The outbox's spent bitmap wasn't found");
}
