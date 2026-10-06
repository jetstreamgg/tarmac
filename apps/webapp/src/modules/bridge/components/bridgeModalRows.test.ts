import { describe, expect, it } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRoute } from '../model/types';
import { buildBridgeModalRows, formatEta } from './bridgeModalRows';

const routeFor = (from: BridgeNetworkId, to: BridgeNetworkId): BridgeRoute => {
  const result = resolveBridgeRoute({ from, to, amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.route;
};

describe('buildBridgeModalRows', () => {
  it('pins the Figma grid: three rows of two cells', () => {
    const rows = buildBridgeModalRows({ route: routeFor('base', 'ethereum'), networkFee: '$0.10' });
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Bridge type', 'Bridge rate'],
      ['Estimated arrival', 'Slippage'],
      ['Bridge fee', 'Network fee']
    ]);
  });

  it('names the route and its arrival time', () => {
    const [[type], [eta]] = buildBridgeModalRows({ route: routeFor('ethereum', 'base'), networkFee: '' });
    expect(type).toMatchObject({ value: 'Native' });
    expect(eta).toMatchObject({ value: '~3 min' });
  });

  it('shows no bridge fee until the route quotes one', () => {
    const [, , [fee]] = buildBridgeModalRows({ route: routeFor('ethereum', 'avalanche'), networkFee: '' });
    expect(fee).toMatchObject({ value: NO_VALUE });
  });
});

describe('formatEta', () => {
  it('switches to hours past 60 minutes', () => {
    expect(formatEta(20)).toBe('~20 min');
    expect(formatEta(60)).toBe('~1 hr');
    expect(formatEta(90)).toBe('~1 hr 30 min');
  });

  it('switches to days for multi-day withdrawals', () => {
    expect(formatEta(7 * 24 * 60)).toBe('~7 days');
    expect(formatEta(Math.round(6.4 * 24 * 60))).toBe('~6.4 days');
  });
});
