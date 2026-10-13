import {
  concat,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  hexToBigInt,
  isAddressEqual,
  keccak256,
  numberToHex,
  pad,
  size,
  slice,
  toRlp,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { arbitrumInboxImplementationAbi, skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import { ARBITRUM_DEPOSIT, L1_USDS, arbitrumBridgeAbi, assertRecipient } from './contracts';

/** The L2 call the retryable ticket makes: the L2 gateway's mint to the recipient. */
export const arbitrumOutboundCalldata = ({
  l1Token = L1_USDS,
  from,
  to,
  amount
}: {
  l1Token?: Address;
  from: Address;
  to: Address;
  amount: bigint;
}): Hex =>
  encodeFunctionData({
    abi: skyL1TokenGatewayImplementationAbi,
    functionName: 'finalizeInboundTransfer',
    args: [
      l1Token,
      from,
      to,
      amount,
      encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], ['0x', '0x'])
    ]
  });

/** Raw estimates for one deposit, read when Review opens. */
export type RetryableEstimates = {
  /** Inbox.calculateRetryableSubmissionFee for the outbound calldata. */
  submissionFee: bigint;
  /** L2 gas of the ticket's auto-redeem. */
  gasEstimate: bigint;
  /** Arbitrum gas price. */
  l2GasPrice: bigint;
};

export type RetryableQuote = {
  maxSubmissionCost: bigint;
  maxGas: bigint;
  gasPriceBid: bigint;
  /** ETH the deposit sends: the most the ticket can spend; the rest is refunded on Arbitrum. */
  value: bigint;
};

const times = (value: bigint, numerator: bigint, denominator: bigint) =>
  (value * numerator + denominator - 1n) / denominator;

/** Sky's deposit script margins: 2.5x the submission fee, 1.5x the gas, 2x the gas price; rounded up. */
export function retryableQuote({
  submissionFee,
  gasEstimate,
  l2GasPrice
}: RetryableEstimates): RetryableQuote {
  const maxSubmissionCost = times(submissionFee, 5n, 2n);
  const maxGas = times(gasEstimate, 3n, 2n);
  const gasPriceBid = l2GasPrice * 2n;
  return { maxSubmissionCost, maxGas, gasPriceBid, value: maxSubmissionCost + maxGas * gasPriceBid };
}

/** The deposit; `refundTo` gets the unspent ETH on Arbitrum (aliased by the Inbox when it is a contract). */
export const arbitrumDepositCall = ({
  l1Token = L1_USDS,
  recipient,
  refundTo,
  amount,
  quote
}: {
  l1Token?: Address;
  recipient: Address;
  refundTo: Address;
  amount: bigint;
  quote: RetryableQuote;
}) => {
  assertRecipient(recipient);
  assertRecipient(refundTo);
  return {
    address: ARBITRUM_DEPOSIT.l1Gateway,
    abi: skyL1TokenGatewayImplementationAbi,
    functionName: 'outboundTransferCustomRefund',
    args: [
      l1Token,
      refundTo,
      recipient,
      amount,
      quote.maxGas,
      quote.gasPriceBid,
      encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], [quote.maxSubmissionCost, '0x'])
    ],
    value: quote.value
  } as const;
};

/** L1 message kind of a retryable ticket submission. */
const SUBMIT_RETRYABLE_KIND = 9;

export type RetryableTicket = {
  ticketId: Hex;
  messageNum: bigint;
  /** The L2 call, for an estimate or a redeem check. */
  to: Address;
  data: Hex;
};

const rlpNumber = (value: bigint): Hex => (value === 0n ? '0x' : numberToHex(value));

/**
 * The retryable ticket a gateway deposit created, from its Ethereum receipt.
 * Only a ticket from Sky's gateway to its L2 gateway counts; anything else, or
 * more than one, is undefined. The id is the hash of the ArbOS submit-retryable
 * transaction (type 0x69).
 */
export function arbitrumRetryableTicket(logs: Log[]): RetryableTicket | undefined {
  const delivered = logs.flatMap(log => {
    if (!isAddressEqual(log.address, ARBITRUM_DEPOSIT.bridge)) return [];
    try {
      const event = decodeEventLog({ abi: arbitrumBridgeAbi, data: log.data, topics: log.topics });
      return isAddressEqual(event.args.inbox, ARBITRUM_DEPOSIT.inbox) &&
        event.args.kind === SUBMIT_RETRYABLE_KIND
        ? [event.args]
        : [];
    } catch {
      return [];
    }
  });
  const inboxMessages = logs.flatMap(log => {
    if (!isAddressEqual(log.address, ARBITRUM_DEPOSIT.inbox)) return [];
    try {
      const event = decodeEventLog({
        abi: arbitrumInboxImplementationAbi,
        data: log.data,
        topics: log.topics
      });
      return event.eventName === 'InboxMessageDelivered' ? [event.args] : [];
    } catch {
      return [];
    }
  });
  const tickets = inboxMessages.flatMap(({ messageNum, data: message }) => {
    const bridged = delivered.find(event => event.messageIndex === messageNum);
    if (!bridged || size(message) < 9 * 32) return [];
    const word = (index: number) => slice(message, index * 32, (index + 1) * 32);
    const address = (index: number) => getAddress(slice(word(index), 12));
    const dataLength = Number(hexToBigInt(word(8)));
    if (size(message) < 9 * 32 + dataLength) return [];
    const to = address(0);
    if (!isAddressEqual(to, ARBITRUM_DEPOSIT.l2Gateway)) return [];
    const data = dataLength === 0 ? '0x' : slice(message, 9 * 32, 9 * 32 + dataLength);
    const fields: Hex[] = [
      rlpNumber(ARBITRUM_DEPOSIT.chainId),
      pad(numberToHex(messageNum), { size: 32 }),
      bridged.sender,
      rlpNumber(bridged.baseFeeL1),
      rlpNumber(hexToBigInt(word(2))), // deposit
      rlpNumber(hexToBigInt(word(7))), // maxFeePerGas
      rlpNumber(hexToBigInt(word(6))), // gasLimit
      to,
      rlpNumber(hexToBigInt(word(1))), // l2CallValue
      address(5), // callValueRefundAddress
      rlpNumber(hexToBigInt(word(3))), // maxSubmissionFee
      address(4), // excessFeeRefundAddress
      data
    ];
    return [{ ticketId: keccak256(concat(['0x69', toRlp(fields)])), messageNum, to, data }];
  });
  return tickets.length === 1 ? tickets[0] : undefined;
}
