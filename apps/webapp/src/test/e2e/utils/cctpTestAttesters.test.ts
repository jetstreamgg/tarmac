import { describe, expect, it } from 'vitest';
import { keccak256, recoverAddress, size, slice, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BASE_BURN_LOGS } from '@/modules/bridge/adapters/cctp/cctp.fixtures';
import { CCTP_FINALITY_STANDARD } from '@/modules/bridge/adapters/cctp/contracts';
import { decodeCctpMessage, isAttestedCopy, sentMessages } from '@/modules/bridge/adapters/cctp/message';
import { attestedCopy, signAsTestAttesters, testAttester } from './cctpTestAttesters';

const SOURCE = sentMessages(BASE_BURN_LOGS)[0].message;
const NONCE = keccak256(toHex('nonce'));

const signers = (message: Hex, attestation: Hex) =>
  Promise.all(
    Array.from({ length: size(attestation) / 65 }, (_, index) =>
      recoverAddress({
        hash: keccak256(message),
        signature: slice(attestation, index * 65, (index + 1) * 65)
      })
    )
  );

describe('CCTP test attesters', () => {
  it('keeps the e2e attester the forks already enabled', () => {
    expect(testAttester(0)).toBe(privateKeyToAccount(keccak256(toHex('tarmac e2e cctp attester'))).address);
  });

  it('builds the copy Circle would attest: the nonce given, standard finality, the burn untouched', () => {
    const copy = attestedCopy(SOURCE, NONCE);
    expect(isAttestedCopy(copy, SOURCE)).toBe(true);
    expect(decodeCctpMessage(copy)).toMatchObject({
      nonce: NONCE,
      finalityThresholdExecuted: CCTP_FINALITY_STANDARD
    });
  });

  it('signs with the first test attester alone at a threshold of one', async () => {
    const message = attestedCopy(SOURCE, NONCE);
    await expect(signers(message, await signAsTestAttesters(message, 1))).resolves.toEqual([testAttester(0)]);
  });

  it('signs with as many test attesters as the threshold, in increasing signer order', async () => {
    const message = attestedCopy(SOURCE, NONCE);
    const recovered = await signers(message, await signAsTestAttesters(message, 2));
    expect(new Set(recovered)).toEqual(new Set([testAttester(0), testAttester(1)]));
    expect(BigInt(recovered[0]) < BigInt(recovered[1])).toBe(true);
  });
});
