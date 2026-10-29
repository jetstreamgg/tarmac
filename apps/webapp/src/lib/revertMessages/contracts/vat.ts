import { msg } from '@lingui/core/macro';
import type { RevertMessageMap } from './types';

// MCD Vat: the core accounting contract every borrow position settles through,
// so these surface from the Staking Engine's lock/free/draw/wipe.
export const vatRevertMessages: RevertMessageMap = {
  'Vat/not-safe': msg`This change would leave your position below the required collateralization ratio. Add collateral, borrow less, or repay more.`,
  'Vat/dust': msg`Your debt would fall below the minimum borrow amount. Borrow more, or repay your debt in full.`,
  'Vat/ceiling-exceeded': msg`The borrowing limit for this position type has been reached. Try a smaller amount or try again later.`
};

// Set by the borrow amount the user types: too much for the collateral, or under the minimum.
export const vatInputRevertReasons: readonly string[] = ['Vat/not-safe', 'Vat/dust'];
