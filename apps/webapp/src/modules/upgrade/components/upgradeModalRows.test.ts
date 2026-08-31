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

  it('holds Penalty and You’ll receive behind skeletons while the fee read is in flight (APP-491)', () => {
    // An unresolved fee computes as 0n: the penalty formats to "0.00%" and the
    // receive amount to the gross figure — both wrong data, so the cells must
    // carry the loading flag until the read lands.
    const rows = buildUpgradeModalRows({
      ...base,
      sourceToken: 'MKR',
      targetToken: 'SKY',
      targetRate: '24,000.00',
      receiveAmount: '240,000.00',
      penalty: '0.00%',
      feeLoading: true
    });

    const [[, receive], [penalty, network]] = rows;
    expect(receive.loading).toBe(true);
    expect(penalty.loading).toBe(true);
    // The fee read only feeds those two cells — the rest stay live.
    expect(network.loading).toBeUndefined();

    const resolved = buildUpgradeModalRows({
      ...base,
      sourceToken: 'MKR',
      targetToken: 'SKY',
      targetRate: '24,000.00',
      receiveAmount: '9,000.00',
      penalty: '4.00%',
      feeLoading: false
    });
    expect(resolved[0][1]).toMatchObject({ value: '9,000.00', loading: false });
    expect(resolved[1][0]).toMatchObject({ value: '4.00%', loading: false });
  });
});
