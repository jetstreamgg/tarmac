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

/** How far back on the Ethereum fork a relayed mint is looked for. */
const LOOKBACK_BLOCKS = 100_000n;

// Never sent: the copy is read only once received, so its nonce reads as used and no claim is offered.
const NO_ATTESTATION = '0x00';

const MINT_AND_WITHDRAW = getAbiItem({ abi: tokenMessengerV2Abi, name: 'MintAndWithdraw' });

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
 * none until it relayed. Two identical burns can't be told apart here.
 */
export const forkAttestationReader =
  (context: AdapterContext): AttestationReader =>
  async (sourceDomain, txHash) => {
    const network = networkOfDomain(sourceDomain);
    const l1 = context.getClient('ethereum');
    const l2 = network && context.getClient(network);
    if (!l1 || !l2) return [];
    const receipt = await l2.getTransactionReceipt({ hash: txHash });
    const latest = await l1.getBlockNumber();
    const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
    const attested: IrisAttestedMessage[] = [];
    for (const { message, decoded } of sentMessages(receipt.logs)) {
      if (decoded.destinationDomain !== CCTP_DOMAIN.ethereum) continue;
      const mints = await l1.getLogs({
        address: TOKEN_MESSENGER_V2,
        event: MINT_AND_WITHDRAW,
        args: { mintRecipient: decoded.body.mintRecipient },
        fromBlock,
        toBlock: latest
      });
      const relays = [...new Set(mints.map(({ transactionHash }) => transactionHash).filter(Boolean))];
      for (const hash of relays) {
        const relay = await l1.getTransactionReceipt({ hash: hash! });
        for (const copy of receivedCopies(relay.logs, message))
          attested.push({ message: copy, attestation: NO_ATTESTATION });
      }
    }
    return attested;
  };
