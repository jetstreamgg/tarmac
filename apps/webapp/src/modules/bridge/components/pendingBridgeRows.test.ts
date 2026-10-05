import { describe, expect, it } from 'vitest';
import type { PendingBridge } from '../model/types';
import { buildPendingBridgeRows, formatBridgeDate } from './pendingBridgeRows';

const base: PendingBridge = {
  id: '0xabc',
  amount: 10_000n * 10n ** 18n,
  token: 'USDS',
  from: 'ethereum',
  to: 'base',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: false,
  startedAt: 0,
  etaAt: 3 * 60_000,
  txHash: '0xff9s000000000000000000000000000000000000000000000000000000dsa6'
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
