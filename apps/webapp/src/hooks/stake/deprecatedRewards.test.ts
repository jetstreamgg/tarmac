import { describe, expect, it } from 'vitest';
import {
  DEPRECATED_STAKE_REWARDS,
  isDeprecatedStakeReward,
  filterDeprecatedRewards
} from './deprecatedRewards';
import { lsSkySpkRewardAddress, lsSkyUsdsRewardAddress } from '../generated';

describe('Deprecated Stake Rewards', () => {
  const MAINNET_CHAIN_ID = 1;
  const TENDERLY_CHAIN_ID = 314310;

  // Known addresses from generated.ts
  const SPK_REWARD_ADDRESS_MAINNET = lsSkySpkRewardAddress[MAINNET_CHAIN_ID];
  const USDS_REWARD_ADDRESS_MAINNET = lsSkyUsdsRewardAddress[MAINNET_CHAIN_ID];
  const NON_DEPRECATED_ADDRESS = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  describe('DEPRECATED_STAKE_REWARDS', () => {
    it('should contain SPK and USDS reward addresses', () => {
      expect(DEPRECATED_STAKE_REWARDS).toHaveLength(2);
      expect(DEPRECATED_STAKE_REWARDS).toContain(lsSkyUsdsRewardAddress);
      expect(DEPRECATED_STAKE_REWARDS).toContain(lsSkySpkRewardAddress);
    });
  });

  describe('isDeprecatedStakeReward', () => {
    it('should return true for SPK reward address on mainnet', () => {
      expect(isDeprecatedStakeReward(SPK_REWARD_ADDRESS_MAINNET, MAINNET_CHAIN_ID)).toBe(true);
    });

    it('should return true for USDS reward address on mainnet', () => {
      expect(isDeprecatedStakeReward(USDS_REWARD_ADDRESS_MAINNET, MAINNET_CHAIN_ID)).toBe(true);
    });

    it('should return true for SPK reward address on tenderly', () => {
      const spkAddressTenderly = lsSkySpkRewardAddress[TENDERLY_CHAIN_ID];
      expect(isDeprecatedStakeReward(spkAddressTenderly, TENDERLY_CHAIN_ID)).toBe(true);
    });

    it('should return false for non-deprecated address', () => {
      expect(isDeprecatedStakeReward(NON_DEPRECATED_ADDRESS, MAINNET_CHAIN_ID)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const lowercaseAddress = SPK_REWARD_ADDRESS_MAINNET.toLowerCase() as `0x${string}`;
      const uppercaseAddress = SPK_REWARD_ADDRESS_MAINNET.toUpperCase() as `0x${string}`;

      expect(isDeprecatedStakeReward(lowercaseAddress, MAINNET_CHAIN_ID)).toBe(true);
      expect(isDeprecatedStakeReward(uppercaseAddress, MAINNET_CHAIN_ID)).toBe(true);
    });

    it('should return false for unknown chain ID', () => {
      const unknownChainId = 999999;
      expect(isDeprecatedStakeReward(SPK_REWARD_ADDRESS_MAINNET, unknownChainId)).toBe(false);
    });
  });

  describe('filterDeprecatedRewards', () => {
    const mockContracts = [
      { contractAddress: SPK_REWARD_ADDRESS_MAINNET, name: 'SPK Reward' },
      { contractAddress: USDS_REWARD_ADDRESS_MAINNET, name: 'USDS Reward' },
      { contractAddress: NON_DEPRECATED_ADDRESS, name: 'SKY Reward' }
    ];

    it('should filter out deprecated rewards', () => {
      const filtered = filterDeprecatedRewards(mockContracts, MAINNET_CHAIN_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('SKY Reward');
    });

    it('should keep non-deprecated rewards', () => {
      const nonDeprecatedOnly = [{ contractAddress: NON_DEPRECATED_ADDRESS, name: 'SKY Reward' }];

      const filtered = filterDeprecatedRewards(nonDeprecatedOnly, MAINNET_CHAIN_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].contractAddress).toBe(NON_DEPRECATED_ADDRESS);
    });

    it('should keep the keepAddress even if deprecated', () => {
      const filtered = filterDeprecatedRewards(mockContracts, MAINNET_CHAIN_ID, SPK_REWARD_ADDRESS_MAINNET);

      expect(filtered).toHaveLength(2);
      expect(filtered.some(c => c.contractAddress === SPK_REWARD_ADDRESS_MAINNET)).toBe(true);
      expect(filtered.some(c => c.contractAddress === NON_DEPRECATED_ADDRESS)).toBe(true);
    });

    it('should handle keepAddress case-insensitively', () => {
      const lowercaseKeepAddress = SPK_REWARD_ADDRESS_MAINNET.toLowerCase() as `0x${string}`;

      const filtered = filterDeprecatedRewards(mockContracts, MAINNET_CHAIN_ID, lowercaseKeepAddress);

      expect(filtered).toHaveLength(2);
      expect(filtered.some(c => c.contractAddress === SPK_REWARD_ADDRESS_MAINNET)).toBe(true);
    });

    it('should handle empty array', () => {
      const filtered = filterDeprecatedRewards([], MAINNET_CHAIN_ID);

      expect(filtered).toHaveLength(0);
    });

    it('should return empty array when all rewards are deprecated', () => {
      const deprecatedOnly = [
        { contractAddress: SPK_REWARD_ADDRESS_MAINNET, name: 'SPK Reward' },
        { contractAddress: USDS_REWARD_ADDRESS_MAINNET, name: 'USDS Reward' }
      ];

      const filtered = filterDeprecatedRewards(deprecatedOnly, MAINNET_CHAIN_ID);

      expect(filtered).toHaveLength(0);
    });

    it('should preserve contract properties', () => {
      const contractsWithExtraProps = [
        {
          contractAddress: NON_DEPRECATED_ADDRESS,
          name: 'SKY Reward',
          rewardToken: { symbol: 'SKY' },
          supplyToken: { symbol: 'SKY' }
        }
      ];

      const filtered = filterDeprecatedRewards(contractsWithExtraProps, MAINNET_CHAIN_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(contractsWithExtraProps[0]);
    });

    it('should work with tenderly chain ID', () => {
      const tenderlyContracts = [
        { contractAddress: lsSkySpkRewardAddress[TENDERLY_CHAIN_ID], name: 'SPK Reward' },
        { contractAddress: NON_DEPRECATED_ADDRESS, name: 'SKY Reward' }
      ];

      const filtered = filterDeprecatedRewards(tenderlyContracts, TENDERLY_CHAIN_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('SKY Reward');
    });
  });
});
