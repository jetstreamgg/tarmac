import { describe, expect, it } from 'vitest';
import type { PendingBridge } from '../model/types';
import { buildBridgeActivity } from './bridgeActivity';

const bridge = (patch: Partial<PendingBridge>): PendingBridge => ({
  id: '0xa',
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  startedAt: 1000,
  etaAt: 2000,
  txHash: '0xa',
  ...patch
});

describe('buildBridgeActivity', () => {
  it('emits only the bridge row before the claim', () => {
    expect(buildBridgeActivity([bridge({})]).map(e => [e.kind, e.network, e.txHash])).toEqual([
      ['bridge', 'base', '0xa']
    ]);
  });

  it('adds a claim row on the destination network, newest first', () => {
    const rows = buildBridgeActivity([
      bridge({ status: 'claimed', claimTxHash: '0xc', claimedAt: 5000 }),
      bridge({ id: '0xb', txHash: '0xb', startedAt: 3000 })
    ]);
    expect(rows.map(e => [e.kind, e.network, e.txHash])).toEqual([
      ['claim', 'ethereum', '0xc'],
      ['bridge', 'base', '0xb'],
      ['bridge', 'base', '0xa']
    ]);
  });
});
