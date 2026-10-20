import { describe, expect, it } from 'vitest';
import { getAddress, zeroHash, type Hex, type Log } from 'viem';
import { cctpL2Contracts, TOKEN_MESSENGER_V2 } from './contracts';
import {
  BASE_BURN_AMOUNT,
  BASE_BURN_ATTESTED,
  BASE_BURN_LOGS,
  BASE_BURN_MINT_RECIPIENT,
  BASE_BURN_TX
} from './cctpFixtures';
import {
  decodeCctpMessage,
  isAttestedCopy,
  isExpectedBurn,
  sourceBurnMessages,
  type CctpBurnExpectation
} from './message';

const EXPECTED: CctpBurnExpectation = {
  from: 'base',
  amount: BASE_BURN_AMOUNT * 10n ** 12n,
  sender: getAddress(BASE_BURN_TX.from),
  mintRecipient: getAddress(BASE_BURN_MINT_RECIPIENT)
};

/** Overwrites `bytes` at byte `offset` of a message. */
const patch = (message: Hex, offset: number, bytes: string) =>
  `${message.slice(0, 2 + offset * 2)}${bytes}${message.slice(2 + offset * 2 + bytes.length)}` as Hex;
const word = (value: bigint | number) => BigInt(value).toString(16).padStart(64, '0');

const SOURCE = sourceBurnMessages(BASE_BURN_LOGS, EXPECTED)[0];

describe('decodeCctpMessage (golden: the attested Base burn)', () => {
  it('reads every field Iris decoded for it', () => {
    const message = decodeCctpMessage(BASE_BURN_ATTESTED.message);
    expect(message).toEqual({
      version: 1,
      sourceDomain: 6,
      destinationDomain: 0,
      nonce: BASE_BURN_ATTESTED.nonce,
      sender: `0x${'0'.repeat(24)}${TOKEN_MESSENGER_V2.slice(2).toLowerCase()}`,
      recipient: `0x${'0'.repeat(24)}${TOKEN_MESSENGER_V2.slice(2).toLowerCase()}`,
      destinationCaller: zeroHash,
      minFinalityThreshold: 2000,
      finalityThresholdExecuted: 2000,
      body: {
        version: 1,
        burnToken: cctpL2Contracts('base').usdc,
        mintRecipient: getAddress(BASE_BURN_MINT_RECIPIENT),
        amount: BASE_BURN_AMOUNT,
        messageSender: getAddress(BASE_BURN_TX.from),
        maxFee: 0n,
        feeExecuted: 0n,
        expirationBlock: 0n,
        hookData: '0x'
      }
    });
  });

  it('throws on anything shorter than a burn message', () => {
    expect(() => decodeCctpMessage(BASE_BURN_ATTESTED.message.slice(0, -2) as Hex)).toThrow();
  });
});

describe('sourceBurnMessages', () => {
  it("finds the burn's MessageSent, which has no nonce yet", () => {
    expect(sourceBurnMessages(BASE_BURN_LOGS, EXPECTED)).toHaveLength(1);
    expect(decodeCctpMessage(SOURCE).nonce).toBe(zeroHash);
  });

  it.each([
    ['another amount', { amount: EXPECTED.amount + 10n ** 12n }],
    ['another sender', { sender: getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F') }],
    ['another recipient', { mintRecipient: getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F') }],
    ['another source chain', { from: 'optimism' as const }]
  ])('finds nothing for %s', (_, change) => {
    expect(sourceBurnMessages(BASE_BURN_LOGS, { ...EXPECTED, ...change })).toEqual([]);
  });

  it('ignores a MessageSent from any other contract', () => {
    const logs = BASE_BURN_LOGS.map(log => ({ ...log, address: TOKEN_MESSENGER_V2 })) as Log[];
    expect(sourceBurnMessages(logs, EXPECTED)).toEqual([]);
  });

  it.each([
    ['a fast transfer', 140, '000003e8'],
    ['a fee', 148 + 132, word(1)],
    ['a destination caller', 108, word(1)],
    ['another destination', 8, '00000002'],
    ['another burn token', 148 + 4, word(BigInt(cctpL2Contracts('base').usds))]
  ])('refuses a burn with %s', (_, offset, bytes) => {
    expect(isExpectedBurn(decodeCctpMessage(patch(SOURCE, offset, bytes)), EXPECTED)).toBe(false);
  });

  it('refuses a burn with hook data', () => {
    expect(isExpectedBurn(decodeCctpMessage(`${SOURCE}00` as Hex), EXPECTED)).toBe(false);
  });
});

describe('isAttestedCopy', () => {
  it("accepts Circle's attested copy of the source message", () => {
    expect(isAttestedCopy(BASE_BURN_ATTESTED.message, SOURCE)).toBe(true);
  });

  it('accepts an expiration block set by the attestation', () => {
    expect(isAttestedCopy(patch(BASE_BURN_ATTESTED.message, 148 + 196, word(1)), SOURCE)).toBe(true);
  });

  it('refuses the source message itself: its nonce is zero, which usedNonces reads as used', () => {
    expect(isAttestedCopy(SOURCE, SOURCE)).toBe(false);
  });

  it.each([
    ['another recipient', 148 + 36, word(1n << 100n)],
    ['another amount', 148 + 68, word(BASE_BURN_AMOUNT + 1n)],
    ['another sender', 148 + 100, word(1n << 100n)],
    ['another source domain', 4, '00000002'],
    ['a fee taken', 148 + 164, word(1)],
    ['a fast finality', 144, '000003e8']
  ])('refuses an attested message with %s', (_, offset, bytes) => {
    expect(isAttestedCopy(patch(BASE_BURN_ATTESTED.message, offset, bytes), SOURCE)).toBe(false);
  });

  it('refuses a message of another length', () => {
    expect(isAttestedCopy(`${BASE_BURN_ATTESTED.message}00` as Hex, SOURCE)).toBe(false);
  });
});
