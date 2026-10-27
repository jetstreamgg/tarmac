import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

// stUSDS (StUsds), mainnet implementation 0x7A61B7adCFD493f7CF0F86dFCECB94b72c227F22.
// The liquidity copy is the stUSDS form's prepare mapper's, so the transaction
// screen reads the same when the revert lands after signing.
export const stUsdsRevertMessages: RevertMessageMap = {
  'StUsds/insufficient-unused-funds': msg`The module does not have enough available USDS for withdrawal. Please try a smaller amount or wait for liquidity to become available.`,
  'StUsds/mint-over-supply-cap': msg`stUSDS has reached its deposit cap. Try a smaller amount or try again later.`
};
