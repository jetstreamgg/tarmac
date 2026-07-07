import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { TransactionTypeEnum } from '@/hooks';
import { calculateClaimedRewardsUsd, liquidationDropPercent, rewardContractSymbols } from './positionDetail';

// lsSkySkyRewardAddress[1] — the mainnet SKY farm.
const SKY_FARM = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc';

describe('rewardContractSymbols', () => {
  it('maps the known mainnet reward contracts to their token symbols', () => {
    const symbols = rewardContractSymbols(1);
    expect(symbols[SKY_FARM.toLowerCase()]).toBe('SKY');
    expect(Object.values(symbols)).toEqual(expect.arrayContaining(['USDS', 'SPK', 'SKY']));
  });
});

describe('calculateClaimedRewardsUsd', () => {
  const priceOf = (symbol: string) => (symbol === 'SKY' ? 0.025 : 0);

  it('values STAKE_REWARD claim events through the known-contract map', () => {
    const history = [
      {
        type: TransactionTypeEnum.STAKE_REWARD,
        rewardContract: SKY_FARM,
        amount: parseUnits('1000', 18)
      },
      // Unknown contract → skipped rather than mispriced.
      {
        type: TransactionTypeEnum.STAKE_REWARD,
        rewardContract: '0x1111111111111111111111111111111111111111',
        amount: parseUnits('999', 18)
      },
      // Non-claim events ignored.
      { type: TransactionTypeEnum.STAKE, amount: parseUnits('5', 18) }
    ];
    expect(calculateClaimedRewardsUsd(history as never, 1, priceOf)).toBeCloseTo(25);
  });

  it('returns 0 for empty history', () => {
    expect(calculateClaimedRewardsUsd(undefined, 1, priceOf)).toBe(0);
  });
});

describe('liquidationDropPercent', () => {
  it('is the complement of the liquidation proximity, clamped to [0, 100]', () => {
    expect(liquidationDropPercent(52)).toBe(48);
    expect(liquidationDropPercent(0)).toBe(100);
    expect(liquidationDropPercent(120)).toBe(0);
    expect(liquidationDropPercent(undefined)).toBeNull();
  });
});
