import { t } from '@lingui/core/macro';
import { formatBigInt } from '@/utils';

// The vault simulation surfaces its dust-floor failure as a raw
// `formatUnits`-built string ("Minimum borrow amount is 30000"). The engine
// hook owns that message, so the module remaps it at display time to the
// localized, thousands-separated form the rest of the sheet uses.
const MIN_BORROW_PREFIX = 'Minimum borrow amount is ';

export function formatSimulationErrorMessage(
  message: string | undefined,
  dust: bigint | undefined,
  /**
   * The staged borrow/wipe amount the message sits next to. At 0 the amount
   * cannot be the problem — the simulation only errors then when an underlying
   * chain read failed, which `useSimulatedVault` mislabels as "Insufficient
   * collateral" — so the amount-shaped copy is replaced with a truthful
   * generic message. Omit it to keep the raw pass-through.
   */
  stagedAmount?: bigint
): string | undefined {
  if (message === undefined) return undefined;
  if (stagedAmount === 0n) {
    return t`Unable to simulate the transaction. Please try again.`;
  }
  if (dust !== undefined && dust > 0n && message.startsWith(MIN_BORROW_PREFIX)) {
    return t`Minimum borrow amount is ${formatBigInt(dust)}`;
  }
  return message;
}
