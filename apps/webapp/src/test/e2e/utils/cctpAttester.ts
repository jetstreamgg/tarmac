import type { Page } from '@playwright/test';
import { createPublicClient, encodeFunctionData, http, keccak256, type Hash, type Hex } from 'viem';
import { MESSAGE_TRANSMITTER_V2, messageTransmitterV2Abi } from '@/modules/bridge/adapters/cctp/contracts';
import { sentMessages } from '@/modules/bridge/adapters/cctp/message';
import { IRIS_API_URL } from '@/modules/bridge/adapters/cctp/iris';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { attestedCopy, enableTestAttesters, signAsTestAttesters, testAttester } from './cctpTestAttesters';

const client = async (network: NetworkName) =>
  createPublicClient({ transport: http(await getRpcUrlFromFile(network)) });

/**
 * Enables the test attester on the Ethereum fork with a threshold of one. Runs
 * on every setup (snapshots may predate it) and skips what is already set.
 */
export async function enableCctpTestAttester() {
  await enableTestAttesters(await client(NetworkName.mainnet), { threshold: 1 });
}

/**
 * The attested copy of the burn's MessageSent, as Iris would serve it: a nonce
 * unique to the burn, standard finality, signed by the test attester.
 */
export async function attestCctpBurn(network: NetworkName, txHash: Hash) {
  const receipt = await (await client(network)).getTransactionReceipt({ hash: txHash });
  const sent = sentMessages(receipt.logs);
  if (sent.length !== 1) throw new Error(`Expected one MessageSent in ${txHash}, found ${sent.length}`);
  const message = attestedCopy(sent[0].message, keccak256(txHash));
  return { message, attestation: await signAsTestAttesters(message, 1) };
}

type IrisTarget = Pick<Page, 'route'>;

/**
 * Stands in for Iris in the page (or context): 404 for a burn until `attest`
 * serves its attested copy. `serve` adds another page, such as a recipient's.
 */
export async function stubIris(target: IrisTarget) {
  const attested = new Map<string, { message: Hex; attestation: Hex }>();
  const serve = (next: IrisTarget) =>
    next.route(`${IRIS_API_URL}/v2/messages/**`, route => {
      const txHash = new URL(route.request().url()).searchParams.get('transactionHash')?.toLowerCase();
      const entry = txHash ? attested.get(txHash) : undefined;
      return entry
        ? route.fulfill({ json: { messages: [{ ...entry, status: 'complete', cctpVersion: 2 }] } })
        : route.fulfill({ status: 404, json: { error: 'Message hash not found' } });
    });
  await serve(target);
  return {
    serve,
    attest: async (network: NetworkName, txHash: Hash) => {
      const entry = await attestCctpBurn(network, txHash);
      attested.set(txHash.toLowerCase(), entry);
      return entry;
    }
  };
}

/** Delivers an attested message on the Ethereum fork from an unrelated account, as anyone may. */
export async function receiveCctpMessage({ message, attestation }: { message: Hex; attestation: Hex }) {
  const l1 = await client(NetworkName.mainnet);
  const hash = (await l1.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: testAttester(0),
        to: MESSAGE_TRANSMITTER_V2,
        data: encodeFunctionData({
          abi: messageTransmitterV2Abi,
          functionName: 'receiveMessage',
          args: [message, attestation]
        }),
        gas: '0x7A120',
        gasPrice: '0x0'
      }
    ]
  } as never)) as Hash;
  const receipt = await l1.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`receiveMessage reverted: ${hash}`);
}
