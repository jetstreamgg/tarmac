import { describe, expect, it, vi } from 'vitest';
import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  parseEther,
  size,
  type Address
} from 'viem';
import { arbitrumOutboundCalldata, retryableQuote } from './arbitrum';
import {
  aliasedGatewayGas,
  arbitrumDepositCalls,
  l1ToL2Alias,
  nodeInterfaceGas,
  readRetryableEstimates
} from './arbitrumQuote';
import { ARBITRUM_DEPOSIT, L1_USDS, NODE_INTERFACE, arbitrumBridgeAbi } from './contracts';
import { ARBITRUM_DEPOSIT_LOGS, ARBITRUM_DEPOSIT_TX } from './depositFixtures';

const FROM = ARBITRUM_DEPOSIT_TX.from;
const RECIPIENT: Address = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const AMOUNT = parseEther('25');

const clients = (overrides: Partial<Record<'fee' | 'gas' | 'price', () => Promise<bigint>>> = {}) => ({
  l1: { readContract: vi.fn(overrides.fee ?? (() => Promise.resolve(510_224_272_976n))) },
  l2: {
    estimateContractGas: vi.fn(overrides.gas ?? (() => Promise.resolve(116_946n))),
    estimateGas: vi.fn(() => Promise.resolve(120_000n)),
    getGasPrice: vi.fn(overrides.price ?? (() => Promise.resolve(10_000_000n)))
  }
});

const read = (c: ReturnType<typeof clients>, estimateGas = nodeInterfaceGas) =>
  readRetryableEstimates({
    ...c,
    from: FROM,
    refundTo: RECIPIENT,
    recipient: RECIPIENT,
    amount: AMOUNT,
    estimateGas
  });

describe('readRetryableEstimates', () => {
  it("prices the deposit's own ticket: the fee for its calldata, NodeInterface gas from the gateway", async () => {
    const c = clients();
    const data = arbitrumOutboundCalldata({ from: FROM, to: RECIPIENT, amount: AMOUNT });
    await expect(read(c)).resolves.toEqual({
      submissionFee: 510_224_272_976n,
      gasEstimate: 116_946n,
      l2GasPrice: 10_000_000n
    });
    expect(c.l1.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ARBITRUM_DEPOSIT.inbox,
        functionName: 'calculateRetryableSubmissionFee',
        args: [BigInt(size(data)), 0n]
      })
    );
    expect(c.l2.estimateContractGas).toHaveBeenCalledWith(
      expect.objectContaining({
        address: NODE_INTERFACE,
        functionName: 'estimateRetryableTicket',
        args: [
          ARBITRUM_DEPOSIT.l1Gateway,
          parseEther('1'),
          ARBITRUM_DEPOSIT.l2Gateway,
          0n,
          RECIPIENT,
          FROM,
          data
        ]
      })
    );
    expect(c.l2.estimateGas).not.toHaveBeenCalled();
  });

  it.each(['fee', 'gas', 'price'] as const)('throws when the %s read fails or reads zero', async read_ => {
    await expect(read(clients({ [read_]: () => Promise.reject(new Error('rpc down')) }))).rejects.toThrow();
    await expect(read(clients({ [read_]: () => Promise.resolve(0n) }))).rejects.toThrow();
  });

  it("the fork estimator asks for the mint from the gateway's L2 alias", async () => {
    const c = clients();
    await expect(read(c, aliasedGatewayGas)).resolves.toMatchObject({ gasEstimate: 120_000n });
    expect(c.l2.estimateGas).toHaveBeenCalledWith({
      account: l1ToL2Alias(ARBITRUM_DEPOSIT.l1Gateway),
      to: ARBITRUM_DEPOSIT.l2Gateway,
      data: arbitrumOutboundCalldata({ from: FROM, to: RECIPIENT, amount: AMOUNT })
    });
  });
});

describe('l1ToL2Alias', () => {
  it('matches the sender the Arbitrum Bridge recorded for the real gateway deposit', () => {
    const delivered = ARBITRUM_DEPOSIT_LOGS.filter(log =>
      isAddressEqual(log.address, ARBITRUM_DEPOSIT.bridge)
    ).map(log => decodeEventLog({ abi: arbitrumBridgeAbi, data: log.data, topics: log.topics }));
    expect(delivered).toHaveLength(1);
    expect(l1ToL2Alias(ARBITRUM_DEPOSIT.l1Gateway)).toBe(delivered[0].args.sender);
  });

  it('wraps past the top of the address space', () => {
    expect(l1ToL2Alias('0xffffffffffffffffffffffffffffffffffffffff')).toBe(
      '0x1111000000000000000000000000000000001110'
    );
  });
});

describe('arbitrumDepositCalls', () => {
  const quote = retryableQuote({
    submissionFee: 510_224_272_976n,
    gasEstimate: 116_946n,
    l2GasPrice: 10_000_000n
  });
  const callData = (call: { to: Address; abi?: unknown; functionName?: string; args?: unknown }) =>
    encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0]);

  it('approves exactly the amount to the L1 gateway, then deposits with the quoted ETH', () => {
    const [approve, deposit, ...rest] = arbitrumDepositCalls({
      allowance: AMOUNT - 1n,
      amount: AMOUNT,
      recipient: RECIPIENT,
      refundTo: RECIPIENT,
      quote
    });
    expect(rest).toEqual([]);
    expect(approve.to).toBe(L1_USDS);
    expect(approve.value).toBeUndefined();
    expect(decodeFunctionData({ abi: erc20Abi, data: callData(approve as never) })).toEqual({
      functionName: 'approve',
      args: [ARBITRUM_DEPOSIT.l1Gateway, AMOUNT]
    });
    expect(deposit.to).toBe(ARBITRUM_DEPOSIT.l1Gateway);
    expect(deposit.value).toBe(quote.value);
    expect(deposit.functionName).toBe('outboundTransferCustomRefund');
    const [token, refundTo, to, value, maxGas, gasPriceBid] = deposit.args as readonly unknown[];
    expect([token, refundTo, to, value, maxGas, gasPriceBid]).toEqual([
      L1_USDS,
      RECIPIENT,
      RECIPIENT,
      AMOUNT,
      quote.maxGas,
      quote.gasPriceBid
    ]);
  });

  it('skips the approve when the allowance covers the amount', () => {
    for (const allowance of [AMOUNT, AMOUNT + 1n]) {
      const calls = arbitrumDepositCalls({
        allowance,
        amount: AMOUNT,
        recipient: RECIPIENT,
        refundTo: RECIPIENT,
        quote
      });
      expect(calls.map(call => call.functionName)).toEqual(['outboundTransferCustomRefund']);
    }
  });
});
