import { t } from '@lingui/core/macro';
import { formatBigInt } from '@/utils';

// The vault simulation surfaces its dust-floor failure as a raw
// `formatUnits`-built string ("Minimum borrow amount is 30000"). The engine
// hook owns that message, so the module remaps it at display time to the
// localized, thousands-separated form the rest of the sheet uses.
const MIN_BORROW_PREFIX = 'Minimum borrow amount is ';

export function formatSimulationErrorMessage(
  message: string | undefined,
  dust: bigint | undefined
): string | undefined {
  if (message === undefined) return undefined;
  if (dust !== undefined && dust > 0n && message.startsWith(MIN_BORROW_PREFIX)) {
    return t`Minimum borrow amount is ${formatBigInt(dust)}`;
  }
  return message;
}
