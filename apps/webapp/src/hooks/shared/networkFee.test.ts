import { describe, expect, it } from 'vitest';
import { decodeFunctionData, encodeFunctionData, erc20Abi, parseAbi, type Call } from 'viem';
import { arbitrum, base, mainnet, optimism, unichain } from 'wagmi/chains';
import { getWriteContractCall } from './getWriteContractCall';
import {
  BATCH_EXECUTOR_ADDRESS,
  EIP7702_AUTH_COST,
  computeBatchSaving,
  computeFeePerGas,
  PRIORITY_FEE_PERCENTILE,
  computeFeeWei,
  encodeBatchExecutorData,
  getBatchGasFloor,
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

describe('getBatchGasFloor', () => {
  it('floors at the largest call minus its own intrinsic', () => {
    expect(getBatchGasFloor([51_062n, 130_771n])).toBe(109_771n);
  });

  it('rejects the no-op batch a non-conforming delegate reports', () => {
    // Ambire's 7702 delegate returned success and 31,180 gas for an approve+deposit that
    // really costs ~148,000 — 5x too cheap, and it must not reach the UI.
    const floor = getBatchGasFloor([51_062n, 130_771n]);
    expect(31_180n >= floor).toBe(false);
    expect(148_003n >= floor).toBe(true);
  });

  it('never goes negative on calls cheaper than the intrinsic', () => {
    expect(getBatchGasFloor([1_000n])).toBe(0n);
    expect(getBatchGasFloor([])).toBe(0n);
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

describe('computeFeePerGas', () => {
  const gwei = (value: number) => BigInt(Math.round(value * 1e9));

  it('prices at the NEXT block base fee, not the last mined one', () => {
    // eth_feeHistory returns blockCount + 1 base fees; the trailing entry is the one a
    // transaction sent now will actually pay.
    const feePerGas = computeFeePerGas({
      baseFeePerGas: [gwei(5), gwei(6), gwei(7)],
      reward: [[0n], [0n]]
    });

    expect(feePerGas).toBe(gwei(7));
  });

  it('prices at the market rate the wallets bracket', () => {
    // Fee history around tx 0xb2d7c987… — base ~0.1 gwei, median tip ~0.1 gwei. On those
    // blocks base+p50 came to $0.056 against Ambire's $0.06–0.07 quote, while MetaMask's
    // Market tier bid 2 gwei and charged $0.59 for the same transaction.
    const feePerGas = computeFeePerGas({
      baseFeePerGas: [gwei(0.12), gwei(0.11), gwei(0.13), gwei(0.101)],
      reward: [[gwei(0.05)], [gwei(0.1)], [gwei(0.2)]]
    });

    expect(Number(feePerGas) / 1e9).toBeCloseTo(0.201, 3);
  });

  it('takes the median tip so one outlier block cannot swing the estimate', () => {
    const feePerGas = computeFeePerGas({
      baseFeePerGas: [gwei(1), gwei(1)],
      reward: [[gwei(1)], [gwei(2)], [gwei(500)]]
    });

    expect(feePerGas).toBe(gwei(1) + gwei(2));
  });

  it('falls back to the base fee when a chain reports no tips', () => {
    expect(computeFeePerGas({ baseFeePerGas: [gwei(3), gwei(4)] })).toBe(gwei(4));
    expect(computeFeePerGas({ baseFeePerGas: [gwei(3), gwei(4)], reward: [] })).toBe(gwei(4));
  });

  it('is zero rather than NaN on an empty history', () => {
    expect(computeFeePerGas({ baseFeePerGas: [] })).toBe(0n);
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
  it("bills at the median tip — the going rate, not one wallet's tier", () => {
    // p95 tracks MetaMask's Market floor (2 gwei) and overstates ~8x for wallets that
    // bid at market; p50 is the gas-weighted median actually paid.
    expect(PRIORITY_FEE_PERCENTILE).toBe(50);
  });

  it('pins the canonical Multicall3 address used as the stand-in executor', () => {
    expect(BATCH_EXECUTOR_ADDRESS).toBe('0xcA11bde05977b3631167028862bE2a173976CA11');
  });

  it('pins the EIP-7702 per-auth base cost', () => {
    expect(EIP7702_AUTH_COST).toBe(12_500n);
  });
});
