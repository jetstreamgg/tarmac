import { describe, expect, it } from 'vitest';
import { buildUpgradeModalRows } from './upgradeModalRows';

const base = {
  sourceToken: 'DAI',
  targetToken: 'USDS',
  targetRate: '1.00',
  receiveAmount: '10,000.00',
  network: 'Ethereum',
  networkFee: '–'
};

describe('buildUpgradeModalRows', () => {
  it('pins the DAI grid: [Rate | You’ll receive], [Network], [Network fee] (Figma 1310:130712)', () => {
    const rows = buildUpgradeModalRows(base);

    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Rate', "You'll receive"],
      ['Network'],
      ['Network fee']
    ]);

    const [[rate, receive], [network], [fee]] = rows;
    expect(rate).toMatchObject({
      kind: 'pair',
      token: 'DAI',
      left: '1.00',
      right: '1.00',
      rightToken: 'USDS'
    });
    expect(receive).toMatchObject({ kind: 'single', value: '10,000.00', token: 'USDS' });
    expect(network).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
    expect(fee).toMatchObject({ kind: 'single', value: '–' });
  });

  it('pairs [Penalty ⓘ | Network] on the MKR grid (Figma 1310:130760)', () => {
    const penaltyInfo = 'popover-stand-in';
    const rows = buildUpgradeModalRows({
      ...base,
      sourceToken: 'MKR',
      targetToken: 'SKY',
      targetRate: '24,000.00',
      receiveAmount: '9,000.00',
      penalty: '4.00%',
      penaltyInfo
    });

    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Rate', "You'll receive"],
      ['Penalty', 'Network'],
      ['Network fee']
    ]);

    const [[rate], [penalty, network]] = rows;
    expect(rate).toMatchObject({ kind: 'pair', token: 'MKR', right: '24,000.00', rightToken: 'SKY' });
    expect(penalty).toMatchObject({ kind: 'single', value: '4.00%', labelAction: penaltyInfo });
    expect(network).toMatchObject({ kind: 'single', value: 'Ethereum', network: true });
  });
});
