import {
  concat,
  decodeEventLog,
  getAbiItem,
  getAddress,
  hexToBigInt,
  hexToNumber,
  isAddressEqual,
  numberToHex,
  size,
  slice,
  zeroHash,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { math } from '@/utils';
import {
  CCTP_DOMAIN,
  CCTP_FINALITY_STANDARD,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  cctpL2Contracts,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
  type CctpL2NetworkId
} from './contracts';

// MessageV2: a 148-byte header, then the BurnMessageV2 body (228 bytes before its hook data).
const HEADER = 148;
const BODY_MIN = 228;
const NONCE = [12, 44] as const;
const FINALITY_EXECUTED = [144, 148] as const;
const FEE_EXECUTED = [HEADER + 164, HEADER + 196] as const;
const EXPIRATION_BLOCK = [HEADER + 196, HEADER + 228] as const;

export type CctpMessage = {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  /** Zero in the source's MessageSent: Circle assigns it when it attests. */
  nonce: Hex;
  sender: Hex;
  recipient: Hex;
  destinationCaller: Hex;
  minFinalityThreshold: number;
  /** Zero in the source's MessageSent; set by the attestation. */
  finalityThresholdExecuted: number;
  body: {
    version: number;
    burnToken: Address;
    mintRecipient: Address;
    /** USDC, 6 decimals. */
    amount: bigint;
    messageSender: Address;
    maxFee: bigint;
    /** Set by the attestation; the mint is `amount - feeExecuted`. */
    feeExecuted: bigint;
    /** Set by the attestation; past this Ethereum block the message must be attested again. 0: never expires. */
    expirationBlock: bigint;
    hookData: Hex;
  };
};

const word = (message: Hex, start: number) => slice(message, start, start + 32, { strict: true });
const bytes32ToAddress = (value: Hex) => getAddress(slice(value, 12, 32, { strict: true }));

/** Decodes a CCTP V2 burn message; throws on anything shorter than one. */
export function decodeCctpMessage(message: Hex): CctpMessage {
  if (size(message) < HEADER + BODY_MIN) throw new Error('Not a CCTP V2 burn message');
  const uint32 = (start: number) => hexToNumber(slice(message, start, start + 4, { strict: true }));
  const uint256 = (start: number) => hexToBigInt(word(message, start));
  return {
    version: uint32(0),
    sourceDomain: uint32(4),
    destinationDomain: uint32(8),
    nonce: word(message, NONCE[0]),
    sender: word(message, 44),
    recipient: word(message, 76),
    destinationCaller: word(message, 108),
    minFinalityThreshold: uint32(140),
    finalityThresholdExecuted: uint32(FINALITY_EXECUTED[0]),
    body: {
      version: uint32(HEADER),
      burnToken: bytes32ToAddress(word(message, HEADER + 4)),
      mintRecipient: bytes32ToAddress(word(message, HEADER + 36)),
      amount: uint256(HEADER + 68),
      messageSender: bytes32ToAddress(word(message, HEADER + 100)),
      maxFee: uint256(HEADER + 132),
      feeExecuted: uint256(FEE_EXECUTED[0]),
      expirationBlock: uint256(EXPIRATION_BLOCK[0]),
      hookData: size(message) > HEADER + BODY_MIN ? slice(message, HEADER + BODY_MIN) : '0x'
    }
  };
}

/** A message past its expiration block can't be received until Circle attests it again. */
export const isCctpMessageExpired = (message: Hex, ethereumBlock: bigint) => {
  const { expirationBlock } = decodeCctpMessage(message).body;
  return expirationBlock !== 0n && ethereumBlock >= expirationBlock;
};

/** What the source burn of a bridge must say, in the terms the app launched it with. */
export type CctpBurnExpectation = {
  from: CctpL2NetworkId;
  /** USDS amount at 18 decimals; the burn carries it in USDC units. */
  amount: bigint;
  /** The account that sent the burn. */
  sender: Address;
  /** Where the USDC is minted on Ethereum. */
  mintRecipient: Address;
};

const tokenMessenger = (value: Hex) => isAddressEqual(bytes32ToAddress(value), TOKEN_MESSENGER_V2);

/** Whether a decoded source message is the standard, fee-free, no-hook burn the app builds for `expected`. */
export function isExpectedBurn(message: CctpMessage, expected: CctpBurnExpectation): boolean {
  const { body } = message;
  return (
    message.version === 1 &&
    message.sourceDomain === CCTP_DOMAIN[expected.from] &&
    message.destinationDomain === CCTP_DOMAIN.ethereum &&
    tokenMessenger(message.sender) &&
    tokenMessenger(message.recipient) &&
    message.destinationCaller === zeroHash &&
    message.minFinalityThreshold === CCTP_FINALITY_STANDARD &&
    body.version === 1 &&
    isAddressEqual(body.burnToken, cctpL2Contracts(expected.from).usdc) &&
    isAddressEqual(body.mintRecipient, expected.mintRecipient) &&
    isAddressEqual(body.messageSender, expected.sender) &&
    body.amount === math.convertWadtoUSDC(expected.amount) &&
    body.maxFee === 0n &&
    body.hookData === '0x'
  );
}

/** The MessageSent messages the L2 MessageTransmitter emitted in `logs`, decoded; anything else is skipped. */
export function sentMessages(logs: readonly Log[]): { message: Hex; decoded: CctpMessage }[] {
  return logs.flatMap(log => {
    if (!isAddressEqual(log.address, MESSAGE_TRANSMITTER_V2)) return [];
    try {
      const { eventName, args } = decodeEventLog({
        abi: messageTransmitterV2Abi,
        topics: log.topics,
        data: log.data
      });
      if (eventName !== 'MessageSent') return [];
      return [{ message: args.message, decoded: decodeCctpMessage(args.message) }];
    } catch {
      return [];
    }
  });
}

/** The bridge's burn messages in a source receipt, as the L2 MessageTransmitter emitted them. */
export function sourceBurnMessages(logs: readonly Log[], expected: CctpBurnExpectation): Hex[] {
  return sentMessages(logs)
    .filter(({ decoded }) => isExpectedBurn(decoded, expected))
    .map(({ message }) => message);
}

const ATTESTED_FIELDS = [NONCE, FINALITY_EXECUTED, FEE_EXECUTED, EXPIRATION_BLOCK];

/** The message's hex with the fields the attestation sets zeroed. */
const withoutAttestedFields = (message: Hex) =>
  ATTESTED_FIELDS.reduce(
    (hex, [start, end]) => hex.slice(0, 2 + 2 * start) + '00'.repeat(end - start) + hex.slice(2 + 2 * end),
    message.toLowerCase()
  );

/**
 * Whether `attested` is Circle's attested copy of the `source` MessageSent:
 * byte for byte the same except the fields the attestation sets, which must
 * hold a real nonce, a standard finality and no fee. Only such a message is
 * claimed, and only its nonce is read: `usedNonces(0)` reads as used.
 */
export function isAttestedCopy(attested: Hex, source: Hex): boolean {
  if (size(attested) !== size(source)) return false;
  let decoded: CctpMessage;
  try {
    decoded = decodeCctpMessage(attested);
  } catch {
    return false;
  }
  return (
    withoutAttestedFields(attested) === withoutAttestedFields(source) &&
    decoded.nonce !== zeroHash &&
    decoded.finalityThresholdExecuted >= CCTP_FINALITY_STANDARD &&
    decoded.body.feeExecuted === 0n
  );
}

/** Ethereum's TokenMessenger mints a received transfer's USDC with it, indexed by its recipient. */
export const MINT_AND_WITHDRAW = getAbiItem({ abi: tokenMessengerV2Abi, name: 'MintAndWithdraw' });

/** The copies of `source` that `logs` show received on Ethereum, rebuilt with the nonce and finality they got. */
export function receivedCopies(logs: readonly Log[], source: Hex): Hex[] {
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
