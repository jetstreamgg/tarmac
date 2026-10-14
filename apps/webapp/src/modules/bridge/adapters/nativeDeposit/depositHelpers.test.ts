import { describe, expect, it } from 'vitest';
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  keccak256,
  zeroAddress,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { skyL1TokenBridgeImplementationAbi, skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import {
  arbitrumDepositCall,
  arbitrumOutboundCalldata,
  arbitrumRetryableTicket,
  retryableQuote
} from './arbitrum';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  L2_CROSS_DOMAIN_MESSENGER,
  l2CrossDomainMessengerAbi,
  OP_STACK_DEPOSIT
} from './contracts';
import {
  ARBITRUM_DEPOSIT_LOGS,
  ARBITRUM_DEPOSIT_TX,
  BASE_DEPOSIT_LOGS,
  BASE_DEPOSIT_TX,
  OPTIMISM_DEPOSIT_LOGS,
  OPTIMISM_DEPOSIT_TX,
  UNICHAIN_DEPOSIT_LOGS,
  UNICHAIN_DEPOSIT_TX
} from './depositFixtures';
import {
  OP_STACK_MIN_GAS_LIMIT,
  opStackDepositCall,
  opStackDepositCalls,
  opStackDepositMessage,
  opStackReplay,
  opStackReplayCall,
  opStackReplayGas
} from './opStack';

const SUSDS = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD';

describe('OP Stack deposit (golden: Base mainnet deposit 0x36f35ee8…537f)', () => {
  it('builds the same bridgeERC20To calldata as the real deposit', () => {
    const real = decodeFunctionData({
      abi: skyL1TokenBridgeImplementationAbi,
      data: BASE_DEPOSIT_TX.input
    });
    const [, , recipient, amount, minGasLimit, extraData] = real.args as readonly [
      Address,
      Address,
      Address,
      bigint,
      number,
      Hex
    ];
    const call = opStackDepositCall({ network: 'base', recipient, amount });
    expect(call.address).toBe(OP_STACK_DEPOSIT.base.l1TokenBridge);
    expect(minGasLimit).toBe(OP_STACK_MIN_GAS_LIMIT);
    // The real deposit came from Superbridge, which tags extraData; the L2 bridge only echoes it in an event.
    expect(call.args[5]).toBe('0x');
    const [token, l2Token, to, value, gas] = call.args;
    expect(encodeFunctionData({ ...call, args: [token, l2Token, to, value, gas, extraData] })).toBe(
      BASE_DEPOSIT_TX.input
    );
  });

  it('reads the msgHash and L2 tx hash that Base relayed', () => {
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'base')).toMatchObject({
      msgHash: '0x1bf132c3ab73d979a2bcff617342e2462d0cc34cff279206cb859b4912466fb7',
      l2TxHash: '0xaaea002ad43a667914e489cc586677f3b974b1c195c721a8510b12374aec0570'
    });
  });

  it('ignores the deposit on another network, whose portal and bridge differ', () => {
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'optimism')).toBeUndefined();
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'unichain')).toBeUndefined();
  });

  it('ignores a portal log from any other contract, and a receipt with two deposits', () => {
    const portalIndex = BASE_DEPOSIT_LOGS.findIndex(
      log => getAddress(log.address) === OP_STACK_DEPOSIT.base.portal
    );
    const forged = BASE_DEPOSIT_LOGS.map((log, i) =>
      i === portalIndex ? ({ ...log, address: '0x0000000000000000000000000000000000000bad' } as Log) : log
    );
    expect(opStackDepositMessage(forged, 'base')).toBeUndefined();
    expect(
      opStackDepositMessage([...BASE_DEPOSIT_LOGS, BASE_DEPOSIT_LOGS[portalIndex]], 'base')
    ).toBeUndefined();
    expect(opStackDepositMessage([], 'base')).toBeUndefined();
  });
});

describe.each([
  {
    network: 'optimism' as const,
    tx: OPTIMISM_DEPOSIT_TX,
    logs: OPTIMISM_DEPOSIT_LOGS,
    msgHash: '0x1e0fa0ae74e4b247bb776bf2bd5af5e608bf34484072c87b0c873e5638ad6d1a'
  },
  {
    network: 'unichain' as const,
    tx: UNICHAIN_DEPOSIT_TX,
    logs: UNICHAIN_DEPOSIT_LOGS,
    msgHash: '0xfd61cf18045fc72f8c1b911e1a28004c30a5904f53b2a50b2b1f8ef9835ff8af'
  }
])('OP Stack deposit to $network (golden: a real mainnet deposit)', ({ network, tx, logs, msgHash }) => {
  it('builds the same bridgeERC20To call as the real deposit, with no ETH and at least its gas', () => {
    const real = decodeFunctionData({ abi: skyL1TokenBridgeImplementationAbi, data: tx.input });
    const [, , recipient, amount, minGasLimit, extraData] = real.args as readonly [
      Address,
      Address,
      Address,
      bigint,
      number,
      Hex
    ];
    expect(tx.value).toBe(0n);
    // The real deposit forwarded 200k; ours forwards at least as much.
    expect(OP_STACK_MIN_GAS_LIMIT).toBeGreaterThanOrEqual(minGasLimit);
    const call = opStackDepositCall({ network, recipient, amount });
    expect(call.address).toBe(OP_STACK_DEPOSIT[network].l1TokenBridge);
    const [token, l2Token, to, value] = call.args;
    expect(encodeFunctionData({ ...call, args: [token, l2Token, to, value, minGasLimit, extraData] })).toBe(
      tx.input
    );
  });

  it('reads the msgHash the L2 messenger relayed', () => {
    expect(opStackDepositMessage(logs, network)?.msgHash).toBe(msgHash);
  });

  it('ignores the deposit on the other OP Stack networks', () => {
    for (const other of (['base', 'optimism', 'unichain'] as const).filter(n => n !== network))
      expect(opStackDepositMessage(logs, other)).toBeUndefined();
  });
});

describe.each([
  { network: 'base' as const, logs: BASE_DEPOSIT_LOGS },
  { network: 'optimism' as const, logs: OPTIMISM_DEPOSIT_LOGS },
  { network: 'unichain' as const, logs: UNICHAIN_DEPOSIT_LOGS }
])('opStackReplay on $network (golden: a real mainnet deposit message)', ({ network, logs }) => {
  const message = opStackDepositMessage(logs, network)!;
  const routeData = { msgHash: message.msgHash, relayCalldata: message.relayCalldata };
  const relay = (patch: (args: readonly unknown[]) => readonly unknown[]) => {
    const { args } = decodeFunctionData({ abi: l2CrossDomainMessengerAbi, data: message.relayCalldata });
    const relayCalldata = encodeFunctionData({
      abi: l2CrossDomainMessengerAbi,
      functionName: 'relayMessage',
      args: patch(args) as readonly [bigint, Address, Address, bigint, bigint, Hex]
    });
    return { msgHash: keccak256(relayCalldata), relayCalldata };
  };

  it('re-sends the exact relayMessage the portal deposited, priced by its message and gas limit', () => {
    const { args, baseGasArgs } = opStackReplay(network, routeData);
    const call = opStackReplayCall({ args, gas: 712_090n });
    expect(call).toMatchObject({ to: L2_CROSS_DOMAIN_MESSENGER, gas: 712_090n });
    expect(encodeFunctionData(call as unknown as Parameters<typeof encodeFunctionData>[0])).toBe(
      message.relayCalldata
    );
    expect(baseGasArgs).toEqual([args[5], Number(args[4])]);
  });

  it('accepts an upper-case msgHash', () => {
    expect(() =>
      opStackReplay(network, { ...routeData, msgHash: message.msgHash.toUpperCase().replace('0X', '0x') })
    ).not.toThrow();
  });

  it.each([
    ['no routeData', undefined],
    ['no msgHash', { relayCalldata: message.relayCalldata }],
    ['a msgHash of other calldata', { ...routeData, msgHash: keccak256('0x01') }],
    [
      'calldata that is not a relay',
      (() => {
        const data = encodeFunctionData({
          abi: l2CrossDomainMessengerAbi,
          functionName: 'successfulMessages',
          args: [message.msgHash]
        });
        return { msgHash: keccak256(data), relayCalldata: data };
      })()
    ],
    ['a relay from another sender', relay(([nonce, , ...rest]) => [nonce, zeroAddress, ...rest])],
    [
      'a relay to another target',
      relay(([nonce, sender, , ...rest]) => [nonce, sender, zeroAddress, ...rest])
    ],
    [
      'a relay carrying ETH',
      relay(([nonce, sender, target, , ...rest]) => [nonce, sender, target, 1n, ...rest])
    ],
    [
      'a gas limit beyond uint32',
      relay(([nonce, sender, target, value, , data]) => [nonce, sender, target, value, 2n ** 32n, data])
    ]
  ])('refuses %s', (_, data) => {
    expect(() => opStackReplay(network, data)).toThrow();
  });

  it('refuses the message on the other OP Stack networks', () => {
    for (const other of (['base', 'optimism', 'unichain'] as const).filter(n => n !== network))
      expect(() => opStackReplay(other, routeData)).toThrow();
  });
});

describe('opStackReplayGas', () => {
  it("adds a 20% margin to the messenger's baseGas", () => {
    expect(opStackReplayGas(593_409n)).toBe(712_090n);
  });
});

describe('opStackDepositCalls', () => {
  const recipient = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');
  const amount = 25n * 10n ** 18n;
  const callData = (call: unknown) => encodeFunctionData(call as Parameters<typeof encodeFunctionData>[0]);

  it.each(['base', 'optimism', 'unichain'] as const)(
    'to %s approves exactly the amount to its L1 bridge, then deposits with no ETH',
    network => {
      const [approve, deposit, ...rest] = opStackDepositCalls({
        network,
        allowance: amount - 1n,
        amount,
        recipient
      });
      expect(rest).toEqual([]);
      expect(approve.to).toBe(L1_USDS);
      expect(approve.value).toBeUndefined();
      expect(decodeFunctionData({ abi: erc20Abi, data: callData(approve) })).toEqual({
        functionName: 'approve',
        args: [OP_STACK_DEPOSIT[network].l1TokenBridge, amount]
      });
      const { address, ...single } = opStackDepositCall({ network, recipient, amount });
      expect(deposit.to).toBe(address);
      expect(deposit.value).toBeUndefined();
      expect(callData(deposit)).toBe(callData({ to: address, ...single }));
    }
  );

  it('skips the approve when the allowance covers the amount', () => {
    for (const allowance of [amount, amount + 1n]) {
      const calls = opStackDepositCalls({ network: 'base', allowance, amount, recipient });
      expect(calls.map(call => call.functionName)).toEqual(['bridgeERC20To']);
    }
  });

  it('builds nothing for the zero address', () => {
    expect(() =>
      opStackDepositCalls({ network: 'base', allowance: 0n, amount, recipient: zeroAddress })
    ).toThrow();
  });
});

describe('Arbitrum deposit (golden: mainnet gateway deposit 0x7bad421e…13d4)', () => {
  // The real deposit called outboundTransfer, which Sky's gateway runs as outboundTransferCustomRefund with refundTo = to.
  const real = decodeFunctionData({
    abi: skyL1TokenGatewayImplementationAbi,
    data: ARBITRUM_DEPOSIT_TX.input
  });
  const [l1Token, recipient, amount, maxGas, gasPriceBid, data] = real.args as readonly [
    Address,
    Address,
    bigint,
    bigint,
    bigint,
    Hex
  ];

  it('builds the same deposit fields, data encoding and value as the real deposit', () => {
    expect(real.functionName).toBe('outboundTransfer');
    expect(l1Token).toBe(SUSDS);
    const [maxSubmissionCost] = decodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], data);
    expect(maxSubmissionCost + maxGas * gasPriceBid).toBe(ARBITRUM_DEPOSIT_TX.value);
    const call = arbitrumDepositCall({
      l1Token,
      recipient,
      refundTo: recipient,
      amount,
      quote: { maxSubmissionCost, maxGas, gasPriceBid, value: ARBITRUM_DEPOSIT_TX.value }
    });
    expect(call.address).toBe(ARBITRUM_DEPOSIT.l1Gateway);
    expect(call.value).toBe(ARBITRUM_DEPOSIT_TX.value);
    const [token, refundTo, to, value, gas, bid, extraData] = call.args;
    expect(refundTo).toBe(to);
    expect(
      encodeFunctionData({
        abi: call.abi,
        functionName: 'outboundTransfer',
        args: [token, to, value, gas, bid, extraData]
      })
    ).toBe(ARBITRUM_DEPOSIT_TX.input);
  });

  it('computes the ticket id ArbOS created', () => {
    expect(arbitrumRetryableTicket(ARBITRUM_DEPOSIT_LOGS)).toMatchObject({
      ticketId: '0xfb3d315976766e2cb2c21fcdc3d20dac98a4e9791889f282839a42f3cfb7903b',
      to: ARBITRUM_DEPOSIT.l2Gateway
    });
  });

  it('the ticket calls the L2 gateway with the outbound calldata the deposit encodes', () => {
    const ticket = arbitrumRetryableTicket(ARBITRUM_DEPOSIT_LOGS);
    expect(ticket?.data).toBe(
      arbitrumOutboundCalldata({ l1Token, from: ARBITRUM_DEPOSIT_TX.from, to: recipient, amount })
    );
  });

  it('ignores messages from another inbox or bridge, and a receipt with two tickets', () => {
    const move = (address: string, to: string) =>
      ARBITRUM_DEPOSIT_LOGS.map(log =>
        getAddress(log.address) === address ? ({ ...log, address: to } as Log) : log
      );
    expect(
      arbitrumRetryableTicket(move(ARBITRUM_DEPOSIT.inbox, '0x0000000000000000000000000000000000000bad'))
    ).toBeUndefined();
    expect(
      arbitrumRetryableTicket(move(ARBITRUM_DEPOSIT.bridge, '0x0000000000000000000000000000000000000bad'))
    ).toBeUndefined();
    expect(arbitrumRetryableTicket([...ARBITRUM_DEPOSIT_LOGS, ...ARBITRUM_DEPOSIT_LOGS])).toBeUndefined();
    expect(arbitrumRetryableTicket(BASE_DEPOSIT_LOGS)).toBeUndefined();
  });
});

describe('deposit builders', () => {
  it('build no deposit to, or refunding to, the zero address', () => {
    const quote = retryableQuote({ submissionFee: 1n, gasEstimate: 1n, l2GasPrice: 1n });
    const someone = ARBITRUM_DEPOSIT_TX.from;
    expect(() => opStackDepositCall({ network: 'base', recipient: zeroAddress, amount: 1n })).toThrow();
    expect(() =>
      arbitrumDepositCall({ recipient: zeroAddress, refundTo: someone, amount: 1n, quote })
    ).toThrow();
    expect(() =>
      arbitrumDepositCall({ recipient: someone, refundTo: zeroAddress, amount: 1n, quote })
    ).toThrow();
  });
});

describe('retryableQuote', () => {
  it('applies the 2.5x, 1.5x and 2x margins, rounding up, and sends the most the ticket can spend', () => {
    // The fork run: 324 bytes of calldata, 116,946 gas estimated, 0.01 gwei on Arbitrum.
    const quote = retryableQuote({
      submissionFee: 510_224_272_976n,
      gasEstimate: 116_946n,
      l2GasPrice: 10_000_000n
    });
    expect(quote).toEqual({
      maxSubmissionCost: 1_275_560_682_440n,
      maxGas: 175_419n,
      gasPriceBid: 20_000_000n,
      value: 1_275_560_682_440n + 175_419n * 20_000_000n
    });
    expect(retryableQuote({ submissionFee: 1n, gasEstimate: 1n, l2GasPrice: 1n })).toMatchObject({
      maxSubmissionCost: 3n,
      maxGas: 2n
    });
  });
});
