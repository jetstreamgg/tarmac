import {
  concat,
  decodeEventLog,
  getAbiItem,
  isAddressEqual,
  numberToHex,
  slice,
  type Hex,
  type Log
} from 'viem';
import type { AdapterContext } from '../types';
import {
  CCTP_DOMAIN,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
  type CctpL2NetworkId
} from './contracts';
import type { AttestationReader, IrisAttestedMessage } from './iris';
import { isAttestedCopy, sentMessages } from './message';

// Fork clocks match to the second (live: relay and burn share a timestamp); slack for any drift.
const CLOCK_SLACK_SECONDS = 60n;

/** How far back on the Ethereum fork a relayed mint is looked for. */
const LOOKBACK_BLOCKS = 100_000n;

// Never sent: the copy is read only once received, so its nonce reads as used and no claim is offered.
const NO_ATTESTATION = '0x00';

const MINT_AND_WITHDRAW = getAbiItem({ abi: tokenMessengerV2Abi, name: 'MintAndWithdraw' });

/** Per Ethereum client, how far each burn message was scanned and the copies found so far. */
const scans = new WeakMap<object, Map<string, { scannedTo: bigint; copies: Hex[] }>>();

const networkOfDomain = (domain: number) =>
  (Object.keys(CCTP_DOMAIN) as (keyof typeof CCTP_DOMAIN)[]).find(
    (network): network is CctpL2NetworkId => network !== 'ethereum' && CCTP_DOMAIN[network] === domain
  );

/** The copies of `source` that `logs` show received on Ethereum, rebuilt with the nonce and finality they got. */
function receivedCopies(logs: readonly Log[], source: Hex): Hex[] {
  return logs.flatMap(log => {
    if (!isAddressEqual(log.address, MESSAGE_TRANSMITTER_V2)) return [];
    try {
      const { eventName, args } = decodeEventLog({
        abi: messageTransmitterV2Abi,
        topics: log.topics,
        data: log.data
      });
      if (eventName !== 'MessageReceived') return [];
      const copy = concat([
        slice(source, 0, 12),
        args.nonce,
        slice(source, 44, 144),
        numberToHex(args.finalityThresholdExecuted, { size: 4 }),
        args.messageBody
      ]);
      const sameOrigin =
        args.sourceDomain === Number(BigInt(slice(source, 4, 8))) &&
        args.sender.toLowerCase() === slice(source, 44, 76).toLowerCase();
      return sameOrigin && isAttestedCopy(copy, source) ? [copy] : [];
    } catch {
      return [];
    }
  });
}

/**
 * Dev only, on the Tenderly multichain fork: Tenderly attests and relays a
 * CCTP burn itself, so Iris never knows it. Reads instead the copy Tenderly
 * received on the Ethereum fork, found by the mint to the burn's recipient;
 * none until it relayed. Only relays mined after the burn count; two identical
 * burns both in flight still can't be told apart here. Each poll scans only the
 * blocks mined since the last one and keeps the copies already found.
 */
export const forkAttestationReader =
  (context: AdapterContext): AttestationReader =>
  async (sourceDomain, txHash) => {
    const network = networkOfDomain(sourceDomain);
    const l1 = context.getClient('ethereum');
    const l2 = network && context.getClient(network);
    if (!l1 || !l2) return [];
    const [receipt, latest] = await Promise.all([
      l2.getTransactionReceipt({ hash: txHash }),
      l1.getBlockNumber()
    ]);
    const { timestamp: burnedAt } = await l2.getBlock({ blockNumber: receipt.blockNumber });
    const lookbackStart = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
    if (!scans.has(l1)) scans.set(l1, new Map());
    const scanned = scans.get(l1)!;
    // Burns to the same recipient in one tx share their relays: each is read once.
    const relayReceipts = new Map<Hex, ReturnType<typeof l1.getTransactionReceipt>>();
    const readRelay = (hash: Hex) => {
      if (!relayReceipts.has(hash)) relayReceipts.set(hash, l1.getTransactionReceipt({ hash }));
      return relayReceipts.get(hash)!;
    };
    const perMessage = await Promise.all(
      sentMessages(receipt.logs)
        .filter(({ decoded }) => decoded.destinationDomain === CCTP_DOMAIN.ethereum)
        .map(async ({ message, decoded }) => {
          const key = `${txHash}:${message}`;
          const previous = scanned.get(key);
          const fromBlock = previous ? previous.scannedTo + 1n : lookbackStart;
          if (fromBlock > latest) return previous!.copies;
          const mints = await l1.getLogs({
            address: TOKEN_MESSENGER_V2,
            event: MINT_AND_WITHDRAW,
            args: { mintRecipient: decoded.body.mintRecipient },
            fromBlock,
            toBlock: latest
          });
          const candidates = new Map<Hex, bigint>();
          for (const { blockNumber, transactionHash } of mints)
            if (transactionHash && blockNumber !== null) candidates.set(transactionHash, blockNumber);
          const copies = await Promise.all(
            [...candidates].map(async ([hash, blockNumber]) => {
              const { timestamp } = await l1.getBlock({ blockNumber });
              // An identical earlier transfer to the same recipient was relayed before this burn existed.
              if (timestamp + CLOCK_SLACK_SECONDS < burnedAt) return [];
              return receivedCopies((await readRelay(hash)).logs, message);
            })
          );
          const found = [...new Set([...(previous?.copies ?? []), ...copies.flat()])];
          scanned.set(key, { scannedTo: latest, copies: found });
          return found;
        })
    );
    return perMessage
      .flat()
      .map((copy): IrisAttestedMessage => ({ message: copy, attestation: NO_ATTESTATION }));
  };
