import { getAddress, numberToHex, pad, parseEther, size, type Address, type Call, type Hex } from 'viem';
import { arbitrumInboxImplementationAbi } from '@/hooks/generated';
import {
  arbitrumDepositCall,
  arbitrumOutboundCalldata,
  type RetryableEstimates,
  type RetryableQuote
} from './arbitrum';
import { ARBITRUM_DEPOSIT, NODE_INTERFACE, nodeInterfaceAbi, withApprove } from './contracts';

type L1Reader = {
  readContract: (args: {
    address: Address;
    abi: typeof arbitrumInboxImplementationAbi;
    functionName: 'calculateRetryableSubmissionFee';
    args: readonly [bigint, bigint];
  }) => Promise<bigint>;
  getBlock: () => Promise<{ baseFeePerGas: bigint | null }>;
};

type L2Reader = {
  estimateContractGas: (args: {
    address: Address;
    abi: typeof nodeInterfaceAbi;
    functionName: 'estimateRetryableTicket';
    args: readonly [Address, bigint, Address, bigint, Address, Address, Hex];
  }) => Promise<bigint>;
  estimateGas: (args: { account: Address; to: Address; data: Hex }) => Promise<bigint>;
  getGasPrice: () => Promise<bigint>;
};

/** L2 gas of the ticket's auto-redeem: the L2 gateway's mint, called by the aliased L1 gateway. */
export type RetryableGasEstimator = (args: {
  l2: L2Reader;
  from: Address;
  refundTo: Address;
  data: Hex;
}) => Promise<bigint>;

/** What the ticket's estimate funds itself with; NodeInterface only needs it to cover the fees. */
const ESTIMATE_DEPOSIT = parseEther('1');

/** Arbitrum's own estimator, as the official SDK uses it. */
export const nodeInterfaceGas: RetryableGasEstimator = ({ l2, from, refundTo, data }) =>
  l2.estimateContractGas({
    address: NODE_INTERFACE,
    abi: nodeInterfaceAbi,
    functionName: 'estimateRetryableTicket',
    args: [ARBITRUM_DEPOSIT.l1Gateway, ESTIMATE_DEPOSIT, ARBITRUM_DEPOSIT.l2Gateway, 0n, refundTo, from, data]
  });

const ALIAS_OFFSET = 0x1111000000000000000000000000000000001111n;

/** The address an L1 contract acts as on Arbitrum. */
export const l1ToL2Alias = (address: Address): Address =>
  getAddress(pad(numberToHex((BigInt(address) + ALIAS_OFFSET) % 2n ** 160n), { size: 20 }));

/** A plain estimate of the mint from the aliased gateway, for forks whose NodeInterface doesn't run. */
export const aliasedGatewayGas: RetryableGasEstimator = ({ l2, data }) =>
  l2.estimateGas({
    account: l1ToL2Alias(ARBITRUM_DEPOSIT.l1Gateway),
    to: ARBITRUM_DEPOSIT.l2Gateway,
    data
  });

const unpriced = () => new Error('The Arbitrum deposit could not be priced');

/**
 * Reads what one deposit's ticket costs: the submission fee at Ethereum's latest base fee, and
 * the auto-redeem's gas and the gas price on Arbitrum. Throws when any read
 * fails or comes back zero, so no deposit is built without a price.
 */
export async function readRetryableEstimates({
  l1,
  l2,
  from,
  refundTo,
  recipient,
  amount,
  estimateGas = nodeInterfaceGas
}: {
  l1: L1Reader;
  l2: L2Reader;
  from: Address;
  refundTo: Address;
  recipient: Address;
  amount: bigint;
  estimateGas?: RetryableGasEstimator;
}): Promise<RetryableEstimates> {
  const data = arbitrumOutboundCalldata({ from, to: recipient, amount });
  const [block, gasEstimate, l2GasPrice] = await Promise.all([
    l1.getBlock(),
    estimateGas({ l2, from, refundTo, data }),
    l2.getGasPrice()
  ]);
  const baseFee = block.baseFeePerGas ?? 0n;
  if (baseFee <= 0n || gasEstimate <= 0n || l2GasPrice <= 0n) throw unpriced();
  // Passed explicitly: an eth_call without a gas price runs with a zero block.basefee, which prices the fee at 0.
  const submissionFee = await l1.readContract({
    address: ARBITRUM_DEPOSIT.inbox,
    abi: arbitrumInboxImplementationAbi,
    functionName: 'calculateRetryableSubmissionFee',
    args: [BigInt(size(data)), baseFee]
  });
  if (submissionFee <= 0n) throw unpriced();
  return { submissionFee, gasEstimate, l2GasPrice };
}

/**
 * The source calls of a deposit: an approve of exactly `amount` to the L1
 * gateway when the allowance is short, then the deposit with its ETH.
 */
export function arbitrumDepositCalls({
  allowance,
  amount,
  recipient,
  refundTo,
  quote
}: {
  allowance: bigint;
  amount: bigint;
  recipient: Address;
  refundTo: Address;
  quote: RetryableQuote;
}): Call[] {
  const { address, ...deposit } = arbitrumDepositCall({ recipient, refundTo, amount, quote });
  return withApprove({
    allowance,
    amount,
    spender: ARBITRUM_DEPOSIT.l1Gateway,
    deposit: { to: address, ...deposit } as unknown as Call
  });
}
