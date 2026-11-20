import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

// Solidity's own checks (`Panic(uint256)`), which any contract can raise. Only
// the codes an amount can trigger get copy; the rest (a failed `assert`, an
// out-of-bounds index) point at a bug and show verbatim.
export const panicRevertMessages: RevertMessageMap = {
  'Panic(0x11)': msg`The contract can't process this amount. Try a smaller amount.`,
  'Panic(0x12)': msg`The contract can't process this amount right now. Try a different amount.`
};
