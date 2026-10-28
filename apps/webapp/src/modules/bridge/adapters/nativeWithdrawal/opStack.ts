import {
  decodeFunctionData,
  isAddressEqual,
  keccak256,
  parseEventLogs,
  type Address,
  type Call,
  type Hex,
  type Log
} from 'viem';
import { getWithdrawals } from 'viem/op-stack';
import { skyL1TokenBridgeImplementationAbi } from '@/hooks/generated';
import { isBlockedRecipient } from '../../model/recipient';
import {
  L1_USDS,
  L2_CROSS_DOMAIN_MESSENGER,
  OP_STACK_DEPOSIT,
  l2CrossDomainMessengerAbi,
  withApprove,
  type OpStackNetworkId
} from '../nativeDeposit/contracts';
import {
  L2_TO_L1_MESSAGE_PASSER,
  OP_STACK_WITHDRAWAL,
  OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT,
  opStackL2TokenBridgeAbi,
  optimismPortalAbi
} from './contracts';

/** The L1 release of a withdrawal to the zero address or a system or bridge contract reverts or traps it, so none is built. */
function assertWithdrawalRecipient(address: Address) {
  if (isBlockedRecipient(address))
    throw new Error('A bridge withdrawal needs a recipient that can hold USDS');
}

export const opStackWithdrawalCall = ({
  network,
  recipient,
  amount
}: {
  network: OpStackNetworkId;
  recipient: Address;
  amount: bigint;
}) => {
  assertWithdrawalRecipient(recipient);
  const { l2TokenBridge, l2Usds } = OP_STACK_DEPOSIT[network];
  return {
    address: l2TokenBridge,
    abi: opStackL2TokenBridgeAbi,
    functionName: 'bridgeERC20To',
    args: [l2Usds, L1_USDS, recipient, amount, OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT, '0x']
  } as const;
};

/** The source calls of a withdrawal: an approve of exactly `amount` of L2 USDS to the L2 bridge when short, then the withdrawal. */
export function opStackWithdrawalCalls({
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
  const { address, ...withdrawal } = opStackWithdrawalCall({ network, recipient, amount });
  return withApprove({
    allowance,
    amount,
    spender: address,
    token: OP_STACK_DEPOSIT[network].l2Usds,
    deposit: { to: address, ...withdrawal } as unknown as Call
  });
}

/** The portal's withdrawal transaction, as the L2 message passer recorded it. */
export type OpStackWithdrawal = {
  nonce: bigint;
  sender: Address;
  target: Address;
  value: bigint;
  gasLimit: bigint;
  data: Hex;
  withdrawalHash: Hex;
};

export type OpStackWithdrawalMessage = {
  withdrawal: OpStackWithdrawal;
  /** The L1 messenger's key for the message: `successfulMessages` and `failedMessages` read it. */
  msgHash: Hex;
  minGasLimit: bigint;
  from: Address;
  to: Address;
  amount: bigint;
};

/**
 * The USDS withdrawal of an L2 receipt. Only a message passer withdrawal of
 * this network's Sky bridge releasing L1 USDS counts, so the sUSDS one a
 * router sends alongside is skipped; anything else, or more than one, is undefined.
 */
export function opStackWithdrawalMessage(
  logs: Log[],
  network: OpStackNetworkId
): OpStackWithdrawalMessage | undefined {
  const { l1TokenBridge, l2TokenBridge, l2Usds } = OP_STACK_DEPOSIT[network];
  const { l1Messenger } = OP_STACK_WITHDRAWAL[network];
  const messages = getWithdrawals({
    logs: logs.filter(log => isAddressEqual(log.address, L2_TO_L1_MESSAGE_PASSER))
  }).flatMap(withdrawal => {
    if (!isAddressEqual(withdrawal.sender, L2_CROSS_DOMAIN_MESSENGER)) return [];
    if (!isAddressEqual(withdrawal.target, l1Messenger) || withdrawal.value !== 0n) return [];
    try {
      const relay = decodeFunctionData({ abi: l2CrossDomainMessengerAbi, data: withdrawal.data });
      if (relay.functionName !== 'relayMessage') return [];
      const [, sender, target, value, minGasLimit, message] = relay.args;
      if (!isAddressEqual(sender, l2TokenBridge) || !isAddressEqual(target, l1TokenBridge) || value !== 0n)
        return [];
      const release = decodeFunctionData({ abi: skyL1TokenBridgeImplementationAbi, data: message });
      if (release.functionName !== 'finalizeBridgeERC20') return [];
      const [localToken, remoteToken, from, to, amount] = release.args;
      if (!isAddressEqual(localToken, L1_USDS) || !isAddressEqual(remoteToken, l2Usds)) return [];
      return [{ withdrawal, msgHash: keccak256(withdrawal.data), minGasLimit, from, to, amount }];
    } catch {
      return [];
    }
  });
  return messages.length === 1 ? messages[0] : undefined;
}

const withdrawalTransaction = ({ nonce, sender, target, value, gasLimit, data }: OpStackWithdrawal) =>
  ({ nonce, sender, target, value, gasLimit, data }) as const;

/** The prove on this network's portal, against the game at `disputeGameIndex`. */
export const opStackProveCall = ({
  network,
  withdrawal,
  disputeGameIndex,
  outputRootProof,
  withdrawalProof
}: {
  network: OpStackNetworkId;
  withdrawal: OpStackWithdrawal;
  disputeGameIndex: bigint;
  outputRootProof: { version: Hex; stateRoot: Hex; messagePasserStorageRoot: Hex; latestBlockhash: Hex };
  withdrawalProof: readonly Hex[];
}) =>
  ({
    address: OP_STACK_DEPOSIT[network].portal,
    abi: optimismPortalAbi,
    functionName: 'proveWithdrawalTransaction',
    args: [withdrawalTransaction(withdrawal), disputeGameIndex, outputRootProof, withdrawalProof]
  }) as const;

/**
 * The finalize on this network's portal, naming the wallet whose proof it
 * uses: any wallet can finalize, and the proof checked is that wallet's.
 */
export const opStackFinalizeCall = ({
  network,
  withdrawal,
  proofSubmitter
}: {
  network: OpStackNetworkId;
  withdrawal: OpStackWithdrawal;
  proofSubmitter: Address;
}) =>
  ({
    address: OP_STACK_DEPOSIT[network].portal,
    abi: optimismPortalAbi,
    functionName: 'finalizeWithdrawalTransactionExternalProof',
    args: [withdrawalTransaction(withdrawal), proofSubmitter]
  }) as const;

/**
 * The retry of a withdrawal whose L1 relay failed, from its stored routeData:
 * the relayMessage args and the baseGas args that price it. Throws unless the
 * calldata hashes to the stored msgHash and is this network's Sky bridge
 * message carrying no ETH.
 */
export function opStackWithdrawalReplay(
  network: OpStackNetworkId,
  routeData: Record<string, string> | undefined
) {
  const { msgHash, relayCalldata } = routeData ?? {};
  if (!msgHash || !relayCalldata || keccak256(relayCalldata as Hex) !== msgHash.toLowerCase())
    throw new Error('The retry message does not match its hash');
  const { functionName, args } = decodeFunctionData({
    abi: l2CrossDomainMessengerAbi,
    data: relayCalldata as Hex
  });
  if (functionName !== 'relayMessage') throw new Error('The retry message is not a relay');
  const [, sender, target, value, minGasLimit, message] = args;
  const { l1TokenBridge, l2TokenBridge } = OP_STACK_DEPOSIT[network];
  if (!isAddressEqual(sender, l2TokenBridge) || !isAddressEqual(target, l1TokenBridge))
    throw new Error("The retry message is not this network's Sky bridge message");
  if (value !== 0n) throw new Error('The retry message carries ETH');
  if (minGasLimit > 0xffffffffn) throw new Error('The retry message gas limit is out of range');
  return { args, baseGasArgs: [message, Number(minGasLimit)] as const };
}

/**
 * A finalize mines even when its L1 relay fails: the messenger stores the
 * message for a retry and logs FailedRelayedMessage instead of RelayedMessage.
 */
export const opStackRelayFailed = (network: OpStackNetworkId, logs: Log[]) =>
  parseEventLogs({ abi: l2CrossDomainMessengerAbi, eventName: 'FailedRelayedMessage', logs }).some(log =>
    isAddressEqual(log.address, OP_STACK_WITHDRAWAL[network].l1Messenger)
  );

/** The retry call on this network's L1 messenger, with its explicit gas. */
export const opStackWithdrawalReplayCall = ({
  network,
  args,
  gas
}: {
  network: OpStackNetworkId;
  args: ReturnType<typeof opStackWithdrawalReplay>['args'];
  gas: bigint;
}): Call & { gas: bigint } =>
  ({
    to: OP_STACK_WITHDRAWAL[network].l1Messenger,
    abi: l2CrossDomainMessengerAbi,
    functionName: 'relayMessage',
    args,
    gas
  }) as unknown as Call & { gas: bigint };
