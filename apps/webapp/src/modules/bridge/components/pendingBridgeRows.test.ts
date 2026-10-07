import { i18n } from '@lingui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import type { PendingBridge } from '../model/types';
import { buildPendingBridgeRows, formatBridgeDate, nextActionLabel } from './pendingBridgeRows';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const base: PendingBridge = {
  id: '0xabc',
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  amount: 10_000n * 10n ** 18n,
  token: 'USDS',
  from: 'ethereum',
  to: 'base',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: false,
  startedAt: 0,
  etaAt: 3 * 60_000,
  txHash: '0xff9s000000000000000000000000000000000000000000000000000000dsa6',
  actions: []
};

describe('buildPendingBridgeRows', () => {
  it('pins the Figma labels and pairing', () => {
    const rows = buildPendingBridgeRows(base, 0);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Source', 'Destination'],
      ['Status', 'Estimated arrival'],
      ['Bridge type', 'Transaction']
    ]);
  });

  it('shows the remaining time while pending and Arrived once landed', () => {
    expect(buildPendingBridgeRows(base, 0)[1][1]).toMatchObject({ value: '~3 min' });
    expect(buildPendingBridgeRows({ ...base, status: 'ready' }, 0)[1][1]).toMatchObject({ value: 'Arrived' });
  });

  it('names the ready action and keeps an unfinished withdrawal out of Arrived', () => {
    const claim = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'claim' }, 0)[1];
    expect(claim.map(cell => 'value' in cell && cell.value)).toEqual(['Ready to claim', 'Arrived']);
    const prove = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'prove' }, 0)[1];
    expect(prove.map(cell => 'value' in cell && cell.value)).toEqual(['Ready to prove', 'Ready']);
    expect(buildPendingBridgeRows({ ...base, status: 'failed' }, 0)[1][1]).toMatchObject({ value: NO_VALUE });
  });

  it('shows a queued Safe transaction as awaiting signatures', () => {
    const queued = { ...base, txHash: undefined, safeTxHash: '0xsafe' };
    expect(buildPendingBridgeRows(queued, 0)[2][1]).toMatchObject({
      label: 'Transaction',
      value: 'Awaiting signatures'
    });
  });

  it('links a queued Safe transaction to the Safe queue, only on chains the Safe app serves', () => {
    const queued = { ...base, from: 'base' as const, txHash: undefined, safeTxHash: '0x5afe' };
    const tx = buildPendingBridgeRows(queued, 0)[2][1];
    expect(tx.kind === 'link' && tx.href).toBe(
      `https://app.safe.global/transactions/tx?safe=base:${base.account}&id=0x5afe`
    );
    const avalanche = buildPendingBridgeRows({ ...queued, from: 'avalanche' as const }, 0)[2][1];
    expect('href' in avalanche && avalanche.href).toBeFalsy();
  });

  it('shows no arrival time before a queued Safe transaction executes', () => {
    const queued = { ...base, txHash: undefined, safeTxHash: '0xsafe' };
    expect(buildPendingBridgeRows(queued, 0)[1][1]).toMatchObject({ value: NO_VALUE });
  });

  it('does not show a failed Safe bridge as awaiting signatures', () => {
    const failed = { ...base, txHash: undefined, safeTxHash: '0xsafe', status: 'failed' as const };
    expect(buildPendingBridgeRows(failed, 0)[2][1]).toEqual({
      kind: 'text',
      label: 'Transaction',
      value: NO_VALUE
    });
  });

  it('ignores a clock older than the bridge start', () => {
    const late = { ...base, startedAt: 120_000, etaAt: 120_000 + 3 * 60_000 };
    expect(buildPendingBridgeRows(late, 0)[1][1]).toMatchObject({ value: '~3 min' });
  });

  it('says the bridge is taking longer than expected once past its ETA', () => {
    expect(buildPendingBridgeRows(base, base.etaAt)[1][1]).toMatchObject({ value: '~1 min' });
    expect(buildPendingBridgeRows(base, base.etaAt + 60_000)[1][1]).toMatchObject({
      value: 'Taking longer than expected'
    });
  });

  it('truncates the hash like the comp and links the source explorer', () => {
    const tx = buildPendingBridgeRows(base, 0)[2][1];
    expect(tx).toMatchObject({ value: '0xff9s...dsa6' });
    expect(tx.kind === 'link' && tx.href).toContain('etherscan.io/tx/');
  });
});

describe('pending bridge copy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads labels, statuses and actions from the active catalog at call time', () => {
    vi.spyOn(i18n, '_').mockImplementation(
      ((descriptor: { message?: string }) => `<${descriptor.message}>`) as never
    );
    const ready = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'claim' }, 0);
    const queued = buildPendingBridgeRows({ ...base, txHash: undefined, safeTxHash: '0xsafe' }, 0);
    expect(ready.flat().map(cell => cell.label)).toEqual(
      ['Source', 'Destination', 'Status', 'Estimated arrival', 'Bridge type', 'Transaction'].map(
        l => `<${l}>`
      )
    );
    expect(ready[1].map(cell => 'value' in cell && cell.value)).toEqual(['<Ready to claim>', '<Arrived>']);
    expect(queued[1][0]).toMatchObject({ value: '<Pending>' });
    expect(queued[2].map(cell => 'value' in cell && cell.value)).toEqual([
      '<Native>',
      '<Awaiting signatures>'
    ]);
    expect(nextActionLabel('finalize')).toBe('<Finalize>');
  });
});

describe('formatBridgeDate', () => {
  it('formats as dd/MM/yy HH:mm UTC', () => {
    expect(formatBridgeDate(Date.UTC(2026, 9, 25, 15, 26))).toBe('25/10/26 15:26 UTC');
  });
});
