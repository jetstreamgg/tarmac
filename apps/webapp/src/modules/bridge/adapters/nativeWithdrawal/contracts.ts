import { parseAbi, type Address } from 'viem';
import {
  ARBITRUM_DEPOSIT,
  OP_STACK_DEPOSIT,
  type NativeDepositNetwork,
  type OpStackNetworkId
} from '../nativeDeposit/contracts';

/** Gas the L1 relay must forward to the L1 bridge's release, as in every past Sky withdrawal; too little leaves a failed message to retry. */
export const OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT = 500_000;

/** OP Stack predeploy that records every L2 to L1 message; its storage proof is what the portal proves. */
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016';

/** Arbitrum precompile that emits L2ToL1Tx for every L2 to L1 message. */
export const ARB_SYS: Address = '0x0000000000000000000000000000000000000064';

/** How long an Arbitrum withdrawal waits on the rollup before the outbox can execute it, in ms. */
export const ARBITRUM_CONFIRM_MS = 6.5 * 24 * 60 * 60 * 1000;

/** The L1 side of Sky's OP Stack withdrawals: the messenger relays the message, the escrow pays it out. */
export const OP_STACK_WITHDRAWAL: Record<OpStackNetworkId, { l1Escrow: Address; l1Messenger: Address }> = {
  base: {
    l1Escrow: '0x7F311a4D48377030bD810395f4CCfC03bdbe9Ef3',
    l1Messenger: '0x866E82a600A1414e583f7F13623F1aC5d58b0Afa'
  },
  optimism: {
    l1Escrow: '0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65',
    l1Messenger: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1'
  },
  unichain: {
    l1Escrow: '0x1196F688C585D3E5C895Ef8954FFB0dCDAfc566A',
    l1Messenger: '0x9A3D64E386C18Cb1d6d5179a9596A4B5736e98A6'
  }
};

/** The L1 side of Sky's Arbitrum withdrawals: the outbox executes the message once the rollup confirms it. */
export const ARBITRUM_WITHDRAWAL = {
  l1Escrow: '0xA10c7CE4b876998858b1a9E12b10092229539400',
  outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
  rollup: '0x4DCeB440657f21083db8aDd07665f8ddBe1DCfc0',
  /** Older outboxes the Arbitrum Bridge still allows; listed only so they can't receive a withdrawal. */
  legacyOutboxes: ['0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a', '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40']
} as const satisfies Record<string, Address | readonly Address[]>;

/** Every L1 contract the native withdrawals touch beyond the deposit ones; none of them can receive one. */
export const NATIVE_WITHDRAWAL_CONTRACTS: readonly Address[] = [
  ...Object.values(OP_STACK_WITHDRAWAL).flatMap(contracts => Object.values(contracts)),
  ...Object.values(ARBITRUM_WITHDRAWAL).flat()
];

/** Sky's OP Stack L2TokenBridge and Arbitrum L2TokenGateway: governance's switch and per-token limit on withdrawals. */
export const l2BridgeGateAbi = parseAbi([
  'function isOpen() view returns (uint256)',
  'function maxWithdraws(address l2Token) view returns (uint256)'
]);

/** The L2 contract a withdrawal from `network` approves and calls, and the L2 USDS it burns. */
export const l2WithdrawalBridge = (network: NativeDepositNetwork): { bridge: Address; l2Usds: Address } =>
  network === 'arbitrum'
    ? { bridge: ARBITRUM_DEPOSIT.l2Gateway, l2Usds: ARBITRUM_DEPOSIT.l2Usds }
    : { bridge: OP_STACK_DEPOSIT[network].l2TokenBridge, l2Usds: OP_STACK_DEPOSIT[network].l2Usds };

export const opStackL2TokenBridgeAbi = parseAbi([
  'function bridgeERC20To(address _localToken, address _remoteToken, address _to, uint256 _amount, uint32 _minGasLimit, bytes _extraData)',
  'event ERC20BridgeInitiated(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData)'
]);

export const arbitrumL2TokenGatewayAbi = parseAbi([
  'function outboundTransfer(address l1Token, address to, uint256 amount, bytes data) returns (bytes)',
  'event WithdrawalInitiated(address l1Token, address indexed _from, address indexed _to, uint256 indexed _l2ToL1Id, uint256 _exitNum, uint256 _amount)'
]);

/** OptimismPortal2 as deployed for OP Mainnet and Unichain (5.8.0) and Base (6.0.1); the parts withdrawals use. */
export const optimismPortalAbi = parseAbi([
  'struct WithdrawalTransaction { uint256 nonce; address sender; address target; uint256 value; uint256 gasLimit; bytes data; }',
  'struct OutputRootProof { bytes32 version; bytes32 stateRoot; bytes32 messagePasserStorageRoot; bytes32 latestBlockhash; }',
  'function proveWithdrawalTransaction(WithdrawalTransaction _tx, uint256 _disputeGameIndex, OutputRootProof _outputRootProof, bytes[] _withdrawalProof)',
  'function finalizeWithdrawalTransactionExternalProof(WithdrawalTransaction _tx, address _proofSubmitter)',
  'function checkWithdrawal(bytes32 _withdrawalHash, address _proofSubmitter) view',
  'function provenWithdrawals(bytes32 withdrawalHash, address proofSubmitter) view returns (address disputeGameProxy, uint64 timestamp)',
  'function numProofSubmitters(bytes32 _withdrawalHash) view returns (uint256)',
  'function proofSubmitters(bytes32 withdrawalHash, uint256 index) view returns (address)',
  'function finalizedWithdrawals(bytes32 withdrawalHash) view returns (bool)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function disputeGameFactory() view returns (address)',
  'function anchorStateRegistry() view returns (address)',
  'function paused() view returns (bool)',
  'event WithdrawalProvenExtension1(bytes32 indexed withdrawalHash, address indexed proofSubmitter)',
  'event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)',
  'error OptimismPortal_AlreadyFinalized()',
  'error OptimismPortal_BadTarget()',
  'error OptimismPortal_CallPaused()',
  'error OptimismPortal_GasEstimation()',
  'error OptimismPortal_ImproperDisputeGame()',
  'error OptimismPortal_InvalidDisputeGame()',
  'error OptimismPortal_InvalidMerkleProof()',
  'error OptimismPortal_InvalidOutputRootProof()',
  'error OptimismPortal_InvalidProofTimestamp()',
  'error OptimismPortal_InvalidRootClaim()',
  'error OptimismPortal_NoReentrancy()',
  'error OptimismPortal_ProofNotOldEnough()',
  'error OptimismPortal_Unproven()'
]);

export const anchorStateRegistryAbi = parseAbi([
  'function respectedGameType() view returns (uint32)',
  'function disputeGameFinalityDelaySeconds() view returns (uint256)',
  'function isGameProper(address game) view returns (bool)',
  'function isGameBlacklisted(address game) view returns (bool)',
  'function isGameRetired(address game) view returns (bool)',
  'function paused() view returns (bool)'
]);

export const disputeGameFactoryAbi = parseAbi([
  'struct GameSearchResult { uint256 index; bytes32 metadata; uint64 timestamp; bytes32 rootClaim; bytes extraData; }',
  'function gameCount() view returns (uint256)',
  'function gameAtIndex(uint256 index) view returns (uint32 gameType, uint64 timestamp, address proxy)',
  'function findLatestGames(uint32 gameType, uint256 start, uint256 n) view returns (GameSearchResult[] games)'
]);

/**
 * The dispute game reads both game kinds share: Base's AggregateVerifier
 * (by L2 block number, `expectedResolution`) and the OP and Unichain super
 * root fault games (by L2 timestamp, `maxClockDuration`).
 */
export const disputeGameAbi = parseAbi([
  'function status() view returns (uint8)',
  'function createdAt() view returns (uint64)',
  'function resolvedAt() view returns (uint64)',
  'function gameType() view returns (uint32)',
  'function rootClaim() pure returns (bytes32)',
  'function rootClaimByChainId(uint256 chainId) pure returns (bytes32)',
  'function l2SequenceNumber() pure returns (uint256)',
  'function wasRespectedGameTypeWhenCreated() view returns (bool)',
  'function expectedResolution() view returns (uint64)',
  'function maxClockDuration() view returns (uint64)'
]);

export const arbSysAbi = parseAbi([
  'event L2ToL1Tx(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)'
]);

export const arbitrumOutboxAbi = parseAbi([
  'function executeTransaction(bytes32[] proof, uint256 index, address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes data)',
  'function isSpent(uint256 index) view returns (bool)',
  'function roots(bytes32 root) view returns (bytes32 l2BlockHash)',
  'event SendRootUpdated(bytes32 indexed outputRoot, bytes32 indexed l2BlockHash)',
  'event OutBoxTransactionExecuted(address indexed to, address indexed l2Sender, uint256 indexed zero, uint256 transactionIndex)'
]);

export const nodeInterfaceOutboxAbi = parseAbi([
  'function constructOutboxProof(uint64 size, uint64 leaf) view returns (bytes32 send, bytes32 root, bytes32[] proof)'
]);
