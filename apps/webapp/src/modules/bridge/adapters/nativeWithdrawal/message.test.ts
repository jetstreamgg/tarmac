import { describe, expect, it } from 'vitest';
import { matchesBridge } from './message';

const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const OTHER = '0x00000000000000000000000000000000000000b2';
const bridge = { amount: 5n, account: ACCOUNT, recipient: undefined };

describe('matchesBridge', () => {
  it('matches a withdrawal of the amount to the account when the bridge names no recipient', () => {
    expect(matchesBridge({ amount: 5n, to: ACCOUNT }, bridge)).toBe(true);
  });

  it('matches the named recipient, whatever its case', () => {
    expect(
      matchesBridge(
        { amount: 5n, to: OTHER },
        { ...bridge, recipient: OTHER.toUpperCase().replace('0X', '0x') }
      )
    ).toBe(true);
    expect(matchesBridge({ amount: 5n, to: ACCOUNT }, { ...bridge, recipient: OTHER })).toBe(false);
  });

  it('refuses another amount, and no withdrawal at all', () => {
    expect(matchesBridge({ amount: 6n, to: ACCOUNT }, bridge)).toBe(false);
    expect(matchesBridge(undefined, bridge)).toBe(false);
  });
});
