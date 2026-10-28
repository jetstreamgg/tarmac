import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

const priceMoved = msg`The price moved before your swap went through, so you'd receive less than your minimum. Review the new quote and try again.`;

// Curve stUSDS/USDS pool (stableswap-ng), mainnet 0x2C7C98A3b1582D83c43987202aEFf638312478aE:
// `exchange` below `min_dy`.
export const curveStUsdsUsdsPoolRevertMessages: RevertMessageMap = {
  'Exchange resulted in fewer coins than expected': priceMoved
};

// Spark PSM3 on L2s: USDS/USDC to sUSDS follows the sUSDS rate, which moves every block.
export const psm3RevertMessages: RevertMessageMap = {
  'PSM3/amountOut-too-low': priceMoved,
  'PSM3/amountIn-too-high': msg`The rate changed, so this swap would cost more than your maximum. Review the new quote and try again.`
};

// UsdsPsmWrapper, mainnet 0xA188EEC8F81263234dA3622A406892F3D630f98c. `sellGem`
// calls the Lite PSM (0xf6e72Db5454dd049d0788e411b06CfAF16853042) first, so its
// halt check reaches the user unchanged. `buyGem` multiplies by `tout` before
// calling it, and a halted `tout` (max uint) overflows there instead: that
// direction only ever shows `Panic(0x11)`, and the forms gate it beforehand.
export const usdsPsmWrapperRevertMessages: RevertMessageMap = {
  'DssLitePsm/sell-gem-halted': msg`Converting USDC to USDS is paused right now. Try again later.`
};
