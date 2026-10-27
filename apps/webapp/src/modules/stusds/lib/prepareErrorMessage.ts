import { t } from '@lingui/core/macro';
import { revertMessage } from '@/lib/revertMessages';

/**
 * Friendly copy for the engine prepare/execution errors the retired
 * StUSDSWidget special-cased — shown inline under the modal rows. Native stUSDS
 * reverts (the module running short) read as the revert registry's copy, any
 * other revert as its raw reason.
 */
export function stUsdsPrepareErrorMessage(error: Error | null | undefined): string | undefined {
  const message = error?.message;
  if (!message) return undefined;
  // Curve: min-output slippage guard
  if (message.includes('Exchange resulted in fewer coins')) {
    return t`The swap would result in less output than the minimum acceptable amount. Try reducing the amount or waiting for better rates.`;
  }
  // Curve: pool-side liquidity
  if (message.includes('Insufficient balance')) {
    return t`The Curve pool does not have enough liquidity for this swap. Please try a smaller amount.`;
  }
  return revertMessage(error) ?? t`An error occurred while preparing the transaction`;
}
