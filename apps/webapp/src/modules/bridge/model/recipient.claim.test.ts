import { describe, expect, it } from 'vitest';
import { claimsFromDestinationWallet } from './recipient';
import type { PendingBridge } from './types';

const SENDER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x00000000000000000000000000000000000b0b01';

const CCTP: Pick<PendingBridge, 'routeKind' | 'nextAction' | 'recipient'> = {
  routeKind: 'cctp',
  nextAction: 'claim',
  recipient: OTHER
};

describe('claimsFromDestinationWallet', () => {
  it("is true for a CCTP claim minting to another account than the wallet's", () => {
    expect(claimsFromDestinationWallet(CCTP, SENDER)).toBe(true);
  });

  it('is false for the recipient, in any case, and with no recipient set', () => {
    expect(claimsFromDestinationWallet(CCTP, OTHER.toUpperCase().replace('0X', '0x'))).toBe(false);
    expect(claimsFromDestinationWallet({ ...CCTP, recipient: undefined }, SENDER)).toBe(false);
    expect(
      claimsFromDestinationWallet({ ...CCTP, recipient: SENDER.toUpperCase().replace('0X', '0x') }, SENDER)
    ).toBe(false);
  });

  it('is false once there is no claim left, and for other routes', () => {
    expect(claimsFromDestinationWallet({ ...CCTP, nextAction: undefined }, SENDER)).toBe(false);
    expect(claimsFromDestinationWallet({ ...CCTP, routeKind: 'native' }, SENDER)).toBe(false);
  });

  it('holds with no wallet connected: nobody here can send it', () => {
    expect(claimsFromDestinationWallet(CCTP, undefined)).toBe(true);
  });
});
