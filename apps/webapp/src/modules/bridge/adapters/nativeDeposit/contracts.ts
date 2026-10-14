import { erc20Abi, parseAbi, type Address, type Call } from 'viem';
import { base, optimism, unichain } from 'viem/chains';
import type { BridgeNetworkId } from '../../model/networks';
import { isSystemAddress } from '../../model/systemAddresses';

export const L1_USDS: Address = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

/** The L2 mint to the zero address or a system or bridge contract reverts or traps the deposit, so none is built. */
export function assertRecipient(address: Address) {
  if (isSystemAddress(address, NATIVE_DEPOSIT_CONTRACTS))
    throw new Error('A bridge deposit needs a recipient that can hold USDS');
}

/** The deposit, after an approve of exactly `amount` to `spender` when the allowance is short. */
export function withApprove({
  allowance,
  amount,
  spender,
  deposit
}: {
  allowance: bigint;
  amount: bigint;
  spender: Address;
  deposit: Call;
}): Call[] {
  if (allowance >= amount) return [deposit];
  const approve = { to: L1_USDS, abi: erc20Abi, functionName: 'approve', args: [spender, amount] };
  return [approve as unknown as Call, deposit];
}

export type OpStackNetworkId = 'base' | 'optimism' | 'unichain';

export const isOpStackNetwork = (network: BridgeNetworkId): network is OpStackNetworkId =>
  network === 'base' || network === 'optimism' || network === 'unichain';

/** The networks Sky's native bridges deposit to from Ethereum. */
export type NativeDepositNetwork = 'arbitrum' | OpStackNetworkId;

export const isNativeDepositNetwork = (network: BridgeNetworkId): network is NativeDepositNetwork =>
  network === 'arbitrum' || isOpStackNetwork(network);

/** Sky's OP Stack token bridges; the portal emits the L2 deposit transaction. */
export const OP_STACK_DEPOSIT: Record<
  OpStackNetworkId,
  { l1TokenBridge: Address; l2TokenBridge: Address; l2Usds: Address; portal: Address }
> = {
  base: {
    l1TokenBridge: '0xA5874756416Fa632257eEA380CAbd2E87cED352A',
    l2TokenBridge: '0xee44cdb68D618d58F75d9fe0818B640BD7B8A7B7',
    l2Usds: '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc',
    portal: base.contracts.portal[1].address
  },
  optimism: {
    l1TokenBridge: '0x3d25B7d486caE1810374d37A48BCf0963c9B8057',
    l2TokenBridge: '0x8F41DBF6b8498561Ce1d73AF16CD9C0d8eE20ba6',
    l2Usds: '0x4F13a96EC5C4Cf34e442b46Bbd98a0791F20edC3',
    portal: optimism.contracts.portal[1].address
  },
  unichain: {
    l1TokenBridge: '0xDF0535a4C96c9Cd8921d8FeC92A7680b281681d2',
    l2TokenBridge: '0xa13152006D0216Fe4627a0D3B006087A6a55D752',
    l2Usds: '0x7E10036Acc4B56d4dFCa3b77810356CE52313F9C',
    portal: unichain.contracts.portal[1].address
  }
};

/** Sky's Arbitrum gateway and the Arbitrum One contracts its retryable tickets go through. */
export const ARBITRUM_DEPOSIT = {
  l1Gateway: '0x84b9700E28B23F873b82c1BEb23d86C091b6079E',
  l2Gateway: '0x13F7F24CA959359a4D710D32c715D4bce273C793',
  l2Usds: '0x6491c05A82219b8D1479057361ff1654749b876b',
  inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
  /** Arbitrum's gateway routers, which the deposit skips; listed only so they can't receive one. */
  l1Router: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
  l2Router: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
  /** ArbOS chain id, part of every ticket id (a fork keeps it). */
  chainId: 42161n
} as const satisfies Record<string, Address | bigint>;

/** Governance's switch on the L1 bridge and gateway: deposits need it at exactly 1. */
export const l1BridgeIsOpenAbi = parseAbi(['function isOpen() view returns (uint256)']);

// Chain system contracts: predeploys and precompiles with no Etherscan-verified ABI for the wagmi generation.
export const L2_CROSS_DOMAIN_MESSENGER: Address = '0x4200000000000000000000000000000000000007';
export const ARB_RETRYABLE_TX: Address = '0x000000000000000000000000000000000000006E';
export const NODE_INTERFACE: Address = '0x00000000000000000000000000000000000000C8';

export const l2CrossDomainMessengerAbi = parseAbi([
  'function relayMessage(uint256 nonce, address sender, address target, uint256 value, uint256 minGasLimit, bytes message) payable',
  'function successfulMessages(bytes32 msgHash) view returns (bool)',
  'function failedMessages(bytes32 msgHash) view returns (bool)',
  'function baseGas(bytes message, uint32 minGasLimit) pure returns (uint64)',
  'event RelayedMessage(bytes32 indexed msgHash)',
  'event FailedRelayedMessage(bytes32 indexed msgHash)'
]);

export const arbRetryableTxAbi = parseAbi([
  'function redeem(bytes32 ticketId) returns (bytes32)',
  'function keepalive(bytes32 ticketId) returns (uint256)',
  'function getTimeout(bytes32 ticketId) view returns (uint256)',
  'function getLifetime() view returns (uint256)',
  'event TicketCreated(bytes32 indexed ticketId)',
  'event RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash, uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor, uint256 maxRefund, uint256 submissionFeeRefund)',
  'event LifetimeExtended(bytes32 indexed ticketId, uint256 newTimeout)',
  'error NoTicketWithID()'
]);

export const nodeInterfaceAbi = parseAbi([
  'function estimateRetryableTicket(address sender, uint256 deposit, address to, uint256 l2CallValue, address excessFeeRefundAddress, address callValueRefundAddress, bytes data)'
]);

/** Emitted by the Arbitrum Bridge for every inbox message; its sender is the aliased L1 gateway. */
export const arbitrumBridgeAbi = parseAbi([
  'event MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc, address inbox, uint8 kind, address sender, bytes32 messageDataHash, uint256 baseFeeL1, uint64 timestamp)'
]);

/** Every contract the native deposits touch on either side; none of them can receive one. */
export const NATIVE_DEPOSIT_CONTRACTS: readonly Address[] = [
  L1_USDS,
  ...Object.values(OP_STACK_DEPOSIT).flatMap(contracts => Object.values(contracts)),
  ...Object.values(ARBITRUM_DEPOSIT).flatMap(value => (typeof value === 'string' ? [value] : [])),
  L2_CROSS_DOMAIN_MESSENGER,
  ARB_RETRYABLE_TX,
  NODE_INTERFACE
];
