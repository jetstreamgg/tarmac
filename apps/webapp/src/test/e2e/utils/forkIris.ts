import {
  TransactionReceiptNotFoundError,
  concat,
  createPublicClient,
  http,
  isHash,
  keccak256,
  numberToHex,
  type PublicClient
} from 'viem';
import { CCTP_DOMAIN, type CctpL2NetworkId } from '@/modules/bridge/adapters/cctp/contracts';
import { networkOfDomain } from '@/modules/bridge/adapters/cctp/forkAttestations';
import { sentMessages } from '@/modules/bridge/adapters/cctp/message';
import { tenderlyForkRpcUrl } from '@/data/wagmi/config/tenderlyForkRpc';
import {
  attestationThreshold,
  attestedCopy,
  signAsTestAttesters,
  testAttestersEnabled
} from './cctpTestAttesters';

export type ForkIrisClients = { l1: PublicClient; l2For: (network: CctpL2NetworkId) => PublicClient };

export type ForkIrisResponse = { status: number; body: unknown; warning?: string };

// Iris's answer for a transaction it hasn't indexed.
const NOT_FOUND: ForkIrisResponse = { status: 404, body: { error: 'Message hash not found' } };

/** The Ethereum fork and each L2 fork of the named Tenderly multichain environment. */
export const forkIrisClients = (l1Rpc: string, rpcName: string): ForkIrisClients => ({
  l1: createPublicClient({ transport: http(l1Rpc) }),
  l2For: network => createPublicClient({ transport: http(tenderlyForkRpcUrl(rpcName, network)) })
});

/**
 * Iris's GET /v2/messages/{sourceDomain}?transactionHash= for a burn on the
 * Tenderly multichain fork: each MessageSent to Ethereum, attested with a nonce
 * of its own and signed by as many test attesters as the Ethereum fork asks.
 * None until those attesters are enabled there, so no claim that would revert
 * is offered. A failed read throws, and the app keeps waiting.
 */
export async function forkIrisResponse(
  { l1, l2For }: ForkIrisClients,
  sourceDomain: number,
  txHash: string
): Promise<ForkIrisResponse> {
  const network = networkOfDomain(sourceDomain);
  if (!network || !isHash(txHash)) return NOT_FOUND;
  let logs;
  try {
    ({ logs } = await l2For(network).getTransactionReceipt({ hash: txHash }));
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return NOT_FOUND;
    throw error;
  }
  const sources = sentMessages(logs).filter(
    ({ decoded }) =>
      decoded.sourceDomain === sourceDomain && decoded.destinationDomain === CCTP_DOMAIN.ethereum
  );
  if (!sources.length) return NOT_FOUND;
  const threshold = await attestationThreshold(l1);
  if (!(await testAttestersEnabled(l1, threshold)))
    return {
      ...NOT_FOUND,
      warning:
        'CCTP test attesters are not enabled on the Ethereum fork: run scripts/enableForkCctpAttesters.ts'
    };
  const messages = await Promise.all(
    sources.map(async ({ message: source }, index) => {
      const message = attestedCopy(source, keccak256(concat([txHash, numberToHex(index, { size: 32 })])));
      return {
        message,
        attestation: await signAsTestAttesters(message, threshold),
        status: 'complete',
        cctpVersion: 2
      };
    })
  );
  return { status: 200, body: { messages } };
}
