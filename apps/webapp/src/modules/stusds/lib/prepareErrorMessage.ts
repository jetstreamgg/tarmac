import { t } from '@lingui/core/macro';

/**
 * Friendly copy for the engine prepare/execution errors the retired
 * StUSDSWidget special-cased — shown inline under the modal rows.
 */
export function stUsdsPrepareErrorMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  // Native stUSDS: module liquidity constrained
  if (message.includes('YUsds/insufficient-unused-funds')) {
    return t`The module does not have enough available USDS for withdrawal. Please try a smaller amount or wait for liquidity to become available.`;
  }
  // Curve: min-output slippage guard
  if (message.includes('Exchange resulted in fewer coins')) {
    return t`The swap would result in less output than the minimum acceptable amount. Try reducing the amount or waiting for better rates.`;
  }
  // Curve: pool-side liquidity
  if (message.includes('Insufficient balance')) {
    return t`The Curve pool does not have enough liquidity for this swap. Please try a smaller amount.`;
  }
  return t`An error occurred while preparing the transaction`;
}
