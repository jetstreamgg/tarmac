import { beforeEach, describe, expect, it, vi } from 'vitest';
import { base } from 'wagmi/chains';
import type { Address, Call, Hex, PublicClient } from 'viem';
import { estimateFlowGas } from './estimateFlowGas';
import { BATCH_EXECUTOR_ADDRESS, EIP7702_AUTH_COST } from './networkFee';
import { resetBatchExecutorCodeCache } from './batchExecutorCode';

const ACCOUNT: Address = '0x0650CAF159C5A49f711e8169D4336ECB9b950275';
const USDS: Address = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const SUSDS: Address = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD';
/** Stands in for Multicall3's runtime code at the canonical executor address. */
const EXECUTOR_CODE: Hex = '0x60806040deadbeef';

const calls: Call[] = [
  { to: USDS, data: '0xdeadbeef' },
  { to: SUSDS, data: '0xcafebabe' }
];

type SimulateParams = { calls: readonly Call[]; stateOverrides?: readonly unknown[] };
type SimulateResult = { results: { status: 'success' | 'failure'; gasUsed: bigint }[] };

let nextChainId = 1000;
const freshChainId = () => ++nextChainId;

function makeClient({
  simulate,
  accountCode,
  l1Fee = 0n
}: {
  simulate: (params: SimulateParams) => SimulateResult;
  accountCode?: Hex;
  l1Fee?: bigint;
}) {
  const simulateCalls = vi.fn(async (params: SimulateParams) => simulate(params));
  const getCode = vi.fn(async ({ address }: { address: Address }) =>
    address === BATCH_EXECUTOR_ADDRESS ? EXECUTOR_CODE : accountCode
  );
  const estimateL1Fee = vi.fn(async () => l1Fee);
  const client = {
    simulateCalls,
    getCode,
    extend: () => ({ estimateL1Fee })
  };

  return { client: client as unknown as PublicClient, simulateCalls, getCode, estimateL1Fee };
}

beforeEach(resetBatchExecutorCodeCache);

const success = (...gas: bigint[]): SimulateResult => ({
  results: gas.map(gasUsed => ({ status: 'success', gasUsed }))
});

describe('estimateFlowGas — sequential', () => {
  it('sums per-call gas, which is exactly what N separate transactions cost', async () => {
    const { client, getCode } = makeClient({ simulate: () => success(51_086n, 148_136n) });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: false
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.batchGas).toBeUndefined();
    // No batch requested — nothing should have gone looking for delegation.
    expect(getCode).not.toHaveBeenCalled();
  });

  it('throws when a call reverts, so the caller shows a dash rather than a wrong fee', async () => {
    const { client } = makeClient({
      simulate: () => ({
        results: [
          { status: 'success', gasUsed: 51_086n },
          { status: 'failure', gasUsed: 0n }
        ]
      })
    });

    await expect(
      estimateFlowGas({ client, chainId: freshChainId(), account: ACCOUNT, calls, wantsBatch: false })
    ).rejects.toThrow(/a call reverted/);
  });
});

describe('estimateFlowGas — batch', () => {
  it('prices an undelegated account with the stand-in executor plus the authorization tuple', async () => {
    const { client, simulateCalls } = makeClient({
      accountCode: undefined,
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.batchGas).toBe(162_592n + EIP7702_AUTH_COST);

    // The batch must be simulated as ONE self-call with the executor code overridden in.
    const batchCall = simulateCalls.mock.calls
      .map(([params]) => params)
      .find(params => params.stateOverrides);
    expect(batchCall?.calls).toHaveLength(1);
    expect(batchCall?.calls[0]?.to).toBe(ACCOUNT);
    expect(batchCall?.stateOverrides).toEqual([{ address: ACCOUNT, code: EXECUTOR_CODE }]);
  });

  it('charges no auth cost to an already-delegated account', async () => {
    const { client } = makeClient({
      accountCode: `0xef0100${SUSDS.slice(2)}`,
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    // Delegation already paid for — adding it again would overstate every bundle after the first.
    expect(result.batchGas).toBe(162_592n);
  });

  it("never asks the account's own delegate — one stand-in path for every wallet", async () => {
    const { client, simulateCalls } = makeClient({
      accountCode: `0xef0100${SUSDS.slice(2)}`,
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });

    await estimateFlowGas({ client, chainId: freshChainId(), account: ACCOUNT, calls, wantsBatch: true });

    // Every bundled simulation must carry the executor override. A bare self-call would
    // be asking the wallet's delegate to price itself — which Ambire's answers wrongly.
    const bundleSims = simulateCalls.mock.calls
      .map(([params]) => params)
      .filter(params => params.calls.length === 1);
    expect(bundleSims.length).toBeGreaterThan(0);
    expect(bundleSims.every(params => !!params.stateOverrides)).toBe(true);
  });

  it('discards a batch cheaper than its own most expensive call', async () => {
    // Ambire's delegate reported success and 31,180 gas for work costing ~148,000. Even
    // if such a figure reaches us, it must never be shown as a price.
    const { client } = makeClient({
      accountCode: `0xef0100${SUSDS.slice(2)}`,
      simulate: params => (params.stateOverrides ? success(31_180n) : success(51_062n, 130_771n))
    });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    expect(result.batchGas).toBeUndefined();
    expect(result.sequentialGas).toBe(181_833n);
  });

  it('reads the executor code from its canonical address once per session', async () => {
    const { client, getCode } = makeClient({
      accountCode: undefined,
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });
    const chainId = freshChainId();

    await estimateFlowGas({ client, chainId, account: ACCOUNT, calls, wantsBatch: true });
    await estimateFlowGas({ client, chainId, account: ACCOUNT, calls, wantsBatch: true });

    // The account's own code is re-read each time (the delegation check); the executor's once.
    const executorReads = getCode.mock.calls.filter(([{ address }]) => address === BATCH_EXECUTOR_ADDRESS);
    expect(executorReads).toHaveLength(1);
    expect(getCode).toHaveBeenCalledWith({ address: ACCOUNT });
  });

  it('prices the bundle on a chain with no executor deployed by reading the code elsewhere', async () => {
    const { client } = makeClient({
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });
    const noExecutor = { ...client, getCode: async () => undefined } as unknown as PublicClient;
    const { client: mainnet } = makeClient({ simulate: () => success() });

    const result = await estimateFlowGas({
      client: noExecutor,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true,
      fallbackClients: [mainnet]
    });

    expect(result.batchGas).toBe(162_592n + EIP7702_AUTH_COST);
  });

  it('keeps the sequential figure when no reachable chain has the executor deployed', async () => {
    const { client } = makeClient({
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });
    const noExecutor = { ...client, getCode: async () => undefined } as unknown as PublicClient;

    const result = await estimateFlowGas({
      client: noExecutor,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.batchGas).toBeUndefined();
  });

  it('keeps the sequential figure when only the bundled simulation fails', async () => {
    // The bundled figure is the optional one. It used to reject the whole estimate,
    // which blanked the sequential fee the row falls back to.
    const { client } = makeClient({
      accountCode: undefined,
      simulate: params =>
        params.stateOverrides ? { results: [{ status: 'failure', gasUsed: 0n }] } : success(51_086n, 148_136n)
    });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.batchGas).toBeUndefined();
  });

  it('keeps the sequential figure when the delegation read fails', async () => {
    const { client } = makeClient({
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });
    const failing = {
      ...client,
      getCode: async () => {
        throw new Error('rpc unavailable');
      }
    } as unknown as PublicClient;

    const result = await estimateFlowGas({
      client: failing,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.batchGas).toBeUndefined();
  });
});

describe('estimateFlowGas — L1 data fee', () => {
  it('bills one L1 fee per call sequentially and a single one for the bundle', async () => {
    const { client, estimateL1Fee } = makeClient({
      accountCode: undefined,
      l1Fee: 1_000n,
      simulate: params => (params.stateOverrides ? success(162_592n) : success(51_086n, 148_136n))
    });

    const result = await estimateFlowGas({
      client,
      chainId: base.id,
      account: ACCOUNT,
      calls,
      wantsBatch: true
    });

    // Two calls signed separately post two blobs of calldata to L1; the bundle posts one.
    expect(result.sequentialL1Fee).toBe(2_000n);
    expect(result.batchL1Fee).toBe(1_000n);
    expect(estimateL1Fee).toHaveBeenCalledTimes(3);
  });

  it('is zero off OP-stack chains, where no separate data fee exists', async () => {
    const { client, estimateL1Fee } = makeClient({
      l1Fee: 1_000n,
      simulate: () => success(51_086n, 148_136n)
    });

    const result = await estimateFlowGas({
      client,
      chainId: freshChainId(),
      account: ACCOUNT,
      calls,
      wantsBatch: false
    });

    expect(result.sequentialL1Fee).toBe(0n);
    expect(result.batchL1Fee).toBe(0n);
    expect(estimateL1Fee).not.toHaveBeenCalled();
  });

  it('never fails the estimate over a data-fee error', async () => {
    const { client } = makeClient({
      simulate: () => success(51_086n, 148_136n)
    });
    const failing = {
      ...client,
      extend: () => ({
        estimateL1Fee: async () => {
          throw new Error('oracle unavailable');
        }
      })
    } as unknown as PublicClient;

    const result = await estimateFlowGas({
      client: failing,
      chainId: base.id,
      account: ACCOUNT,
      calls,
      wantsBatch: false
    });

    expect(result.sequentialGas).toBe(199_222n);
    expect(result.sequentialL1Fee).toBe(0n);
  });
});
