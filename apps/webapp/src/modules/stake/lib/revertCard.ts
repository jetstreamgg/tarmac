import { decodeRevert } from '@/lib/revertMessages/decodeRevert';

/** A stake takeover card a prepare failure can be about. */
export type StakeRevertCard = 'stake' | 'borrow' | 'delegate';

/**
 * The card whose input a revert is about: the reward picker sits in the stake
 * card, the risk rows in the borrow card. Reasons about the whole position
 * (an auction, the wrong urn) and unknown ones are left out.
 */
const cardByReason: Readonly<Record<string, StakeRevertCard>> = {
  'LockstakeEngine/farm-deleted': 'stake',
  'LockstakeEngine/farm-unsupported-or-deleted': 'stake',
  'LockstakeEngine/farm-unsupported': 'stake',
  'LockstakeEngine/same-farm': 'stake',
  'Sky/insufficient-balance': 'stake',
  'Sky/insufficient-allowance': 'stake',
  'Vat/not-safe': 'borrow',
  'Vat/dust': 'borrow',
  'Vat/ceiling-exceeded': 'borrow',
  'Usds/insufficient-balance': 'borrow',
  'Usds/insufficient-allowance': 'borrow',
  'LockstakeEngine/urn-unsafe': 'delegate',
  'LockstakeEngine/same-vote-delegate': 'delegate',
  'LockstakeEngine/not-valid-vote-delegate': 'delegate'
};

/** Which card a prepare failure belongs under, or `undefined` for the whole form. */
export function stakeRevertCard(error: unknown): StakeRevertCard | undefined {
  const reason = decodeRevert(error)?.reason;
  return reason !== undefined && Object.hasOwn(cardByReason, reason) ? cardByReason[reason] : undefined;
}
