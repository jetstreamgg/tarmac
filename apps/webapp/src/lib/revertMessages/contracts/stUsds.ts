import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

// stUSDS (StUsds), mainnet implementation 0x7A61B7adCFD493f7CF0F86dFCECB94b72c227F22.
export const stUsdsRevertMessages: RevertMessageMap = {
  'StUsds/insufficient-unused-funds': msg`The module does not have enough available USDS for withdrawal. Please try a smaller amount or wait for liquidity to become available.`,
  'StUsds/mint-over-supply-cap': msg`stUSDS has reached its deposit cap. Try a smaller amount or try again later.`
};
