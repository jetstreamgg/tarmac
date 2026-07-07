import { describe, expect, it } from 'vitest';
import { buildConvertModalRows } from './convertModalRows';

describe('buildConvertModalRows', () => {
  it('matches the Figma review-modal contract (486:32223): labels, order and values', () => {
    const rows = buildConvertModalRows({
      originSymbol: 'USDS',
      targetSymbol: 'USDC',
      network: 'Ethereum',
      networkFee: '–'
    });

    expect(rows).toEqual([
      { kind: 'rate', label: 'Rate', value: '1.00 USDS = 1.00 USDC' },
      { kind: 'network', label: 'Network', value: 'Ethereum' },
      { kind: 'plain', label: 'Slippage', value: '0.00%' },
      { kind: 'plain', label: 'Fee', value: '$0.00' },
      { kind: 'plain', label: 'Network fee', value: '–' }
    ]);
  });

  it('flips token symbols with the direction', () => {
    const rows = buildConvertModalRows({
      originSymbol: 'USDC',
      targetSymbol: 'USDS',
      network: 'Base',
      networkFee: '–'
    });

    expect(rows[0].value).toBe('1.00 USDC = 1.00 USDS');
    expect(rows[1].value).toBe('Base');
  });
});
