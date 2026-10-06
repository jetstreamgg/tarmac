import { describe, expect, it } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import type { PendingBridge } from '../model/types';
import { buildPendingBridgeRows, formatBridgeDate } from './pendingBridgeRows';

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
    expect(buildPendingBridgeRows(queued, 0)[2][1]).toEqual({
      kind: 'text',
      label: 'Transaction',
      value: 'Awaiting signatures'
    });
  });

  it('ignores a clock older than the bridge start', () => {
    const late = { ...base, startedAt: 120_000, etaAt: 120_000 + 3 * 60_000 };
    expect(buildPendingBridgeRows(late, 0)[1][1]).toMatchObject({ value: '~3 min' });
  });

  it('truncates the hash like the comp and links the source explorer', () => {
    const tx = buildPendingBridgeRows(base, 0)[2][1];
    expect(tx).toMatchObject({ value: '0xff9s...dsa6' });
    expect(tx.kind === 'link' && tx.href).toContain('etherscan.io/tx/');
  });
});

describe('formatBridgeDate', () => {
  it('formats as dd/MM/yy HH:mm UTC', () => {
    expect(formatBridgeDate(Date.UTC(2026, 9, 25, 15, 26))).toBe('25/10/26 15:26 UTC');
  });
});
