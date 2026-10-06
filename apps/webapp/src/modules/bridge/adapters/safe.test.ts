import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSafeTx, readSafeConfig, readSafeTxProgress, safeTxProgress, type SafeMultisigTx } from './safe';

const queued: SafeMultisigTx = {
  safe: '0x0000000000000000000000000000000000005afe',
  nonce: 7,
  isExecuted: false,
  isSuccessful: null,
  transactionHash: null
};

const respond = (routes: Record<string, { status: number; body?: unknown }>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    const match = Object.entries(routes).find(([path]) => url.endsWith(path));
    const { status, body } = match?.[1] ?? { status: 404 };
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });

afterEach(() => vi.restoreAllMocks());

describe('safeTxProgress', () => {
  it('waits while signatures are pending at the current nonce', () => {
    expect(safeTxProgress(queued, 7)).toBeNull();
    expect(safeTxProgress(queued, undefined)).toBeNull();
  });

  it('reports the on-chain hash once executed', () => {
    expect(
      safeTxProgress({ ...queued, isExecuted: true, isSuccessful: true, transactionHash: '0xexec' }, 8)
    ).toEqual({
      kind: 'source-executed',
      txHash: '0xexec'
    });
  });

  it('fails when execution reverted', () => {
    expect(
      safeTxProgress({ ...queued, isExecuted: true, isSuccessful: false, transactionHash: '0xexec' }, 8)
    ).toEqual({
      kind: 'failed',
      reason: 'safe-tx-reverted'
    });
  });

  it('fails when another transaction took its nonce', () => {
    expect(safeTxProgress(queued, 8)).toEqual({ kind: 'failed', reason: 'safe-tx-replaced' });
  });
});

describe('parseSafeTx', () => {
  it('accepts the service shape, string nonces included', () => {
    expect(parseSafeTx({ ...queued, nonce: '7' })).toEqual(queued);
  });

  it('rejects anything else', () => {
    expect(parseSafeTx(null)).toBeNull();
    expect(parseSafeTx({ ...queued, nonce: 'x' })).toBeNull();
    expect(parseSafeTx({ ...queued, isExecuted: 'no' })).toBeNull();
  });
});

describe('readSafeTxProgress', () => {
  const NOW = 1_800_000_000_000;
  const read = (overrides: { chainId?: number; queuedAt?: number } = {}) =>
    readSafeTxProgress({ chainId: 8453, safeTxHash: '0xsafe', queuedAt: NOW, now: NOW, ...overrides });

  it('compares a pending transaction with the Safe nonce', async () => {
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      [`/safes/${queued.safe}/`]: { status: 200, body: { nonce: '8' } }
    });
    expect(await read()).toEqual({ kind: 'failed', reason: 'safe-tx-replaced' });
  });

  it('reads the transaction again before calling it replaced, in case it executed between the reads', async () => {
    const executed = { ...queued, isExecuted: true, isSuccessful: true, transactionHash: '0xexec' };
    let txReads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      const body = url.endsWith('/multisig-transactions/0xsafe/')
        ? txReads++ === 0
          ? queued
          : executed
        : { nonce: 8 };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    expect(await read()).toEqual({ kind: 'source-executed', txHash: '0xexec' });
  });

  it('keeps waiting when the service does not know the transaction yet', async () => {
    respond({});
    expect(await read()).toBeNull();
  });

  it('fails a transaction the service still does not know an hour after it was queued (deleted by the owners)', async () => {
    respond({});
    expect(await read({ queuedAt: NOW - 61 * 60_000 })).toEqual({
      kind: 'failed',
      reason: 'safe-tx-not-found'
    });
  });

  it('keeps waiting through service errors', async () => {
    respond({ '/multisig-transactions/0xsafe/': { status: 500 } });
    expect(await read({ queuedAt: NOW - 2 * 24 * 60 * 60_000 })).toBeNull();
  });

  it('has nothing to say for a chain without a service', async () => {
    const fetchSpy = respond({});
    expect(await read({ chainId: 43114 })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('readSafeConfig', () => {
  it('returns owners and threshold, or null when there is no Safe', async () => {
    respond({ '/safes/0xa/': { status: 200, body: { owners: ['0x1', '0x2'], threshold: 2, nonce: 3 } } });
    expect(await readSafeConfig({ chainId: 1, address: '0xa' })).toEqual({
      owners: ['0x1', '0x2'],
      threshold: 2
    });
    expect(await readSafeConfig({ chainId: 1, address: '0xb' })).toBeNull();
  });

  it('throws when it cannot tell, so the recipient policy fails closed', async () => {
    respond({ '/safes/0xa/': { status: 500 } });
    await expect(readSafeConfig({ chainId: 1, address: '0xa' })).rejects.toThrow();
    await expect(readSafeConfig({ chainId: 43114, address: '0xa' })).rejects.toThrow();
  });
});
