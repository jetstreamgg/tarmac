import {
  decodeEventLog,
  decodeFunctionData,
  isAddressEqual,
  type Address,
  type Call,
  type Hex,
  type Log
} from 'viem';
import { skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import { isBlockedRecipient } from '../../model/recipient';
import { ARBITRUM_DEPOSIT, L1_USDS, withApprove } from '../nativeDeposit/contracts';
import {
  ARB_SYS,
  ARBITRUM_WITHDRAWAL,
  arbSysAbi,
  arbitrumL2TokenGatewayAbi,
  arbitrumOutboxAbi
} from './contracts';

export const arbitrumWithdrawalCall = ({ recipient, amount }: { recipient: Address; amount: bigint }) => {
  if (isBlockedRecipient(recipient))
    throw new Error('A bridge withdrawal needs a recipient that can hold USDS');
  return {
    address: ARBITRUM_DEPOSIT.l2Gateway,
    abi: arbitrumL2TokenGatewayAbi,
    functionName: 'outboundTransfer',
    args: [L1_USDS, recipient, amount, '0x']
  } as const;
};

/** The source calls of a withdrawal: the gateway burns from the sender, so an approve of exactly `amount` of L2 USDS when short. */
export function arbitrumWithdrawalCalls({
  allowance,
  amount,
  recipient
}: {
  allowance: bigint;
  amount: bigint;
  recipient: Address;
}): Call[] {
  const { address, ...withdrawal } = arbitrumWithdrawalCall({ recipient, amount });
  return withApprove({
    allowance,
    amount,
    spender: address,
    token: ARBITRUM_DEPOSIT.l2Usds,
    deposit: { to: address, ...withdrawal } as unknown as Call
  });
}

/** The outbox leaf of a withdrawal, as ArbSys emitted it: what executeTransaction takes besides the proof. */
export type ArbitrumWithdrawalMessage = {
  position: bigint;
  l2Sender: Address;
  destination: Address;
  arbBlockNum: bigint;
  ethBlockNum: bigint;
  timestamp: bigint;
  callvalue: bigint;
  data: Hex;
  from: Address;
  to: Address;
  amount: bigint;
};

const decodeLogs = <const abi extends typeof arbSysAbi | typeof arbitrumL2TokenGatewayAbi>(
  logs: Log[],
  address: Address,
  abi: abi
) =>
  logs.flatMap(log => {
    if (!isAddressEqual(log.address, address)) return [];
    try {
      return [decodeEventLog({ abi, data: log.data, topics: log.topics })];
    } catch {
      return [];
    }
  });

/**
 * The USDS withdrawal of an Arbitrum receipt: Sky's gateway WithdrawalInitiated
 * and the ArbSys L2ToL1Tx at the same position, sent by the gateway to the L1
 * gateway with no ETH. Anything else, or more than one, is undefined.
 */
export function arbitrumWithdrawalMessage(logs: Log[]): ArbitrumWithdrawalMessage | undefined {
  const initiated = decodeLogs(logs, ARBITRUM_DEPOSIT.l2Gateway, arbitrumL2TokenGatewayAbi).flatMap(event =>
    event.eventName === 'WithdrawalInitiated' && isAddressEqual(event.args.l1Token, L1_USDS)
      ? [event.args]
      : []
  );
  const sent = decodeLogs(logs, ARB_SYS, arbSysAbi).flatMap(event =>
    event.eventName === 'L2ToL1Tx' ? [event.args] : []
  );
  const messages = initiated.flatMap(withdrawal => {
    const leaf = sent.find(tx => tx.position === withdrawal._l2ToL1Id);
    if (!leaf || !isAddressEqual(leaf.caller, ARBITRUM_DEPOSIT.l2Gateway)) return [];
    if (!isAddressEqual(leaf.destination, ARBITRUM_DEPOSIT.l1Gateway) || leaf.callvalue !== 0n) return [];
    try {
      const release = decodeFunctionData({ abi: skyL1TokenGatewayImplementationAbi, data: leaf.data });
      if (release.functionName !== 'finalizeInboundTransfer') return [];
      const [token, from, to, amount] = release.args;
      if (
        !isAddressEqual(token, L1_USDS) ||
        !isAddressEqual(to, withdrawal._to) ||
        amount !== withdrawal._amount
      )
        return [];
      return [
        {
          position: leaf.position,
          l2Sender: leaf.caller,
          destination: leaf.destination,
          arbBlockNum: leaf.arbBlockNum,
          ethBlockNum: leaf.ethBlockNum,
          timestamp: leaf.timestamp,
          callvalue: leaf.callvalue,
          data: leaf.data,
          from,
          to,
          amount
        }
      ];
    } catch {
      return [];
    }
  });
  return messages.length === 1 ? messages[0] : undefined;
}

/** The execute on the outbox, with the proof NodeInterface's constructOutboxProof returned for the leaf. */
export const arbitrumExecuteCall = ({
  message,
  proof
}: {
  message: ArbitrumWithdrawalMessage;
  proof: readonly Hex[];
}) =>
  ({
    address: ARBITRUM_WITHDRAWAL.outbox,
    abi: arbitrumOutboxAbi,
    functionName: 'executeTransaction',
    args: [
      proof,
      message.position,
      message.l2Sender,
      message.destination,
      message.arbBlockNum,
      message.ethBlockNum,
      message.timestamp,
      message.callvalue,
      message.data
    ]
  }) as const;
