import { psm3L2Abi } from '@/hooks/generated';
import {
  TransactionReceiptNotFoundError,
  decodeEventLog,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
  type Log
} from 'viem';
import { describe, expect, it, vi } from 'vitest';
import type { ChainReader } from '../types';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from './cctp.fixtures';
import { cctpL2Contracts, messageTransmitterV2Abi } from './contracts';
import { SWAP_LOOKBACK_BLOCKS, lookupCctpBurn, standardBurns } from './lookup';

const SENDER = getAddress(BASE_BURN_TX.from);
const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const BLOCK_SECONDS = 1_800_000_000n;
const BURN_BLOCK = 52837683n;
const BURN_TX_INDEX = 7;

const messageLog = BASE_BURN_LOGS.find(log => log.topics[0]?.startsWith('0x8c5261668696')) as Log;
const burnMessage = () =>
  decodeEventLog({
    abi: messageTransmitterV2Abi,
    eventName: 'MessageSent',
    topics: messageLog.topics,
    data: messageLog.data
  }).args.message as Hex;

/** The burn's logs with its MessageSent message patched at byte `offset`. */
const patchedLogs = (offset: number, bytes: string): Log[] => {
  const message = burnMessage();
  const patched =
    `${message.slice(0, 2 + offset * 2)}${bytes}${message.slice(2 + offset * 2 + bytes.length)}` as Hex;
  return BASE_BURN_LOGS.map(log =>
    log === messageLog ? { ...log, data: encodeAbiParameters([{ type: 'bytes' }], [patched]) } : log
  );
};
const MINT_RECIPIENT_OFFSET = 148 + 36;
const toOther = () => patchedLogs(MINT_RECIPIENT_OFFSET, OTHER.slice(2).padStart(64, '0'));

/** The PSM3 swap of USDS to USDC this app sends before the burn, in the same transaction. */
const swapLog = ({
  address = cctpL2Contracts('base').psm3,
  sender = SENDER,
  receiver = SENDER,
  amountOut = BASE_BURN_AMOUNT,
  blockNumber = BURN_BLOCK,
  transactionIndex = BURN_TX_INDEX
}: {
  address?: string;
  sender?: string;
  receiver?: string;
  amountOut?: bigint;
  blockNumber?: bigint;
  transactionIndex?: number;
} = {}): Log =>
  ({
    ...messageLog,
    address,
    blockNumber,
    transactionIndex,
    topics: encodeEventTopics({
      abi: psm3L2Abi,
      eventName: 'Swap',
      args: {
        assetIn: cctpL2Contracts('base').usds,
        assetOut: cctpL2Contracts('base').usdc,
        receiver: receiver as Hex
      }
    }),
    data: encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      [sender as Hex, BASE_BURN_AMOUNT * 10n ** 12n, amountOut, 0n]
    )
  }) as Log;

const client = ({
  logs = BASE_BURN_LOGS,
  status = 'success',
  receiptError,
  earlier = []
}: { logs?: Log[]; status?: 'success' | 'reverted'; receiptError?: Error; earlier?: Log[] } = {}) =>
  ({
    getTransactionReceipt: vi.fn(async () => {
      if (receiptError) throw receiptError;
      return {
        status,
        logs,
        blockNumber: BURN_BLOCK,
        transactionIndex: BURN_TX_INDEX
      };
    }),
    getBlock: vi.fn(async () => ({ timestamp: BLOCK_SECONDS })),
    // The PSM3 swaps to the sender, in the blocks up to the burn's.
    getLogs: vi.fn(async () => earlier)
  }) as unknown as ChainReader;

const lookup = (account: string, reader = client(), txHash: Hex = BASE_BURN_TX.hash) =>
  lookupCctpBurn({ from: 'base', txHash, account, client: reader });

describe('standardBurns', () => {
  it("reads the burn's sender, recipient and USDS amount", () => {
    expect(standardBurns(BASE_BURN_LOGS, 'base')).toEqual([
      { from: 'base', amount: BASE_BURN_AMOUNT * 10n ** 12n, sender: SENDER, mintRecipient: SENDER }
    ]);
  });

  it('finds none read as another source network', () => {
    expect(standardBurns(BASE_BURN_LOGS, 'optimism')).toEqual([]);
  });

  it.each([
    ['a fast transfer', 140, '000003e8'],
    ['a fee', 148 + 132, 1n.toString(16).padStart(64, '0')],
    ['a destination caller', 108, OTHER.slice(2).padStart(64, '0')],
    ['another burn token', 148 + 4, OTHER.slice(2).padStart(64, '0')],
    ['hook data', (burnMessage().length - 2) / 2, 'abcd']
  ])('finds none in a burn with %s', (_, offset, bytes) => {
    expect(standardBurns(patchedLogs(offset, bytes), 'base')).toEqual([]);
  });

  it('finds none in a MessageSent another contract emitted', () => {
    const logs = BASE_BURN_LOGS.map(log => (log === messageLog ? { ...log, address: OTHER } : log)) as Log[];
    expect(standardBurns(logs, 'base')).toEqual([]);
  });
});

describe('lookupCctpBurn', () => {
  it('builds the pending bridge the tracker claims from, started at the burn block', async () => {
    const result = await lookup(SENDER.toUpperCase().replace('0X', '0x'));
    expect(result).toEqual({
      status: 'found',
      bridge: {
        id: BASE_BURN_TX.hash,
        account: SENDER.toLowerCase(),
        amount: BASE_BURN_AMOUNT * 10n ** 12n,
        token: 'USDS',
        from: 'base',
        to: 'ethereum',
        status: 'pending',
        routeKind: 'cctp',
        requiresClaim: true,
        nextAction: 'claim',
        startedAt: Number(BLOCK_SECONDS) * 1000,
        etaAt: Number(BLOCK_SECONDS) * 1000 + 20 * 60_000,
        txHash: BASE_BURN_TX.hash,
        actions: [],
        routeData: { cctpClaimOnly: 'true' }
      }
    });
  });

  it('claims and converts a burn its own transaction swapped from USDS on PSM3', async () => {
    const result = await lookup(SENDER, client({ logs: [swapLog(), ...BASE_BURN_LOGS] }));
    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.bridge.routeData).toBeUndefined();
  });

  it.each([
    ['another contract', { address: OTHER }],
    ['another receiver', { receiver: OTHER }],
    ['less than the burn', { amountOut: BASE_BURN_AMOUNT - 1n }]
  ])("only claims a burn whose swap is %s's: its USDC stays USDC", async (_, swap) => {
    const result = await lookup(SENDER, client({ logs: [swapLog(swap), ...BASE_BURN_LOGS] }));
    expect(result.status === 'found' && result.bridge.routeData).toEqual({ cctpClaimOnly: 'true' });
  });

  // A bridge sent one leg at a time, or as a bundle the wallet runs as separate transactions.
  it('claims and converts a burn whose sender swapped it from USDS in an earlier transaction', async () => {
    const reader = client({ earlier: [swapLog({ blockNumber: BURN_BLOCK - 2n })] });
    const result = await lookup(OTHER, reader);
    expect(result.status === 'found' && result.bridge.routeData).toBeUndefined();
    expect(reader.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: cctpL2Contracts('base').psm3,
        args: {
          assetIn: cctpL2Contracts('base').usds,
          assetOut: cctpL2Contracts('base').usdc,
          receiver: SENDER
        },
        fromBlock: BURN_BLOCK - SWAP_LOOKBACK_BLOCKS + 1n,
        toBlock: BURN_BLOCK
      })
    );
  });

  it('claims and converts a burn whose swap went earlier in the same block', async () => {
    const earlier = [swapLog({ transactionIndex: BURN_TX_INDEX - 1 })];
    const result = await lookup(SENDER, client({ earlier }));
    expect(result.status === 'found' && result.bridge.routeData).toBeUndefined();
  });

  it.each([
    ['sent by another wallet', { sender: OTHER }],
    ['for less than the burn', { amountOut: BASE_BURN_AMOUNT - 1n }],
    ['sent after the burn in its block', { transactionIndex: BURN_TX_INDEX + 1 }],
    ['from another contract', { address: OTHER }]
  ])('only claims a burn whose earlier swap was %s: its USDC stays USDC', async (_, swap) => {
    const result = await lookup(SENDER, client({ earlier: [swapLog(swap)] }));
    expect(result.status === 'found' && result.bridge.routeData).toEqual({ cctpClaimOnly: 'true' });
  });

  it('does not look for an earlier swap when the burn swapped in its own transaction', async () => {
    const reader = client({ logs: [swapLog(), ...BASE_BURN_LOGS] });
    await lookup(SENDER, reader);
    expect(reader.getLogs).not.toHaveBeenCalled();
  });

  it('keys the bridge by the lower-case hash', async () => {
    const result = await lookup(SENDER, client(), BASE_BURN_TX.hash.toUpperCase().replace('0X', '0x') as Hex);
    expect(result.status === 'found' && result.bridge.id).toBe(BASE_BURN_TX.hash);
    expect(result.status === 'found' && result.bridge.txHash).toBe(BASE_BURN_TX.hash);
  });

  it('records another recipient, for the recipient and for the sender', async () => {
    for (const account of [OTHER, SENDER]) {
      const result = await lookup(account, client({ logs: toOther() }));
      expect(result.status).toBe('found');
      if (result.status !== 'found') return;
      expect(result.bridge.account).toBe(SENDER.toLowerCase());
      expect(result.bridge.recipient).toBe(OTHER);
    }
  });

  // Figma 75: a third wallet follows it, and only its recipient can claim it.
  it('builds the bridge for a wallet that neither sent nor receives it, naming its recipient', async () => {
    const own = await lookup(OTHER);
    expect(own.status === 'found' && own.bridge).toMatchObject({
      account: SENDER.toLowerCase(),
      recipient: SENDER.toLowerCase()
    });
    const THIRD = '0x0000000000000000000000000000000000000c0c';
    const toOtherWallet = await lookup(THIRD, client({ logs: toOther() }));
    expect(toOtherWallet.status === 'found' && toOtherWallet.bridge).toMatchObject({
      account: SENDER.toLowerCase(),
      recipient: OTHER
    });
  });

  it('refuses a transaction the network has no receipt for', async () => {
    const reader = client({ receiptError: new TransactionReceiptNotFoundError({ hash: BASE_BURN_TX.hash }) });
    expect(await lookup(SENDER, reader)).toEqual({ status: 'refused', reason: 'not-found' });
  });

  it('refuses a reverted transaction', async () => {
    expect(await lookup(SENDER, client({ status: 'reverted' }))).toEqual({
      status: 'refused',
      reason: 'reverted'
    });
  });

  it('refuses a transaction with no standard burn to Ethereum', async () => {
    expect(await lookup(SENDER, client({ logs: patchedLogs(140, '000003e8') }))).toEqual({
      status: 'refused',
      reason: 'not-a-bridge'
    });
    expect(await lookup(SENDER, client({ logs: [] }))).toEqual({ status: 'refused', reason: 'not-a-bridge' });
  });

  it('refuses two burns in one transaction', async () => {
    expect(await lookup(SENDER, client({ logs: [...BASE_BURN_LOGS, messageLog] }))).toEqual({
      status: 'refused',
      reason: 'several-burns'
    });
  });

  it('throws when the network read fails', async () => {
    await expect(lookup(SENDER, client({ receiptError: new Error('rpc down') }))).rejects.toThrow('rpc down');
  });

  it('throws when the read of earlier swaps fails', async () => {
    const reader = client();
    vi.mocked(reader.getLogs).mockRejectedValueOnce(new Error('logs down'));
    await expect(lookup(SENDER, reader)).rejects.toThrow('logs down');
  });
});
