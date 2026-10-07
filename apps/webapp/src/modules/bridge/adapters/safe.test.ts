import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSafeTx, readSafeConfig, readSafeTxProgress, safeTxProgress, type SafeMultisigTx } from './safe';

const queued: SafeMultisigTx = {
  safe: '0x0000000000000000000000000000000000005afe',
  safeTxHash: '0xsafe',
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
  const other = {
    ...queued,
    safeTxHash: '0xother',
    isExecuted: true,
    isSuccessful: true,
    transactionHash: '0xo'
  };

  it('waits while signatures are pending', () => {
    expect(safeTxProgress(queued)).toBeNull();
    expect(safeTxProgress(queued, [])).toBeNull();
  });

  it('reports the on-chain hash once executed', () => {
    expect(
      safeTxProgress({ ...queued, isExecuted: true, isSuccessful: true, transactionHash: '0xexec' })
    ).toEqual({
      kind: 'source-executed',
      txHash: '0xexec'
    });
  });

  it('fails when execution reverted', () => {
    expect(
      safeTxProgress({ ...queued, isExecuted: true, isSuccessful: false, transactionHash: '0xexec' })
    ).toEqual({ kind: 'failed', reason: 'safe-tx-reverted' });
  });

  it('fails only when another transaction executed at its nonce', () => {
    expect(safeTxProgress(queued, [other])).toEqual({ kind: 'failed', reason: 'safe-tx-replaced' });
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
  const read = (overrides: { chainId?: number } = {}) =>
    readSafeTxProgress({ chainId: 8453, safeTxHash: '0xsafe', ...overrides });

  const atNonce = `/safes/${queued.safe}/multisig-transactions/?nonce=7&executed=true`;
  const nonceMoved = { [`/safes/${queued.safe}/`]: { status: 200, body: { nonce: '8' } } };

  it('fails when the service lists another executed transaction at its nonce', async () => {
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: {
        status: 200,
        body: { results: [{ ...queued, safeTxHash: '0xother', isExecuted: true, isSuccessful: true }] }
      }
    });
    expect(await read()).toEqual({ kind: 'failed', reason: 'safe-tx-replaced' });
  });

  it('a moved Safe nonce alone is not a replacement (the service can lag)', async () => {
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: { status: 200, body: { results: [] } }
    });
    expect(await read()).toBeNull();
  });

  it('an executed entry at its nonce without a Safe tx hash is no evidence', async () => {
    const unhashed = { ...queued, safeTxHash: undefined, isExecuted: true, isSuccessful: true };
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: { status: 200, body: { results: [unhashed] } }
    });
    expect(await read()).toBeNull();
  });

  it('keeps waiting when the list at its nonce cannot be read', async () => {
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: { status: 500 }
    });
    expect(await read()).toBeNull();
  });

  it('reports its own execution found at its nonce, with the execution time', async () => {
    const executionDate = '2027-01-15T08:00:00Z';
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: {
        status: 200,
        body: {
          results: [
            { ...queued, isExecuted: true, isSuccessful: true, transactionHash: '0xexec', executionDate }
          ]
        }
      }
    });
    expect(await read()).toEqual({
      kind: 'source-executed',
      txHash: '0xexec',
      executedAt: Date.parse(executionDate)
    });
  });

  it('keeps waiting when the service does not know the transaction yet', async () => {
    respond({});
    expect(await read()).toBeNull();
  });

  it('keeps waiting for a transaction the service does not know, with no time limit', async () => {
    respond({});
    expect(await read()).toBeNull();
  });

  it('keeps waiting through service errors', async () => {
    respond({ '/multisig-transactions/0xsafe/': { status: 500 } });
    expect(await read()).toBeNull();
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
