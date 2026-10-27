import { describe, expect, it } from 'vitest';
import {
  decodeEventLog,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  keccak256,
  parseAbi,
  type Address,
  type Hex
} from 'viem';
import {
  L1_USDS,
  L2_CROSS_DOMAIN_MESSENGER,
  OP_STACK_DEPOSIT,
  l2CrossDomainMessengerAbi
} from '../nativeDeposit/contracts';
import {
  OP_STACK_WITHDRAWAL,
  OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT,
  opStackL2TokenBridgeAbi,
  optimismPortalAbi
} from './contracts';
import {
  opStackFinalizeCall,
  opStackProveCall,
  opStackWithdrawalCall,
  opStackWithdrawalCalls,
  opStackWithdrawalMessage,
  opStackWithdrawalReplay,
  opStackWithdrawalReplayCall
} from './opStack';
import {
  BASE_EXTERNAL_FINALIZE_TX,
  BASE_FINALIZE_LOGS,
  BASE_FINALIZE_TX,
  BASE_PROVE_TX,
  BASE_WITHDRAWAL_LOGS,
  OPTIMISM_WITHDRAWAL_LOGS
} from './withdrawalFixtures';

const relayedMessageAbi = parseAbi(['event RelayedMessage(bytes32 indexed msgHash)']);
/** The finalize without a named prover, which the app never sends; only to read the real one. */
const plainFinalizeAbi = parseAbi([
  'struct WithdrawalTransaction { uint256 nonce; address sender; address target; uint256 value; uint256 gasLimit; bytes data; }',
  'function finalizeWithdrawalTransaction(WithdrawalTransaction _tx)'
]);

const hashWithdrawal = (tx: {
  nonce: bigint;
  sender: Address;
  target: Address;
  value: bigint;
  gasLimit: bigint;
  data: Hex;
}) =>
  keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes' }
      ],
      [tx.nonce, tx.sender, tx.target, tx.value, tx.gasLimit, tx.data]
    )
  );

/** The L1 USDS the finalize released, read from the token's own Transfer log. */
const usdsReleased = () =>
  BASE_FINALIZE_LOGS.flatMap(log => {
    if (!isAddressEqual(log.address, L1_USDS)) return [];
    const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
    return event.eventName === 'Transfer' ? [event.args] : [];
  });

describe('OP Stack withdrawal message (golden: a real Base withdrawal of USDS and sUSDS in one tx)', () => {
  const message = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;

  it('picks the USDS withdrawal, the one proved and finalized on Ethereum', () => {
    const proved = decodeFunctionData({ abi: optimismPortalAbi, data: BASE_PROVE_TX.input });
    if (proved.functionName !== 'proveWithdrawalTransaction') throw new Error('Not a prove');
    const [tx] = proved.args;
    expect(message.withdrawal.withdrawalHash).toBe(hashWithdrawal(tx));
    expect(message.withdrawal).toMatchObject(tx);
  });

  it('keys the message as the L1 messenger does, so successfulMessages reads it', () => {
    const relayed = BASE_FINALIZE_LOGS.filter(log =>
      isAddressEqual(log.address, OP_STACK_WITHDRAWAL.base.l1Messenger)
    ).flatMap(log => {
      try {
        return [decodeEventLog({ abi: relayedMessageAbi, data: log.data, topics: log.topics }).args.msgHash];
      } catch {
        return [];
      }
    });
    expect(relayed).toEqual([message.msgHash]);
  });

  it('reads the recipient and amount the escrow paid on Ethereum', () => {
    const [transfer] = usdsReleased();
    expect(transfer.from).toBe(OP_STACK_WITHDRAWAL.base.l1Escrow);
    expect(isAddressEqual(message.to, transfer.to)).toBe(true);
    expect(message.amount).toBe(transfer.value);
  });

  it('was sent with the minGasLimit the app uses', () => {
    expect(message.minGasLimit).toBe(BigInt(OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT));
  });

  it('picks the USDS one of a bundled OP Mainnet withdrawal too', () => {
    const op = opStackWithdrawalMessage(OPTIMISM_WITHDRAWAL_LOGS, 'optimism')!;
    expect(op).toBeDefined();
    expect(op.withdrawal.target).toBe(OP_STACK_WITHDRAWAL.optimism.l1Messenger);
    expect(op.withdrawal.data.toLowerCase()).toContain(L1_USDS.slice(2).toLowerCase());
  });

  it("finds nothing in another network's receipt, or in logs not emitted by the bridge and the message passer", () => {
    expect(opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'optimism')).toBeUndefined();
    const forged = BASE_WITHDRAWAL_LOGS.map(log => ({
      ...log,
      address: '0x000000000000000000000000000000000000dEaD' as Address
    }));
    expect(opStackWithdrawalMessage(forged, 'base')).toBeUndefined();
  });

  it('refuses a receipt with two USDS withdrawals: it would not know which one the user sent', () => {
    const usdsLogs = BASE_WITHDRAWAL_LOGS.filter(
      log =>
        isAddressEqual(log.address, OP_STACK_DEPOSIT.base.l2TokenBridge) ||
        log.address.toLowerCase() === '0x4200000000000000000000000000000000000016'
    );
    expect(opStackWithdrawalMessage([...BASE_WITHDRAWAL_LOGS, ...usdsLogs], 'base')).toBeUndefined();
  });
});

describe('OP Stack withdrawal call', () => {
  const recipient = '0x1111111111111111111111111111111111111111';

  it('calls bridgeERC20To on the L2 bridge with the L2 and L1 USDS, the recipient and 500,000 gas', () => {
    const call = opStackWithdrawalCall({ network: 'unichain', recipient, amount: 5n });
    expect(call.address).toBe(OP_STACK_DEPOSIT.unichain.l2TokenBridge);
    expect(call.abi).toBe(opStackL2TokenBridgeAbi);
    expect(call.functionName).toBe('bridgeERC20To');
    expect(call.args).toEqual([OP_STACK_DEPOSIT.unichain.l2Usds, L1_USDS, recipient, 5n, 500_000, '0x']);
  });

  it('approves the L2 bridge for exactly the amount, on the L2 USDS, when the allowance is short', () => {
    const calls = opStackWithdrawalCalls({ network: 'base', allowance: 4n, amount: 5n, recipient });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      to: OP_STACK_DEPOSIT.base.l2Usds,
      functionName: 'approve',
      args: [OP_STACK_DEPOSIT.base.l2TokenBridge, 5n]
    });
    expect(calls[1]).toMatchObject({
      to: OP_STACK_DEPOSIT.base.l2TokenBridge,
      functionName: 'bridgeERC20To'
    });
    expect(opStackWithdrawalCalls({ network: 'base', allowance: 5n, amount: 5n, recipient })).toHaveLength(1);
  });

  it.each([
    ['the zero address', '0x0000000000000000000000000000000000000000'],
    ['the L1 escrow', OP_STACK_WITHDRAWAL.base.l1Escrow],
    ['the L1 messenger', OP_STACK_WITHDRAWAL.optimism.l1Messenger],
    ['L1 USDS', L1_USDS],
    ['the L2 messenger', L2_CROSS_DOMAIN_MESSENGER]
  ])('is never built for %s', (_, address) => {
    expect(() =>
      opStackWithdrawalCall({ network: 'base', recipient: address as Address, amount: 1n })
    ).toThrow();
  });
});

describe('OP Stack prove and finalize calls (golden: the same Base withdrawal)', () => {
  const { withdrawal } = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;

  it('builds the real prove calldata from its parts', () => {
    const { args } = decodeFunctionData({ abi: optimismPortalAbi, data: BASE_PROVE_TX.input });
    const [, disputeGameIndex, outputRootProof, withdrawalProof] = args as readonly [
      unknown,
      bigint,
      { version: Hex; stateRoot: Hex; messagePasserStorageRoot: Hex; latestBlockhash: Hex },
      readonly Hex[]
    ];
    const call = opStackProveCall({
      network: 'base',
      withdrawal,
      disputeGameIndex,
      outputRootProof,
      withdrawalProof
    });
    expect(isAddressEqual(call.address, BASE_PROVE_TX.to)).toBe(true);
    expect(encodeFunctionData(call)).toBe(BASE_PROVE_TX.input);
  });

  it('finalizes with the prover named, which the real plain finalize by the prover is equivalent to', () => {
    const call = opStackFinalizeCall({ network: 'base', withdrawal, proofSubmitter: BASE_PROVE_TX.from });
    expect(isAddressEqual(call.address, BASE_FINALIZE_TX.to)).toBe(true);
    const decoded = decodeFunctionData({ abi: optimismPortalAbi, data: encodeFunctionData(call) });
    expect(decoded.functionName).toBe('finalizeWithdrawalTransactionExternalProof');
    const real = decodeFunctionData({ abi: plainFinalizeAbi, data: BASE_FINALIZE_TX.input });
    expect(decoded.args[0]).toEqual(real.args[0]);
    expect(isAddressEqual(decoded.args[1] as Address, BASE_FINALIZE_TX.from)).toBe(true);
  });

  it('encodes ExternalProof exactly as a real Base finalize with another wallet’s proof', () => {
    const real = decodeFunctionData({ abi: optimismPortalAbi, data: BASE_EXTERNAL_FINALIZE_TX.input });
    expect(real.functionName).toBe('finalizeWithdrawalTransactionExternalProof');
    const [tx, proofSubmitter] = real.args as readonly [Parameters<typeof hashWithdrawal>[0], Address];
    const call = opStackFinalizeCall({
      network: 'base',
      withdrawal: { ...tx, withdrawalHash: hashWithdrawal(tx) },
      proofSubmitter
    });
    expect(encodeFunctionData(call)).toBe(BASE_EXTERNAL_FINALIZE_TX.input);
  });
});

describe('OP Stack retry on Ethereum (a finalized withdrawal whose relay failed)', () => {
  const message = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
  const routeData = { msgHash: message.msgHash, relayCalldata: message.withdrawal.data };

  it('replays the stored relay on the L1 messenger, after checking it against its hash', () => {
    const replay = opStackWithdrawalReplay('base', routeData);
    const call = opStackWithdrawalReplayCall({ network: 'base', args: replay.args, gas: 900_000n });
    expect(call.to).toBe(OP_STACK_WITHDRAWAL.base.l1Messenger);
    expect(call.gas).toBe(900_000n);
    expect(call.args).toEqual(
      decodeFunctionData({ abi: l2CrossDomainMessengerAbi, data: message.withdrawal.data }).args
    );
  });

  it.each([
    ['a tampered hash', { ...routeData, msgHash: keccak256('0x01') }],
    ['missing calldata', { msgHash: message.msgHash }],
    ['another network', routeData]
  ])('refuses %s', (label, data) => {
    expect(() => opStackWithdrawalReplay(label === 'another network' ? 'optimism' : 'base', data)).toThrow();
  });
});
