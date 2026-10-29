import { isHex, type Hex } from 'viem';

/** Circle's public attestation service; a proxy can stand in for it with the same paths. */
export const IRIS_API_URL = 'https://iris-api.circle.com';

/** Dev server only (vite.forkIris.ts): Iris's paths, answered for the Tenderly multichain fork by test attesters. */
export const FORK_IRIS_PATH = '/__fork-iris';

/** Long enough for a slow Iris, short enough that a hung request doesn't stall the poll. */
const IRIS_TIMEOUT_MS = 10_000;

/** A message Circle has attested, ready to be received on its destination. */
export type IrisAttestedMessage = { message: Hex; attestation: Hex };

/** Reads the attested messages of a source transaction; an empty list until Circle has attested any. */
export type AttestationReader = (sourceDomain: number, txHash: Hex) => Promise<IrisAttestedMessage[]>;

type IrisMessage = { message?: unknown; attestation?: unknown; status?: unknown; cctpVersion?: unknown };

const isAttested = (entry: IrisMessage): entry is IrisMessage & IrisAttestedMessage =>
  entry.status === 'complete' &&
  entry.cctpVersion === 2 &&
  isHex(entry.message) &&
  entry.message !== '0x' &&
  isHex(entry.attestation) &&
  entry.attestation !== '0x';

/**
 * Iris's attested V2 messages for a source transaction. A 404 means Circle
 * hasn't indexed it yet, and pending entries carry no attestation ("PENDING"):
 * both read as none. Any other failure throws, so the caller keeps waiting.
 */
export const irisAttestationReader =
  (
    baseUrl: string = IRIS_API_URL,
    fetcher: (url: string) => Promise<Response> = url =>
      fetch(url, { signal: AbortSignal.timeout(IRIS_TIMEOUT_MS) })
  ): AttestationReader =>
  async (sourceDomain, txHash) => {
    const response = await fetcher(`${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${txHash}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Iris responded ${response.status}`);
    const body: { messages?: unknown } = await response.json();
    if (!Array.isArray(body.messages)) return [];
    return (body.messages as IrisMessage[])
      .filter(isAttested)
      .map(({ message, attestation }) => ({ message, attestation }));
  };
