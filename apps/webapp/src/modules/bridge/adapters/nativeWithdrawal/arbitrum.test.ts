import { describe, expect, it } from 'vitest';
import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  type Address,
  type Hex
} from 'viem';
import { ARBITRUM_DEPOSIT, L1_USDS } from '../nativeDeposit/contracts';
import { ARB_SYS, ARBITRUM_WITHDRAWAL, arbitrumL2TokenGatewayAbi, arbitrumOutboxAbi } from './contracts';
import {
  arbitrumExecuteCall,
  arbitrumWithdrawalCall,
  arbitrumWithdrawalCalls,
  arbitrumWithdrawalMessage
} from './arbitrum';
import { ARBITRUM_EXECUTE_LOGS, ARBITRUM_EXECUTE_TX, ARBITRUM_WITHDRAWAL_LOGS } from './withdrawalFixtures';

const realExecute = () => {
  const { functionName, args } = decodeFunctionData({
    abi: arbitrumOutboxAbi,
    data: ARBITRUM_EXECUTE_TX.input
  });
  expect(functionName).toBe('executeTransaction');
  return args as readonly [readonly Hex[], bigint, Address, Address, bigint, bigint, bigint, bigint, Hex];
};

describe('Arbitrum withdrawal message (golden: a real withdrawal executed on Ethereum)', () => {
  const message = arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!;

  it('reads the outbox leaf the real execute spent', () => {
    const [, index, l2Sender, to, l2Block, l1Block, l2Timestamp, value, data] = realExecute();
    expect(message.position).toBe(index);
    expect(isAddressEqual(message.l2Sender, l2Sender)).toBe(true);
    expect(isAddressEqual(message.destination, to)).toBe(true);
    expect(message).toMatchObject({ arbBlockNum: l2Block, ethBlockNum: l1Block, timestamp: l2Timestamp });
    expect(message.callvalue).toBe(value);
    expect(message.data).toBe(data);
  });

  it('reads the recipient and amount the escrow paid on Ethereum', () => {
    const [transfer] = ARBITRUM_EXECUTE_LOGS.flatMap(log => {
      if (!isAddressEqual(log.address, L1_USDS)) return [];
      const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      return event.eventName === 'Transfer' ? [event.args] : [];
    });
    expect(transfer.from).toBe(ARBITRUM_WITHDRAWAL.l1Escrow);
    expect(isAddressEqual(message.to, transfer.to)).toBe(true);
    expect(message.amount).toBe(transfer.value);
  });

  it('finds nothing in logs not emitted by the gateway and ArbSys', () => {
    const forged = ARBITRUM_WITHDRAWAL_LOGS.map(log => ({
      ...log,
      address: '0x000000000000000000000000000000000000dEaD' as Address
    }));
    expect(arbitrumWithdrawalMessage(forged)).toBeUndefined();
    const withoutGateway = ARBITRUM_WITHDRAWAL_LOGS.filter(
      log => !isAddressEqual(log.address, ARBITRUM_DEPOSIT.l2Gateway)
    );
    expect(arbitrumWithdrawalMessage(withoutGateway)).toBeUndefined();
  });

  it('refuses a receipt with two USDS withdrawals', () => {
    const own = ARBITRUM_WITHDRAWAL_LOGS.filter(
      log => isAddressEqual(log.address, ARBITRUM_DEPOSIT.l2Gateway) || isAddressEqual(log.address, ARB_SYS)
    );
    expect(arbitrumWithdrawalMessage([...ARBITRUM_WITHDRAWAL_LOGS, ...own])).toBeUndefined();
  });
});

describe('Arbitrum execute call', () => {
  it('builds the real execute calldata from the message and its proof', () => {
    const [proof] = realExecute();
    const call = arbitrumExecuteCall({
      message: arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!,
      proof
    });
    expect(isAddressEqual(call.address, ARBITRUM_EXECUTE_TX.to)).toBe(true);
    expect(encodeFunctionData(call)).toBe(ARBITRUM_EXECUTE_TX.input);
  });
});

describe('Arbitrum withdrawal call', () => {
  const recipient = '0x1111111111111111111111111111111111111111';

  it('calls outboundTransfer on the L2 gateway with L1 USDS, the recipient and no extra data', () => {
    const call = arbitrumWithdrawalCall({ recipient, amount: 5n });
    expect(call.address).toBe(ARBITRUM_DEPOSIT.l2Gateway);
    expect(call.abi).toBe(arbitrumL2TokenGatewayAbi);
    expect(call.functionName).toBe('outboundTransfer');
    expect(call.args).toEqual([L1_USDS, recipient, 5n, '0x']);
  });

  it('approves the gateway for exactly the amount, on the L2 USDS it burns, when the allowance is short', () => {
    const calls = arbitrumWithdrawalCalls({ allowance: 0n, amount: 5n, recipient });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      to: ARBITRUM_DEPOSIT.l2Usds,
      functionName: 'approve',
      args: [ARBITRUM_DEPOSIT.l2Gateway, 5n]
    });
    expect(arbitrumWithdrawalCalls({ allowance: 5n, amount: 5n, recipient })).toHaveLength(1);
  });

  it.each([
    ['the zero address', '0x0000000000000000000000000000000000000000'],
    ['the L1 escrow', ARBITRUM_WITHDRAWAL.l1Escrow],
    ['the outbox', ARBITRUM_WITHDRAWAL.outbox],
    ['the L1 gateway', ARBITRUM_DEPOSIT.l1Gateway],
    ['ArbSys', ARB_SYS]
  ])('is never built for %s', (_, address) => {
    expect(() => arbitrumWithdrawalCall({ recipient: address as Address, amount: 1n })).toThrow();
  });
});
