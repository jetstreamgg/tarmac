import { t } from '@lingui/core/macro';
import { revertMessage } from '@/lib/revertMessages';

/**
 * Friendly copy for the engine prepare/execution errors the retired
 * StUSDSWidget special-cased — shown inline under the modal rows. Native stUSDS
 * reverts (the module running short) and Curve slippage read as the revert
 * registry's copy, any other revert as its raw reason.
 */
export function stUsdsPrepareErrorMessage(error: Error | null | undefined): string | undefined {
  const message = error?.message;
  if (!message) return undefined;
  // Curve: pool-side liquidity
  if (message.includes('Insufficient balance')) {
    return t`The Curve pool does not have enough liquidity for this swap. Please try a smaller amount.`;
  }
  return revertMessage(error) ?? t`An error occurred while preparing the transaction`;
}
