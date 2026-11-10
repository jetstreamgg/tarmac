import { msg } from '@lingui/core/macro';
import { customErrorMessage } from './customError';
import type { RevertMessageMap } from './types';

// Synthetix StakingRewards, the source of every USDS and Staking Engine reward
// farm. Only `stake` is pausable; the Staking Engine's lock stakes into the
// position's farm, so a paused farm blocks adding SKY too.
export const stakingRewardsPausedReason = 'This action cannot be performed while the contract is paused';

export const stakingRewardsRevertMessages: RevertMessageMap = {
  [stakingRewardsPausedReason]: msg`This reward is paused and isn't accepting deposits right now. Choose a different reward to deposit; you can still withdraw and claim.`
};

// Merkl Distributor (Morpho rewards), called through proxy 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae
// with the implementation's ABI, which declares the error.
// A proof built against a root that has since been replaced no longer verifies.
export const merklDistributorRevertMessages: RevertMessageMap = {
  ...customErrorMessage(
    'InvalidProof()',
    msg`Your rewards were just updated. Refresh the page to load the latest amounts, then claim again.`
  )
};
