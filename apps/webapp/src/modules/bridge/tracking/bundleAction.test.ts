import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import type { PendingBridgeAction } from '../model/types';
import type { CallsStatus } from './recoverDeposits';
import { bundleActionProgress } from './bundleAction';

const NOW = 1_800_000_000_000;
const SENT: PendingBridgeAction = {
  action: 'claim',
  txHash: '0xcalls',
  at: NOW,
  status: 'sent',
  bundle: true
};
const receipt = (transactionHash: string, status: 'success' | 'reverted' = 'success') => ({
  status,
  transactionHash: transactionHash as Hex,
  blockNumber: 1n,
  logs: []
});

describe('bundleActionProgress', () => {
  it('confirms the action under its first transaction, with the others the wallet ran apart', () => {
    const reported: CallsStatus = { status: 'success', receipts: [receipt('0xreceive'), receipt('0xsell')] };
    expect(bundleActionProgress(SENT, reported)).toEqual({
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xreceive',
      bundleTxHashes: ['0xsell']
    });
  });

  it('confirms a bundle the wallet ran as one transaction under that hash alone', () => {
    const reported: CallsStatus = { status: 'success', receipts: [receipt('0xatomic')] };
    expect(bundleActionProgress({ ...SENT, action: 'convert' }, reported)).toEqual({
      kind: 'action-confirmed',
      action: 'convert',
      txHash: '0xatomic'
    });
  });

  it.each<[string, CallsStatus]>([
    ['failed', { status: 'failure', receipts: [] }],
    [
      'reverted in one of its transactions',
      { status: 'success', receipts: [receipt('0xa'), receipt('0xb', 'reverted')] }
    ]
  ])('drops the action by its calls id when the bundle %s', (_, reported) => {
    expect(bundleActionProgress(SENT, reported)).toEqual({ kind: 'action-dropped', txHash: '0xcalls' });
  });

  // Unknown is never a failure: the bundle may still land.
  it.each<[string, CallsStatus | undefined]>([
    ['is still pending', { status: 'pending' }],
    ['did not answer', undefined],
    ['answered without a status', {}],
    ['reported success without receipts', { status: 'success', receipts: [] }]
  ])('changes nothing while the wallet %s', (_, reported) => {
    expect(bundleActionProgress(SENT, reported)).toBeNull();
  });
});
