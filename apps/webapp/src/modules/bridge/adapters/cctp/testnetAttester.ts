import { keccak256, toHex, type Hex } from 'viem';
import type { ChainReader } from '../types';
import { CCTP_DOMAIN, CCTP_FINALITY_STANDARD, type CctpL2NetworkId } from './contracts';
import type { AttestationReader, IrisAttestedMessage } from './iris';
import { sentMessages } from './message';

/**
 * Circle's attesters never see the Tenderly testnets or the e2e forks, so their
 * Ethereum MessageTransmitterV2 also accepts this key's signature alone (set up
 * by `pnpm bridge-testnets setup` and the e2e global setup). A test-only key
 * from a public seed: no real network accepts it.
 */
export const TEST_ATTESTER_KEY = keccak256(toHex('tarmac e2e cctp attester'));

/**
 * The attested copy of a burn's MessageSent, as Iris would serve it: a nonce
 * unique to the burn, standard finality, signed by the test attester.
 */
export async function attestTestMessage(message: Hex, txHash: Hex): Promise<IrisAttestedMessage> {
  const { serializeSignature, sign } = await import('viem/accounts');
  const hex = message.slice(2);
  const attested = ('0x' +
    hex.slice(0, 24) +
    keccak256(txHash).slice(2) +
    hex.slice(88, 288) +
    CCTP_FINALITY_STANDARD.toString(16).padStart(8, '0') +
    hex.slice(296)) as Hex;
  const signature = await sign({ hash: keccak256(attested), privateKey: TEST_ATTESTER_KEY });
  return { message: attested, attestation: serializeSignature(signature) };
}

/** Stands in for Iris on the Tenderly testnets: attests each burn in the source receipt with the test attester. */
export const testnetAttestationReader =
  (getClient: (network: CctpL2NetworkId) => ChainReader | undefined): AttestationReader =>
  async (sourceDomain, txHash) => {
    const network = (Object.keys(CCTP_DOMAIN) as (keyof typeof CCTP_DOMAIN)[]).find(
      id => CCTP_DOMAIN[id] === sourceDomain
    );
    const client = network && network !== 'ethereum' ? getClient(network) : undefined;
    if (!client) throw new Error(`No testnet client for CCTP domain ${sourceDomain}`);
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    return Promise.all(sentMessages(receipt.logs).map(({ message }) => attestTestMessage(message, txHash)));
  };
