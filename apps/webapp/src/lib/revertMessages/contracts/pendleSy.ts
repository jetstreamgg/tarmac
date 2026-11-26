import { msg } from '@lingui/core/macro';
import { decodeRevert } from '../decodeRevert';
import { customErrorMessage } from './customError';
import type { RevertMessageMap } from './types';

// Pendle SYs built on TokenWithRateLimit (PT-sUSDS-27MAY2027's SY,
// 0x5e4cecc6676ef448f20822d2449bc1bde1432eb4). Selling PT and claiming a
// matured position both end by burning SY, which the SY's rate limiter
// (PendleRateLimiter) refuses whole once the burn is over what its meter has
// left; buying PT mints SY, which the SY refuses over its supply cap. The
// forms hold amounts under both (usePendleSyLimits), so these show when the
// limits move between that read and the simulation. The calls go through the
// Pendle router, whose ABI can't name either error: the selector is what
// matches.
export const pendleSyRevertMessages: RevertMessageMap = {
  ...customErrorMessage(
    'BurnLimitExceeded(address,address,uint256,uint256,bool)',
    msg`Pendle's withdrawal limit for this market is used up. Try a smaller amount or try again shortly.`
  ),
  ...customErrorMessage(
    'SupplyCapExceeded(uint256,uint256)',
    msg`This market has reached Pendle's deposit cap. Try a smaller amount.`
  )
};

/** Whether an error is the SY refusing over its burn limit or supply cap. */
export function isPendleSyLimitRevert(error: unknown): boolean {
  const reason = decodeRevert(error)?.reason;
  return reason !== undefined && Object.hasOwn(pendleSyRevertMessages, reason);
}
