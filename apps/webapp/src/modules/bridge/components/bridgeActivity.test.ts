import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PendingBridge } from '../model/types';
import { bridgeActivityTitle, buildBridgeActivity } from './bridgeActivity';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const bridge = (patch: Partial<PendingBridge>): PendingBridge => ({
  id: '0xa',
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: 1000,
  etaAt: 2000,
  txHash: '0xa',
  actions: [],
  ...patch
});

const summary = (bridges: PendingBridge[]) =>
  buildBridgeActivity(bridges).map(entry => [entry.kind, entry.network, entry.txHash]);

describe('buildBridgeActivity', () => {
  it('emits only the bridge row before any destination action', () => {
    expect(summary([bridge({})])).toEqual([['bridge', 'base', '0xa']]);
  });

  it('adds a row per action on the destination network, newest first', () => {
    expect(
      summary([
        bridge({ status: 'claimed', actions: [{ action: 'claim', txHash: '0xc', at: 5000 }] }),
        bridge({ id: '0xb', txHash: '0xb', startedAt: 3000 })
      ])
    ).toEqual([
      ['claim', 'ethereum', '0xc'],
      ['bridge', 'base', '0xb'],
      ['bridge', 'base', '0xa']
    ]);
  });

  it('lists both legs of an OP Stack withdrawal', () => {
    expect(
      summary([
        bridge({
          from: 'optimism',
          routeKind: 'native',
          actions: [
            { action: 'prove', txHash: '0xp', at: 2000 },
            { action: 'finalize', txHash: '0xf', at: 9000 }
          ]
        })
      ])
    ).toEqual([
      ['finalize', 'ethereum', '0xf'],
      ['prove', 'ethereum', '0xp'],
      ['bridge', 'optimism', '0xa']
    ]);
  });

  it('leaves out a destination action until it is confirmed', () => {
    const sent = bridge({
      status: 'ready',
      actions: [{ action: 'claim', txHash: '0xsafetx', at: 5000, status: 'sent' }]
    });
    expect(summary([sent])).toEqual([['bridge', 'base', '0xa']]);
  });

  it('leaves out a bridge whose source tx failed, so it does not read as a transfer', () => {
    expect(summary([bridge({ status: 'failed', nextAction: undefined, failureReason: 'reverted' })])).toEqual(
      []
    );
  });

  it('leaves out a Safe bridge still waiting for signatures', () => {
    expect(summary([bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: undefined })])).toEqual([]);
  });
});

describe('bridgeActivityTitle', () => {
  it('names a finalized withdrawal apart from a claim', () => {
    expect(bridgeActivityTitle('finalize')).not.toBe(bridgeActivityTitle('claim'));
    expect(bridgeActivityTitle('finalize')).toBe('Withdrawal finalization');
  });
});
