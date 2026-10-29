import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

// LockstakeEngine (Staking Engine), mainnet 0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3.
// Reasons as written in its `require`s; `multicall` bubbles them up unchanged.
export const lockstakeEngineRevertMessages: RevertMessageMap = {
  'LockstakeEngine/urn-unsafe': msg`Your position is below the required collateralization ratio. Add collateral or repay debt before changing your delegate.`,
  'LockstakeEngine/urn-in-auction': msg`This position is being liquidated and can't be changed until the auction ends.`,
  'LockstakeEngine/farm-unsupported-or-deleted': msg`The selected reward is no longer available. Choose a different reward.`,
  'LockstakeEngine/farm-deleted': msg`Your position's current reward has been retired. Select a different reward before adding SKY.`,
  'LockstakeEngine/farm-unsupported': msg`This reward isn't supported, so it can't be claimed.`,
  'LockstakeEngine/same-vote-delegate': msg`This delegate is already selected for your position.`,
  'LockstakeEngine/same-farm': msg`This reward is already selected for your position.`,
  'LockstakeEngine/not-valid-vote-delegate': msg`The selected delegate isn't a valid Sky delegate. Choose a different one.`,
  'LockstakeEngine/urn-not-authorized': msg`This wallet isn't authorized to manage this position.`,
  'LockstakeEngine/invalid-urn': msg`This position doesn't exist. Refresh the page and try again.`,
  'LockstakeEngine/wrong-urn-index': msg`Your position list is out of date. Refresh the page and try again.`
};
