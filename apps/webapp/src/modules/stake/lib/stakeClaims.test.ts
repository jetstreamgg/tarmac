import { describe, expect, it } from 'vitest';
import { groupClaimsByToken, tokenClaimToReward, urnClaimToReward, type StakeUrnClaim } from './stakeClaims';

const SKY_A = '0x5555555555555555555555555555555555555555';
const SKY_B = '0x7777777777777777777777777777777777777777';
const USDS = '0x6666666666666666666666666666666666666666';
const WAD = 10n ** 18n;

const claim = (urnIndex: bigint, contractAddress: `0x${string}`, whole: bigint, rewardSymbol: string) =>
  ({ urnIndex, contractAddress, claimBalance: whole * WAD, rewardSymbol }) satisfies StakeUrnClaim;

describe('groupClaimsByToken', () => {
  it('sums a token across urns and farms, SKY first', () => {
    const groups = groupClaimsByToken([
      claim(0n, USDS, 5n, 'USDS'),
      claim(0n, SKY_A, 1n, 'SKY'),
      claim(1n, SKY_A, 2n, 'SKY'),
      claim(1n, SKY_B, 4n, 'SKY')
    ]);

    expect(groups.map(g => g.rewardSymbol)).toEqual(['SKY', 'USDS']);
    expect(groups[0].claimBalance).toBe(7n * WAD);
    expect(groups[0].claims).toHaveLength(3);
    expect(groups[1].claimBalance).toBe(5n * WAD);
  });

  it('is empty for no claims', () => {
    expect(groupClaimsByToken([])).toEqual([]);
  });
});

describe('reward mapping', () => {
  const priceOf = (symbol: string) => (symbol === 'SKY' ? 0.05 : 1);

  it('keys a per-urn claim by urnIndex:contract', () => {
    const reward = urnClaimToReward(claim(2n, SKY_A, 3n, 'SKY'), priceOf, 1);
    expect(reward.id).toBe(`2:${SKY_A}`);
    expect(reward.formattedAmount).toBe('3.00');
    expect(reward.amountUsd).toBeCloseTo(0.15);
  });

  it('keys a token group by symbol with the summed amount', () => {
    const [group] = groupClaimsByToken([claim(0n, SKY_A, 1n, 'SKY'), claim(1n, SKY_A, 2n, 'SKY')]);
    const reward = tokenClaimToReward(group, priceOf, 1);
    expect(reward.id).toBe('SKY');
    expect(reward.amount).toBe(3);
    expect(reward.amountUsd).toBeCloseTo(0.15);
  });
});
