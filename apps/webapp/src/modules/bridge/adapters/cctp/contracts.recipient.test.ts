import { describe, expect, it } from 'vitest';
import { isBlockedRecipient } from '../../model/recipient';
import { NATIVE_DEPOSIT_CONTRACTS } from '../nativeDeposit/contracts';
import { cctpBurnCalls } from './calls';
import { assertCctpRecipient, CCTP_CONTRACTS, L1_USDS } from './contracts';

const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

// A burn's USDC minted on Ethereum to a token or bridge contract is stuck there.
describe('assertCctpRecipient', () => {
  it('refuses every contract the form blocks as a recipient', () => {
    for (const address of [...CCTP_CONTRACTS, ...NATIVE_DEPOSIT_CONTRACTS]) {
      expect(isBlockedRecipient(address)).toBe(true);
      expect(() => assertCctpRecipient(address), address).toThrow();
    }
  });

  it('builds no burn to L1 USDS, with or without the swap', () => {
    const build = (swap: boolean) =>
      cctpBurnCalls({
        network: 'base',
        amount: 250n * 10n ** 18n,
        account: ACCOUNT,
        mintRecipient: L1_USDS,
        usdsAllowance: 0n,
        usdcAllowance: 0n,
        swap
      });
    expect(() => build(true)).toThrow();
    expect(() => build(false)).toThrow();
  });

  it('accepts an ordinary account', () => {
    expect(() => assertCctpRecipient(ACCOUNT)).not.toThrow();
  });
});
