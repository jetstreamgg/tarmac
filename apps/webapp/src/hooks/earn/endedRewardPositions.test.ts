import { describe, expect, it } from 'vitest';
import type { RewardContract } from '../rewards/rewards';
import { deriveEndedRewardPositions } from './endedRewardPositions';

const SKY_FARM = {
  contractAddress: '0x0650CAF159C5A49f711e8169D4336ECB9b950275',
  chainId: 1,
  supplyToken: { symbol: 'USDS' },
  rewardToken: { symbol: 'SKY' },
  name: 'Earn SKY'
} as unknown as RewardContract;
const SPK_FARM = {
  contractAddress: '0x173e314C7635B45322cd8Cb14f44b312e079F3af',
  chainId: 1,
  supplyToken: { symbol: 'USDS' },
  rewardToken: { symbol: 'SPK' },
  name: 'Earn SPK'
} as unknown as RewardContract;

// Balances are read over EVERY farm, live ones first here; the deprecated
// farm's entry is the second slot.
const ALL = [SPK_FARM, SKY_FARM];
const DEPRECATED = [SKY_FARM];
const CHARTS = [[{ totalSupplied: '9630000', rate: '0', blockTimestamp: 1 }]] as never;

describe('deriveEndedRewardPositions', () => {
  it('describes a deprecated farm with a balance by its registry descriptor, with the farm TVL', () => {
    const positions = deriveEndedRewardPositions({
      allContracts: ALL,
      deprecatedContracts: DEPRECATED,
      balances: [{ result: 0n }, { result: 15n * 10n ** 18n }],
      charts: CHARTS,
      familyChainIds: [1]
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].contract).toBe(SKY_FARM);
    expect(positions[0].balance).toBe(15n * 10n ** 18n);
    expect(positions[0].tvlUsds).toBe(9630000);
    // The same descriptor a live farm row is built from.
    expect(positions[0].product).toMatchObject({
      kind: 'rewards',
      riskProfile: 'rewards-sky',
      supplyTokens: ['USDS'],
      networks: [1]
    });
    expect(positions[0].product.detailPath).toContain(SKY_FARM.contractAddress);
  });

  it('ignores a live farm with a balance and a deprecated farm without one', () => {
    expect(
      deriveEndedRewardPositions({
        allContracts: ALL,
        deprecatedContracts: DEPRECATED,
        balances: [{ result: 15n * 10n ** 18n }, { result: 0n }],
        charts: CHARTS,
        familyChainIds: [1]
      })
    ).toEqual([]);
  });

  it('reports the position without a TVL while the series is unresolved, and nothing before balances land', () => {
    const [position] = deriveEndedRewardPositions({
      allContracts: ALL,
      deprecatedContracts: DEPRECATED,
      balances: [{ result: 0n }, { result: 1n }],
      charts: undefined,
      familyChainIds: [1]
    });
    expect(position.tvlUsds).toBeUndefined();
    expect(
      deriveEndedRewardPositions({
        allContracts: ALL,
        deprecatedContracts: DEPRECATED,
        balances: undefined,
        charts: CHARTS,
        familyChainIds: [1]
      })
    ).toEqual([]);
  });
});
