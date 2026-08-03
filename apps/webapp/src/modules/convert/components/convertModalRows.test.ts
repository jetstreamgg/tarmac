import { describe, expect, it } from 'vitest';
import { buildConvertModalRows } from './convertModalRows';

describe('buildConvertModalRows', () => {
  it('pins the grid: [Rate | Network], [Slippage | Fee], [Network fee] (Figma 1036:205509)', () => {
    const rows = buildConvertModalRows({
      originSymbol: 'USDS',
      targetSymbol: 'USDC',
      network: 'Ethereum',
      networkFee: '–'
    });

    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Rate', 'Network'],
      ['Slippage', 'Fee'],
      ['Network fee']
    ]);

    const [[rate, network], [slippage, fee], [networkFee]] = rows;
    expect(rate).toMatchObject({
      kind: 'pair',
      token: 'USDS',
      left: '1.00',
      right: '1.00',
      rightToken: 'USDC'
    });
    expect(network).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
    // PSM guarantees — static by design; the engine halts the flow if they'd be false.
    expect(slippage).toMatchObject({ kind: 'single', value: '0.00%' });
    expect(fee).toMatchObject({ kind: 'single', value: '$0.00' });
    expect(networkFee).toMatchObject({ kind: 'single', value: '–' });
  });

  it('icons the pair with the active direction tokens', () => {
    const [[rate]] = buildConvertModalRows({
      originSymbol: 'USDC',
      targetSymbol: 'USDS',
      network: 'Base',
      networkFee: '–'
    });
    expect(rate).toMatchObject({ kind: 'pair', token: 'USDC', rightToken: 'USDS' });
  });
});
