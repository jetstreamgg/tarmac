import { describe, expect, it } from 'vitest';
import { decodeFunctionData, encodeFunctionData, erc20Abi, parseAbi, type Call } from 'viem';
import { arbitrum, base, mainnet, optimism, unichain } from 'wagmi/chains';
import { getWriteContractCall } from './getWriteContractCall';
import {
  BATCH_EXECUTOR_ADDRESS,
  EIP7702_AUTH_COST,
  computeBatchSaving,
  computeFeeWei,
  encodeBatchExecutorData,
  encodeErc7821ExecuteData,
  feeWeiToUsd,
  getCallData,
  getCallsKey,
  isDelegated,
  isOpStackChain,
  totalCallValue
} from './networkFee';

const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const SUSDS = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD';

const calls: Call[] = [
  { to: USDS, data: '0xdeadbeef' },
  { to: SUSDS, data: '0xcafebabe' }
];

/** How the engine hooks actually build calls — abi/functionName, not pre-encoded data. */
const contractFormCall = getWriteContractCall({
  to: USDS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [SUSDS, 100n]
});

const expectedApproveData = encodeFunctionData({
  abi: erc20Abi,
  functionName: 'approve',
  args: [SUSDS, 100n]
});

describe('getCallData', () => {
  it('passes through pre-encoded calldata', () => {
    expect(getCallData(calls[0])).toBe('0xdeadbeef');
  });

  it('encodes the contract form the engines produce', () => {
    // Without this the batch encoders would nest empty calls and price a no-op bundle.
    expect(getCallData(contractFormCall)).toBe(expectedApproveData);
  });

  it('falls back to empty calldata for a bare value transfer', () => {
    expect(getCallData({ to: USDS, value: 1n })).toBe('0x');
  });
});

describe('isDelegated', () => {
  it('recognises the EIP-7702 delegation indicator', () => {
    expect(isDelegated(`0xef0100${SUSDS.slice(2)}`)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDelegated(`0xEF0100${SUSDS.slice(2)}`)).toBe(true);
  });

  it('rejects an undelegated account and ordinary contract code', () => {
    expect(isDelegated(undefined)).toBe(false);
    expect(isDelegated('0x')).toBe(false);
    expect(isDelegated('0x60806040')).toBe(false);
  });
});

describe('isOpStackChain', () => {
  it('covers the chains that bill a separate L1 data fee', () => {
    expect(isOpStackChain(base.id)).toBe(true);
    expect(isOpStackChain(optimism.id)).toBe(true);
    expect(isOpStackChain(unichain.id)).toBe(true);
  });

  it('excludes Arbitrum, which already bakes L1 cost into its gas units', () => {
    expect(isOpStackChain(arbitrum.id)).toBe(false);
  });

  it('excludes mainnet', () => {
    expect(isOpStackChain(mainnet.id)).toBe(false);
  });
});

describe('encodeBatchExecutorData', () => {
  it('encodes value-free calls as aggregate3', () => {
    const { functionName, args } = decodeFunctionData({
      abi: parseAbi([
        'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
      ]),
      data: encodeBatchExecutorData(calls)
    });

    expect(functionName).toBe('aggregate3');
    expect(args[0]).toEqual([
      { target: USDS, allowFailure: false, callData: '0xdeadbeef' },
      { target: SUSDS, allowFailure: false, callData: '0xcafebabe' }
    ]);
  });

  it('switches to aggregate3Value when a call carries ETH so the value is forwarded', () => {
    const { functionName, args } = decodeFunctionData({
      abi: parseAbi([
        'function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
      ]),
      data: encodeBatchExecutorData([{ to: USDS, data: '0xdeadbeef', value: 5n }, calls[1]])
    });

    expect(functionName).toBe('aggregate3Value');
    expect(args[0]).toEqual([
      { target: USDS, allowFailure: false, value: 5n, callData: '0xdeadbeef' },
      { target: SUSDS, allowFailure: false, value: 0n, callData: '0xcafebabe' }
    ]);
  });

  it('encodes contract-form calls rather than nesting empty calldata', () => {
    const { args } = decodeFunctionData({
      abi: parseAbi([
        'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
      ]),
      data: encodeBatchExecutorData([contractFormCall, calls[1]])
    });

    expect(args[0][0]).toEqual({ target: USDS, allowFailure: false, callData: expectedApproveData });
  });

  it('never lets a call fail silently — a reverting bundle must surface, not be priced', () => {
    const { args } = decodeFunctionData({
      abi: parseAbi([
        'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'
      ]),
      data: encodeBatchExecutorData(calls)
    });

    expect(args[0].every(call => call.allowFailure === false)).toBe(true);
  });
});

describe('encodeErc7821ExecuteData', () => {
  it('encodes the single-batch mode with no opData', () => {
    const { functionName, args } = decodeFunctionData({
      abi: parseAbi(['function execute(bytes32 mode, bytes executionData)']),
      data: encodeErc7821ExecuteData(calls)
    });

    expect(functionName).toBe('execute');
    expect(args[0]).toBe('0x0100000000000000000000000000000000000000000000000000000000000000');
    expect(args[1]).toMatch(/^0x[0-9a-f]+$/);
  });
});

describe('totalCallValue', () => {
  it('sums the ETH a bundle must carry', () => {
    expect(totalCallValue([{ to: USDS, value: 3n }, { to: SUSDS, value: 4n }, calls[0]])).toBe(7n);
  });

  it('is zero for value-free calls', () => {
    expect(totalCallValue(calls)).toBe(0n);
  });
});

describe('getCallsKey', () => {
  it('distinguishes flows that differ only in calldata', () => {
    expect(getCallsKey(calls)).not.toBe(getCallsKey([calls[0], { to: SUSDS, data: '0xfeedface' }]));
  });

  it('distinguishes flows that differ only in value', () => {
    expect(getCallsKey([{ to: USDS, data: '0x' }])).not.toBe(
      getCallsKey([{ to: USDS, data: '0x', value: 1n }])
    );
  });

  it('is stable for identical flows', () => {
    expect(getCallsKey(calls)).toBe(getCallsKey([...calls]));
  });
});

describe('computeFeeWei', () => {
  it('multiplies gas by price', () => {
    expect(computeFeeWei({ gas: 100_000n, feePerGas: 8_000_000_000n })).toBe(800_000_000_000_000n);
  });

  it('adds the L1 data fee on OP-stack chains', () => {
    expect(computeFeeWei({ gas: 100_000n, feePerGas: 1_000n, l1Fee: 555n })).toBe(100_000_555n);
  });
});

describe('feeWeiToUsd', () => {
  it('converts wei at the given ETH price', () => {
    // 0.001 ETH at $3,500
    expect(feeWeiToUsd(10n ** 15n, 3500)).toBeCloseTo(3.5, 10);
  });

  it('returns undefined without a price rather than implying a free transaction', () => {
    expect(feeWeiToUsd(10n ** 15n, undefined)).toBeUndefined();
    expect(feeWeiToUsd(10n ** 15n, Number.NaN)).toBeUndefined();
  });
});

describe('computeBatchSaving', () => {
  it('reports the measured approve+deposit saving', () => {
    // Measured on mainnet: 199,222 sequential vs 162,592 bundled.
    expect(computeBatchSaving(199_222n, 162_592n)).toBeCloseTo(0.1839, 4);
  });

  it('is undefined when there is no batch to compare against', () => {
    expect(computeBatchSaving(199_222n, undefined)).toBeUndefined();
  });

  it('is undefined when bundling would not actually save — never advertise a negative saving', () => {
    expect(computeBatchSaving(100_000n, 100_000n)).toBeUndefined();
    expect(computeBatchSaving(100_000n, 120_000n)).toBeUndefined();
  });
});

describe('module constants', () => {
  it('pins the canonical Multicall3 address used as the stand-in executor', () => {
    expect(BATCH_EXECUTOR_ADDRESS).toBe('0xcA11bde05977b3631167028862bE2a173976CA11');
  });

  it('pins the EIP-7702 per-auth base cost', () => {
    expect(EIP7702_AUTH_COST).toBe(12_500n);
  });
});
