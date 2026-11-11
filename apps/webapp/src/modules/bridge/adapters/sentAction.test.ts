import { describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import type { PendingBridgeAction } from '../model/types';
import { L1_SENT_ACTION_DROPPED_MS, SENT_ACTION_DROPPED_MS, settleSentAction } from './sentAction';
import type { ChainReader } from './types';

const NOW = 1_800_000_000_000;
const HASH = `0x${'7'.repeat(64)}`;
const SENT: PendingBridgeAction = { action: 'replay', txHash: HASH, at: NOW, status: 'sent' };

const l2 = ({
  receipt,
  tx = 'missing'
}: {
  receipt?: 'success' | 'reverted' | 'error';
  tx?: 'pending' | 'missing' | 'error';
}) => {
  const reader = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (receipt === 'error') throw new Error('rpc down');
      if (!receipt) throw new TransactionReceiptNotFoundError({ hash });
      return { status: receipt };
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (tx === 'error') throw new Error('rpc down');
      if (tx === 'missing') throw new TransactionNotFoundError({ hash });
      return { hash, blockNumber: null };
    })
  };
  return { reader, client: reader as unknown as ChainReader };
};

describe('settleSentAction', () => {
  it('confirms a mined action and drops a reverted one', async () => {
    await expect(settleSentAction(l2({ receipt: 'success' }).client, SENT, NOW)).resolves.toEqual({
      kind: 'action-confirmed',
      action: 'replay',
      txHash: HASH
    });
    await expect(settleSentAction(l2({ receipt: 'reverted' }).client, SENT, NOW)).resolves.toEqual({
      kind: 'action-dropped',
      txHash: HASH
    });
  });

  it('waits on an unmined action until the drop window passed, without asking for it', async () => {
    const { reader, client } = l2({});
    await expect(settleSentAction(client, SENT, NOW + SENT_ACTION_DROPPED_MS - 1)).resolves.toBeUndefined();
    expect(reader.getTransaction).not.toHaveBeenCalled();
  });

  it('drops an action the chain still does not know after the window, so it can be sent again', async () => {
    await expect(settleSentAction(l2({}).client, SENT, NOW + SENT_ACTION_DROPPED_MS)).resolves.toEqual({
      kind: 'action-dropped',
      txHash: HASH
    });
  });

  it('takes the window of the chain it was sent on: Ethereum keeps a transaction far longer', async () => {
    const { client } = l2({});
    await expect(
      settleSentAction(client, SENT, NOW + L1_SENT_ACTION_DROPPED_MS - 1, L1_SENT_ACTION_DROPPED_MS)
    ).resolves.toBeUndefined();
    await expect(
      settleSentAction(client, SENT, NOW + L1_SENT_ACTION_DROPPED_MS, L1_SENT_ACTION_DROPPED_MS)
    ).resolves.toEqual({ kind: 'action-dropped', txHash: HASH });
  });

  it('keeps waiting on one still pending after the window', async () => {
    await expect(
      settleSentAction(l2({ tx: 'pending' }).client, SENT, NOW + SENT_ACTION_DROPPED_MS)
    ).resolves.toBeUndefined();
  });

  it('throws on a failed read, so the caller changes nothing', async () => {
    await expect(settleSentAction(l2({ receipt: 'error' }).client, SENT, NOW)).rejects.toThrow('rpc down');
    await expect(
      settleSentAction(l2({ tx: 'error' }).client, SENT, NOW + SENT_ACTION_DROPPED_MS)
    ).rejects.toThrow('rpc down');
  });
});
