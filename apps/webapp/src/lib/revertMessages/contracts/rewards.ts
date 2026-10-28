import { msg } from '@lingui/core/macro';
import { customErrorMessage } from './customError';
import type { RevertMessageMap } from './types';

// Synthetix StakingRewards, the source of every USDS and Staking Engine reward
// farm. Only `stake` is pausable; the Staking Engine's lock stakes into the
// position's farm, so a paused farm blocks adding SKY too.
export const stakingRewardsRevertMessages: RevertMessageMap = {
  'This action cannot be performed while the contract is paused': msg`This reward is paused and isn't accepting deposits right now. You can still withdraw and claim.`
};

// Merkl Distributor (Morpho rewards), behind proxy 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae.
// A proof built against a root that has since been replaced no longer verifies.
export const merklDistributorRevertMessages: RevertMessageMap = {
  ...customErrorMessage(
    'InvalidProof()',
    msg`Your rewards were just updated. Refresh the page to load the latest amounts, then claim again.`
  )
};
