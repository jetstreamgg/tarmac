import { msg } from '@lingui/core/macro';
import { customError, customErrorMessage } from './customError';
import type { RevertMessageMap } from './types';

const noLiquidity = msg`The vault doesn't have enough available liquidity for this withdrawal right now. Try a smaller amount or try again later.`;
const capReached = msg`This vault has reached its deposit limit. Try a smaller amount or try again later.`;

// Morpho Vault V2, shared by every vault the app lists. A deposit is allocated
// straight to the vault's liquidity market and fails when that market's cap is
// full; a withdrawal larger than the idle balance pulls from the same market,
// and Morpho Blue (0xBBBB…EFFCb) bubbles up "insufficient liquidity" when it
// can't. `TransferReverted` replaces whatever the asset reverted with when the
// vault sends it: a short idle balance on a vault with no liquidity market
// (Flagship), but on USDC and USDT also a blacklisted receiver or a paused
// token, so its copy doesn't assume liquidity.
export const morphoVaultRevertMessages: RevertMessageMap = {
  ...customErrorMessage('AbsoluteCapExceeded()', capReached),
  ...customErrorMessage('RelativeCapExceeded()', capReached),
  ...customErrorMessage(
    'TransferReverted()',
    msg`The vault couldn't send the tokens for this withdrawal. If it's short on available liquidity, a smaller amount may go through; otherwise try again later.`
  ),
  'insufficient liquidity': noLiquidity
};

// A deposit whose pull of the user's tokens failed: their balance or allowance.
// The caps stay tracked: once one is full, every deposit fails.
export const morphoVaultInputRevertReasons: readonly string[] = customError('TransferFromReverted()');
