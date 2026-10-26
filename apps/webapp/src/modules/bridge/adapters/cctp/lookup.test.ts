import {
  TransactionReceiptNotFoundError,
  decodeEventLog,
  encodeAbiParameters,
  getAddress,
  type Hex,
  type Log
} from 'viem';
import { describe, expect, it, vi } from 'vitest';
import type { ChainReader } from '../types';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from './cctp.fixtures';
import { messageTransmitterV2Abi } from './contracts';
import { lookupCctpBurn, standardBurns } from './lookup';

const SENDER = getAddress(BASE_BURN_TX.from);
const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const BLOCK_SECONDS = 1_800_000_000n;

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

const client = ({
  logs = BASE_BURN_LOGS,
  status = 'success',
  receiptError
}: { logs?: Log[]; status?: 'success' | 'reverted'; receiptError?: Error } = {}) =>
  ({
    getTransactionReceipt: vi.fn(async () => {
      if (receiptError) throw receiptError;
      return { status, logs, blockNumber: 52837683n };
    }),
    getBlock: vi.fn(async () => ({ timestamp: BLOCK_SECONDS }))
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
        actions: []
      }
    });
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
});
