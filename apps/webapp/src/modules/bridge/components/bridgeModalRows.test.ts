import { describe, expect, it } from 'vitest';
import { getMockRoute } from '../mocks/mockRoutes';
import { buildBridgeModalRows, formatEta } from './bridgeModalRows';

describe('buildBridgeModalRows', () => {
  it('pins the Figma grid: three rows of two cells', () => {
    const rows = buildBridgeModalRows({ route: getMockRoute('base', 'ethereum'), networkFee: '$0.10' });
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Bridge type', 'Bridge rate'],
      ['Estimated arrival', 'Slippage'],
      ['Bridge fee', 'Network fee']
    ]);
  });

  it('names the route and its arrival time', () => {
    const [[type], [eta]] = buildBridgeModalRows({ route: getMockRoute('ethereum', 'base'), networkFee: '' });
    expect(type).toMatchObject({ value: 'Native' });
    expect(eta).toMatchObject({ value: '~3 min' });
  });
});

describe('formatEta', () => {
  it('switches to hours past 60 minutes', () => {
    expect(formatEta(20)).toBe('~20 min');
    expect(formatEta(60)).toBe('~1 hr');
    expect(formatEta(90)).toBe('~1 hr 30 min');
  });
});
