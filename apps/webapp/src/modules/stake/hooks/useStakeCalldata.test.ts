import { describe, expect, it } from 'vitest';
import { getStakeLockCalldata } from '@/hooks';
import { calculateStakeApprovalAmounts, generateStakeCalldata } from './useStakeCalldata';

const OWNER = '0x1111111111111111111111111111111111111111' as const;
const URN_INDEX = 0n;

describe('calculateStakeApprovalAmounts', () => {
  describe('lockAmount', () => {
    it('is skyToLock alone when restake is off', () => {
      const { lockAmount } = calculateStakeApprovalAmounts({
        skyToLock: 1_000_000n,
        restakeSkyRewards: false,
        restakeSkyAmount: 250_000n,
        isSkyRewardPosition: true,
        usdsToWipe: 0n,
        wipeAll: false
      });
      expect(lockAmount).toBe(1_000_000n);
    });

    it('adds the restake amount only when BOTH restakeSkyRewards and isSkyRewardPosition are true', () => {
      const { lockAmount } = calculateStakeApprovalAmounts({
        skyToLock: 1_000_000n,
        restakeSkyRewards: true,
        restakeSkyAmount: 250_000n,
        isSkyRewardPosition: true,
        usdsToWipe: 0n,
        wipeAll: false
      });
      expect(lockAmount).toBe(1_250_000n);
    });

    it('does NOT add the restake amount when restakeSkyRewards is true but isSkyRewardPosition is false', () => {
      const { lockAmount } = calculateStakeApprovalAmounts({
        skyToLock: 1_000_000n,
        restakeSkyRewards: true,
        restakeSkyAmount: 250_000n,
        isSkyRewardPosition: false,
        usdsToWipe: 0n,
        wipeAll: false
      });
      expect(lockAmount).toBe(1_000_000n);
    });

    it('does NOT add the restake amount when isSkyRewardPosition is true but restakeSkyRewards is false', () => {
      const { lockAmount } = calculateStakeApprovalAmounts({
        skyToLock: 1_000_000n,
        restakeSkyRewards: false,
        restakeSkyAmount: 250_000n,
        isSkyRewardPosition: true,
        usdsToWipe: 0n,
        wipeAll: false
      });
      expect(lockAmount).toBe(1_000_000n);
    });
  });

  describe('usdsAmount (wipe-all repay buffer)', () => {
    it('applies the 0.005% buffer only when wipeAll is true and usdsToWipe is non-zero', () => {
      const { usdsAmount } = calculateStakeApprovalAmounts({
        skyToLock: 0n,
        restakeSkyRewards: false,
        restakeSkyAmount: 0n,
        isSkyRewardPosition: false,
        usdsToWipe: 100_000n,
        wipeAll: true
      });
      // 100_000 * 100005 / 100000 = 100_005
      expect(usdsAmount).toBe(100_005n);
    });

    it('passes usdsToWipe through unbuffered on a plain (non-wipeAll) repay', () => {
      const { usdsAmount } = calculateStakeApprovalAmounts({
        skyToLock: 0n,
        restakeSkyRewards: false,
        restakeSkyAmount: 0n,
        isSkyRewardPosition: false,
        usdsToWipe: 100_000n,
        wipeAll: false
      });
      expect(usdsAmount).toBe(100_000n);
    });

    it('short-circuits to 0n when wipeAll is true but usdsToWipe is 0n (legacy falsy guard)', () => {
      const { usdsAmount } = calculateStakeApprovalAmounts({
        skyToLock: 0n,
        restakeSkyRewards: false,
        restakeSkyAmount: 0n,
        isSkyRewardPosition: false,
        usdsToWipe: 0n,
        wipeAll: true
      });
      expect(usdsAmount).toBe(0n);
    });

    it('floors via integer bigint division (multiplication before division)', () => {
      const { usdsAmount } = calculateStakeApprovalAmounts({
        skyToLock: 0n,
        restakeSkyRewards: false,
        restakeSkyAmount: 0n,
        isSkyRewardPosition: false,
        usdsToWipe: 1n,
        wipeAll: true
      });
      // 1 * 100005 / 100000 = 100005 / 100000 = 1 (floored). Reordering to
      // (1 / 100000) * 100005 would yield 0 — the order of operations matters.
      expect(usdsAmount).toBe(1n);
    });
  });

  it('lock term asymmetry vs generateStakeCalldata: approval math guards the restake addend with isSkyRewardPosition, the calldata lock term does NOT (PRD Decision 6)', () => {
    const params = {
      skyToLock: 1_000_000n,
      restakeSkyRewards: true,
      restakeSkyAmount: 250_000n,
      restakeSkyAmount_isRewardPosition: false
    };

    // Approval math: guard fails (isSkyRewardPosition=false) → restake dropped.
    const { lockAmount } = calculateStakeApprovalAmounts({
      skyToLock: params.skyToLock,
      restakeSkyRewards: params.restakeSkyRewards,
      restakeSkyAmount: params.restakeSkyAmount,
      isSkyRewardPosition: false,
      usdsToWipe: 0n,
      wipeAll: false
    });
    expect(lockAmount).toBe(1_000_000n);

    // Calldata lock term: no isSkyRewardPosition guard → restake included.
    const calldata = generateStakeCalldata({
      flow: 'open',
      ownerAddress: OWNER,
      urnIndex: URN_INDEX,
      urnAddress: undefined,
      skyToLock: params.skyToLock,
      skyToFree: 0n,
      usdsToWipe: 0n,
      wipeAll: false,
      usdsToBorrow: 0n,
      selectedRewardContract: undefined,
      selectedDelegate: undefined,
      urnSelectedRewardContract: undefined,
      urnSelectedVoteDelegate: undefined,
      rewardContractsToClaim: undefined,
      restakeSkyRewards: params.restakeSkyRewards,
      restakeSkyAmount: params.restakeSkyAmount
    });
    const calldataLockOnLarger = getStakeLockCalldata({
      ownerAddress: OWNER,
      urnIndex: URN_INDEX,
      amount: 1_250_000n,
      refCode: 0
    });
    expect(calldata).toContain(calldataLockOnLarger);

    // The two disagree: approval approves 1.0M, calldata locks 1.25M.
    const approvalLock = getStakeLockCalldata({
      ownerAddress: OWNER,
      urnIndex: URN_INDEX,
      amount: lockAmount,
      refCode: 0
    });
    expect(approvalLock).not.toBe(calldataLockOnLarger);
  });
});
