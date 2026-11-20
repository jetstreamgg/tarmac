import { describe, expect, it } from 'vitest';
import { stakeRevertCard } from './revertCard';

const revert = (reason: string) => new Error(`execution reverted: ${reason}`);

describe('stakeRevertCard', () => {
  it('puts each revert under the card whose input caused it', () => {
    expect(stakeRevertCard(revert('LockstakeEngine/farm-deleted'))).toBe('stake');
    expect(stakeRevertCard(revert('LockstakeEngine/farm-unsupported-or-deleted'))).toBe('stake');
    expect(stakeRevertCard(revert('This action cannot be performed while the contract is paused'))).toBe(
      'stake'
    );
    expect(stakeRevertCard(revert('Vat/dust'))).toBe('borrow');
    expect(stakeRevertCard(revert('LockstakeEngine/urn-unsafe'))).toBe('delegate');
  });

  it('leaves reverts about the whole position, unknown ones and non-reverts to the form', () => {
    expect(stakeRevertCard(revert('LockstakeEngine/urn-in-auction'))).toBeUndefined();
    expect(stakeRevertCard(revert('Foo/bar'))).toBeUndefined();
    expect(stakeRevertCard(revert('constructor'))).toBeUndefined();
    expect(stakeRevertCard(new Error('HTTP request failed'))).toBeUndefined();
    expect(stakeRevertCard(null)).toBeUndefined();
  });
});
