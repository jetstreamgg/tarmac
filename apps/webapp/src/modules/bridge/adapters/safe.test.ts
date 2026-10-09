import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseSafeTx,
  readSafeActionProgress,
  readSafeConfig,
  readSafeTxProgress,
  SAFE_ACTION_MISSING_MS,
  safeTxProgress,
  type SafeMultisigTx
} from './safe';

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

describe('readSafeActionProgress', () => {
  const SENT_AT = 1_800_000_000_000;
  const sent = {
    action: 'claim' as const,
    txHash: '0xsafe',
    at: SENT_AT,
    status: 'sent' as const,
    safe: true as const
  };
  const read = (now = SENT_AT + 60_000, chainId = 8453) => readSafeActionProgress({ chainId, sent, now });

  const atNonce = `/safes/${queued.safe}/multisig-transactions/?nonce=7&executed=true`;
  const nonceMoved = { [`/safes/${queued.safe}/`]: { status: 200, body: { nonce: '8' } } };

  it('confirms the action under its on-chain hash once the Safe executed it', async () => {
    const executionDate = '2027-01-15T08:00:00Z';
    respond({
      '/multisig-transactions/0xsafe/': {
        status: 200,
        body: { ...queued, isExecuted: true, isSuccessful: true, transactionHash: '0xexec', executionDate }
      }
    });
    expect(await read()).toEqual({
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xexec',
      at: Date.parse(executionDate)
    });
  });

  it('drops the action when the Safe execution reverted', async () => {
    respond({
      '/multisig-transactions/0xsafe/': {
        status: 200,
        body: { ...queued, isExecuted: true, isSuccessful: false, transactionHash: '0xexec' }
      }
    });
    expect(await read()).toEqual({ kind: 'action-dropped', txHash: '0xsafe' });
  });

  it('drops the action when another transaction executed at its nonce', async () => {
    respond({
      '/multisig-transactions/0xsafe/': { status: 200, body: queued },
      ...nonceMoved,
      [atNonce]: {
        status: 200,
        body: { results: [{ ...queued, safeTxHash: '0xother', isExecuted: true, isSuccessful: true }] }
      }
    });
    expect(await read()).toEqual({ kind: 'action-dropped', txHash: '0xsafe' });
  });

  it('keeps it sent while it waits for signatures', async () => {
    respond({ '/multisig-transactions/0xsafe/': { status: 200, body: queued } });
    expect(await read()).toBeNull();
  });

  it('drops a proposal the service no longer has, once it has had time to see it', async () => {
    respond({});
    expect(await read(SENT_AT + SAFE_ACTION_MISSING_MS)).toBeNull();
    expect(await read(SENT_AT + SAFE_ACTION_MISSING_MS + 1)).toEqual({
      kind: 'action-dropped',
      txHash: '0xsafe'
    });
  });

  it('keeps it sent through service errors, however long ago it was sent', async () => {
    respond({ '/multisig-transactions/0xsafe/': { status: 500 } });
    expect(await read(SENT_AT + 10 * SAFE_ACTION_MISSING_MS)).toBeNull();
  });

  it('has nothing to say for a chain without a service', async () => {
    const fetchSpy = respond({});
    expect(await read(SENT_AT + 10 * SAFE_ACTION_MISSING_MS, 43114)).toBeNull();
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
