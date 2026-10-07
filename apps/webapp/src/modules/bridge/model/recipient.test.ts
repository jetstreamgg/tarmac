import { describe, expect, it } from 'vitest';
import { isSameSafe, isValidRecipient, recipientRequirement } from './recipient';

describe('isValidRecipient', () => {
  it('accepts an EVM address and rejects junk on EVM', () => {
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'evm')).toBe(true);
    expect(isValidRecipient('0x123', 'evm')).toBe(false);
  });

  it('accepts a base58 Solana address and rejects an EVM one on Solana', () => {
    expect(isValidRecipient('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana')).toBe(true);
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'solana')).toBe(false);
  });
});

const A = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const B = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const C = '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E';
const safe = (owners: string[], threshold: number) => ({ owners, threshold });

describe('isSameSafe', () => {
  it('matches the same owners in any order and case with the same threshold', () => {
    expect(isSameSafe(safe([A, B], 2), safe([B.toLowerCase(), A], 2))).toBe(true);
  });

  it('rejects a different threshold, an extra owner or a swapped owner', () => {
    expect(isSameSafe(safe([A, B], 2), safe([A, B], 1))).toBe(false);
    expect(isSameSafe(safe([A, B], 2), safe([A, B, C], 2))).toBe(false);
    expect(isSameSafe(safe([A, B], 2), safe([A, C], 2))).toBe(false);
  });
});

describe('recipientRequirement', () => {
  const evm = { destinationFamily: 'evm' as const, recipient: undefined };

  it('a non-EVM destination needs a recipient', () => {
    expect(
      recipientRequirement({ destinationFamily: 'solana', recipient: undefined, safe: undefined })
    ).toEqual({
      required: true,
      reason: 'other-family'
    });
  });

  it('an explicit recipient always satisfies it', () => {
    expect(
      recipientRequirement({
        destinationFamily: 'evm',
        recipient: B,
        safe: { source: undefined, destination: null }
      })
    ).toEqual({ required: false });
  });

  it('a Safe typing its own address (any case) is still held to the same-Safe rule', () => {
    expect(
      recipientRequirement({
        destinationFamily: 'evm',
        sender: A,
        recipient: A.toLowerCase(),
        safe: { source: safe([B], 1), destination: null }
      })
    ).toEqual({ required: true, reason: 'safe-not-on-destination' });
  });

  it('an EOA sending to itself on EVM needs nothing', () => {
    expect(recipientRequirement({ ...evm, safe: undefined })).toEqual({ required: false });
  });

  it('a Safe can send to itself only when the same Safe exists on the destination', () => {
    const source = safe([A, B], 2);
    expect(recipientRequirement({ ...evm, safe: { source, destination: safe([B, A], 2) } })).toEqual({
      required: false
    });
    expect(recipientRequirement({ ...evm, safe: { source, destination: null } })).toEqual({
      required: true,
      reason: 'safe-not-on-destination'
    });
    expect(recipientRequirement({ ...evm, safe: { source, destination: safe([A], 1) } })).toEqual({
      required: true,
      reason: 'safe-differs'
    });
  });

  it('fails closed while either Safe is unknown (loading, error, no Safe service)', () => {
    const unverified = { required: true, reason: 'safe-unverified' };
    expect(recipientRequirement({ ...evm, safe: { source: undefined, destination: safe([A], 1) } })).toEqual(
      unverified
    );
    expect(recipientRequirement({ ...evm, safe: { source: safe([A], 1), destination: undefined } })).toEqual(
      unverified
    );
  });
});
