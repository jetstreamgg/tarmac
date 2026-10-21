import type { Page } from '@playwright/test';
import {
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hash,
  type Hex
} from 'viem';
import { privateKeyToAccount, serializeSignature, sign } from 'viem/accounts';
import { MESSAGE_TRANSMITTER_V2, messageTransmitterV2Abi } from '@/modules/bridge/adapters/cctp/contracts';
import { sentMessages } from '@/modules/bridge/adapters/cctp/message';
import { IRIS_API_URL } from '@/modules/bridge/adapters/cctp/iris';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

// Circle's attesters never see the forks, so the Ethereum fork's MessageTransmitterV2
// also accepts this key's signature alone. Test-only key, deterministic across shards.
const ATTESTER_KEY = keccak256(toHex('tarmac e2e cctp attester'));
const ATTESTER = privateKeyToAccount(ATTESTER_KEY).address;

const attestableAbi = parseAbi([
  'function attesterManager() view returns (address)',
  'function isEnabledAttester(address) view returns (bool)',
  'function signatureThreshold() view returns (uint256)',
  'function enableAttester(address)',
  'function setSignatureThreshold(uint256)'
]);

const client = async (network: NetworkName) =>
  createPublicClient({ transport: http(await getRpcUrlFromFile(network)) });

/**
 * Enables the test attester on the Ethereum fork with a threshold of one. Runs
 * on every setup (snapshots may predate it) and skips what is already set.
 */
export async function enableCctpTestAttester() {
  const l1 = await client(NetworkName.mainnet);
  const transmitter = { address: MESSAGE_TRANSMITTER_V2, abi: attestableAbi } as const;
  const manager: Address = await l1.readContract({ ...transmitter, functionName: 'attesterManager' });
  const send = async (data: Hex) => {
    const hash = (await l1.request({
      method: 'eth_sendTransaction',
      params: [{ from: manager, to: MESSAGE_TRANSMITTER_V2, data, gas: '0x7A120', gasPrice: '0x0' }]
    } as never)) as Hash;
    const receipt = await l1.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Attester setup reverted: ${hash}`);
  };
  if (!(await l1.readContract({ ...transmitter, functionName: 'isEnabledAttester', args: [ATTESTER] })))
    await send(encodeFunctionData({ abi: attestableAbi, functionName: 'enableAttester', args: [ATTESTER] }));
  if ((await l1.readContract({ ...transmitter, functionName: 'signatureThreshold' })) !== 1n)
    await send(encodeFunctionData({ abi: attestableAbi, functionName: 'setSignatureThreshold', args: [1n] }));
}

/**
 * The attested copy of the burn's MessageSent, as Iris would serve it: a nonce
 * unique to the burn, standard finality, signed by the test attester.
 */
export async function attestCctpBurn(network: NetworkName, txHash: Hash) {
  const receipt = await (await client(network)).getTransactionReceipt({ hash: txHash });
  const sent = sentMessages(receipt.logs);
  if (sent.length !== 1) throw new Error(`Expected one MessageSent in ${txHash}, found ${sent.length}`);
  const hex = sent[0].message.slice(2);
  const message = ('0x' +
    hex.slice(0, 24) +
    keccak256(txHash).slice(2) +
    hex.slice(88, 288) +
    (2000).toString(16).padStart(8, '0') +
    hex.slice(296)) as Hex;
  const signature = await sign({ hash: keccak256(message), privateKey: ATTESTER_KEY });
  return { message, attestation: serializeSignature(signature) };
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
        from: ATTESTER,
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
