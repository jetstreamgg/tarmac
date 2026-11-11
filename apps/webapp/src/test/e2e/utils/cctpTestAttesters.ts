// Zero-import (viem only, relative .ts paths) so the dev server and the node scripts can share it.
import {
  concat,
  encodeFunctionData,
  keccak256,
  numberToHex,
  parseAbi,
  slice,
  toHex,
  type Address,
  type Hash,
  type Hex,
  type PublicClient
} from 'viem';
import { privateKeyToAccount, serializeSignature, sign } from 'viem/accounts';
import { MESSAGE_TRANSMITTER_V2 } from '../../../modules/bridge/adapters/cctp/addresses.ts';

// CCTP_FINALITY_STANDARD, which contracts.ts can't give a node script.
const FINALITY_STANDARD = 2000;

/**
 * Circle's attesters never see the forks, so a fork's Ethereum MessageTransmitterV2
 * is set to also accept these. Test-only keys, deterministic; the first is the e2e one.
 */
const testAttesterKey = (index: number): Hex =>
  keccak256(toHex(index === 0 ? 'tarmac e2e cctp attester' : `tarmac e2e cctp attester ${index}`));

export const testAttester = (index: number): Address => privateKeyToAccount(testAttesterKey(index)).address;

const attestableAbi = parseAbi([
  'function attesterManager() view returns (address)',
  'function isEnabledAttester(address) view returns (bool)',
  'function signatureThreshold() view returns (uint256)',
  'function enableAttester(address)',
  'function setSignatureThreshold(uint256)'
]);

const transmitter = { address: MESSAGE_TRANSMITTER_V2, abi: attestableAbi } as const;

/** How many signatures the fork's Ethereum MessageTransmitterV2 wants on an attestation. */
export const attestationThreshold = async (l1: PublicClient) =>
  Number(await l1.readContract({ ...transmitter, functionName: 'signatureThreshold' }));

/** Whether the test attesters that sign at the fork's threshold are all enabled. */
export async function testAttestersEnabled(l1: PublicClient, threshold: number) {
  const enabled = await Promise.all(
    Array.from({ length: threshold }, (_, index) =>
      l1.readContract({ ...transmitter, functionName: 'isEnabledAttester', args: [testAttester(index)] })
    )
  );
  return enabled.every(Boolean);
}

/**
 * Enables, as the attester manager, as many test attesters as the threshold
 * asks; with `threshold`, sets it first. Skips what is already set. Needs an
 * RPC that sends unsigned transactions, as Tenderly's fork RPCs do.
 */
export async function enableTestAttesters(l1: PublicClient, { threshold }: { threshold?: number } = {}) {
  const manager: Address = await l1.readContract({ ...transmitter, functionName: 'attesterManager' });
  const send = async (data: Hex) => {
    const hash = (await l1.request({
      method: 'eth_sendTransaction',
      params: [{ from: manager, to: MESSAGE_TRANSMITTER_V2, data, gas: '0x7A120', gasPrice: '0x0' }]
    } as never)) as Hash;
    const receipt = await l1.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Attester setup reverted: ${hash}`);
  };
  if (threshold !== undefined && (await attestationThreshold(l1)) !== threshold)
    await send(
      encodeFunctionData({
        abi: attestableAbi,
        functionName: 'setSignatureThreshold',
        args: [BigInt(threshold)]
      })
    );
  const signers = await attestationThreshold(l1);
  for (let index = 0; index < signers; index++) {
    const attester = testAttester(index);
    if (!(await l1.readContract({ ...transmitter, functionName: 'isEnabledAttester', args: [attester] })))
      await send(
        encodeFunctionData({ abi: attestableAbi, functionName: 'enableAttester', args: [attester] })
      );
  }
}

/** `source`, a burn's MessageSent, as Circle attests it: with `nonce` and standard finality. */
export const attestedCopy = (source: Hex, nonce: Hex): Hex =>
  concat([
    slice(source, 0, 12),
    nonce,
    slice(source, 44, 144),
    numberToHex(FINALITY_STANDARD, { size: 4 }),
    slice(source, 148)
  ]);

/** `message` signed by the first `threshold` test attesters, in the increasing signer order the transmitter checks. */
export async function signAsTestAttesters(message: Hex, threshold: number): Promise<Hex> {
  const signatures = await Promise.all(
    Array.from({ length: threshold }, async (_, index) => ({
      signer: BigInt(testAttester(index)),
      signature: serializeSignature(
        await sign({ hash: keccak256(message), privateKey: testAttesterKey(index) })
      )
    }))
  );
  signatures.sort((a, b) => (a.signer < b.signer ? -1 : 1));
  return concat(signatures.map(({ signature }) => signature));
}
