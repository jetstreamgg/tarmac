import {
  decodeFunctionData,
  isAddressEqual,
  keccak256,
  type Address,
  type Call,
  type Hex,
  type Log
} from 'viem';
import {
  extractTransactionDepositedLogs,
  getL2TransactionHash,
  opaqueDataToDepositData
} from 'viem/op-stack';
import { skyL1TokenBridgeImplementationAbi } from '@/hooks/generated';
import {
  L1_USDS,
  assertRecipient,
  L2_CROSS_DOMAIN_MESSENGER,
  OP_STACK_DEPOSIT,
  l2CrossDomainMessengerAbi,
  withApprove,
  type OpStackNetworkId
} from './contracts';

/** Gas the L2 relay must forward to the L2 bridge's mint, as in past mainnet deposits; too little leaves a failed message to replay. */
export const OP_STACK_MIN_GAS_LIMIT = 300_000;

export const opStackDepositCall = ({
  network,
  recipient,
  amount
}: {
  network: OpStackNetworkId;
  recipient: Address;
  amount: bigint;
}) => {
  assertRecipient(recipient);
  return {
    address: OP_STACK_DEPOSIT[network].l1TokenBridge,
    abi: skyL1TokenBridgeImplementationAbi,
    functionName: 'bridgeERC20To',
    args: [L1_USDS, OP_STACK_DEPOSIT[network].l2Usds, recipient, amount, OP_STACK_MIN_GAS_LIMIT, '0x']
  } as const;
};

/** The source calls of a deposit: an approve of exactly `amount` to the L1 bridge when short, then the deposit (no ETH). */
export function opStackDepositCalls({
  network,
  allowance,
  amount,
  recipient
}: {
  network: OpStackNetworkId;
  allowance: bigint;
  amount: bigint;
  recipient: Address;
}): Call[] {
  const { address, ...deposit } = opStackDepositCall({ network, recipient, amount });
  return withApprove({
    allowance,
    amount,
    spender: OP_STACK_DEPOSIT[network].l1TokenBridge,
    deposit: { to: address, ...deposit } as unknown as Call
  });
}

export type OpStackDepositMessage = {
  /** The messenger's key for the message: `successfulMessages` and `failedMessages` read it. */
  msgHash: Hex;
  /** The L2 deposit transaction that relays the message. */
  l2TxHash: Hex;
  /** The relayMessage calldata, which anyone can send again to replay a failed message. */
  relayCalldata: Hex;
};

/**
 * The L2 message of a deposit, from its Ethereum receipt. Only a portal deposit
 * of this network's Sky bridge counts; anything else, or more than one, is undefined.
 */
export function opStackDepositMessage(
  logs: Log[],
  network: OpStackNetworkId
): OpStackDepositMessage | undefined {
  const { portal, l1TokenBridge, l2TokenBridge } = OP_STACK_DEPOSIT[network];
  const messages = extractTransactionDepositedLogs({
    logs: logs.filter(log => isAddressEqual(log.address, portal))
  }).flatMap(log => {
    if (!log.args.to || !isAddressEqual(log.args.to, L2_CROSS_DOMAIN_MESSENGER)) return [];
    const relayCalldata = opaqueDataToDepositData(log.args.opaqueData!).data;
    try {
      const { functionName, args } = decodeFunctionData({
        abi: l2CrossDomainMessengerAbi,
        data: relayCalldata
      });
      if (functionName !== 'relayMessage') return [];
      const [, sender, target] = args;
      if (!isAddressEqual(sender, l1TokenBridge) || !isAddressEqual(target, l2TokenBridge)) return [];
    } catch {
      return [];
    }
    return [{ msgHash: keccak256(relayCalldata), l2TxHash: getL2TransactionHash({ log }), relayCalldata }];
  });
  return messages.length === 1 ? messages[0] : undefined;
}

/** A replay's gas: the messenger's baseGas for the message, with a margin. Below it the relay stores the message as failed again. */
export const opStackReplayGas = (baseGas: bigint) => (baseGas * 12n) / 10n;

/**
 * The replay of a deposit's failed message, from its stored routeData: the
 * relayMessage args and the baseGas args that price it. Throws unless the
 * calldata hashes to the stored msgHash and is this network's Sky bridge
 * message carrying no ETH.
 */
export function opStackReplay(network: OpStackNetworkId, routeData: Record<string, string> | undefined) {
  const { msgHash, relayCalldata } = routeData ?? {};
  if (!msgHash || !relayCalldata || keccak256(relayCalldata as Hex) !== msgHash.toLowerCase())
    throw new Error('The replay message does not match its hash');
  const { functionName, args } = decodeFunctionData({
    abi: l2CrossDomainMessengerAbi,
    data: relayCalldata as Hex
  });
  if (functionName !== 'relayMessage') throw new Error('The replay message is not a relay');
  const [, sender, target, value, minGasLimit, message] = args;
  const { l1TokenBridge, l2TokenBridge } = OP_STACK_DEPOSIT[network];
  if (!isAddressEqual(sender, l1TokenBridge) || !isAddressEqual(target, l2TokenBridge))
    throw new Error("The replay message is not this network's Sky bridge message");
  if (value !== 0n) throw new Error('The replay message carries ETH');
  if (minGasLimit > 0xffffffffn) throw new Error('The replay message gas limit is out of range');
  return { args, baseGasArgs: [message, Number(minGasLimit)] as const };
}

/** The replay call on the L2 messenger, with its explicit gas. */
export const opStackReplayCall = ({
  args,
  gas
}: {
  args: ReturnType<typeof opStackReplay>['args'];
  gas: bigint;
}): Call & { gas: bigint } =>
  ({
    to: L2_CROSS_DOMAIN_MESSENGER,
    abi: l2CrossDomainMessengerAbi,
    functionName: 'relayMessage',
    args,
    gas
  }) as unknown as Call & { gas: bigint };
