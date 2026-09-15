import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeFunctionResult,
  erc20Abi,
  parseAbi,
  type Address,
  type Call,
  type Hex,
  type PublicClient
} from 'viem';
import { BatchSimulationError, simulateBatch } from './simulateBatch';
import { BATCH_EXECUTOR_ADDRESS, multicall3Abi } from './networkFee';
import { resetBatchExecutorCodeCache } from './batchExecutorCode';

const ACCOUNT: Address = '0x0650CAF159C5A49f711e8169D4336ECB9b950275';
/** Stands in for Multicall3's runtime code, as read from its canonical address. */
const EXECUTOR_CODE: Hex = '0x60806040deadbeef';
const DAI: Address = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const DAI_USDS: Address = '0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A';

const daiUsdsAbi = parseAbi([
  'function daiToUsds(address usr, uint256 wad)',
  'error NotAllowed(address who, uint256 amount)'
]);

const approve: Call = {
  to: DAI,
  abi: erc20Abi,
  functionName: 'approve',
  args: [DAI_USDS, 10n]
} as unknown as Call;
const swap: Call = {
  to: DAI_USDS,
  abi: daiUsdsAbi,
  functionName: 'daiToUsds',
  args: [ACCOUNT, 10n]
} as unknown as Call;
const calls = [approve, swap];

type Entry = { success: boolean; returnData: Hex };
const bundle = (entries: Entry[]): Hex =>
  encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: entries });

const TRUE = encodeAbiParameters([{ type: 'bool' }], [true]);
const ALLOWANCE_REVERT = encodeErrorResult({
  abi: parseAbi(['error Error(string reason)']),
  errorName: 'Error',
  args: ['Dai/insufficient-allowance']
});

function makeClient(
  respond: () => Promise<{ data?: Hex }>,
  { executorCode = async () => EXECUTOR_CODE }: { executorCode?: () => Promise<Hex | undefined> } = {}
) {
  const call = vi.fn(respond);
  const getCode = vi.fn(executorCode);
  return { client: { call, getCode } as unknown as PublicClient, call, getCode };
}

const run = (client: PublicClient, callList: readonly Call[] = calls, fallbackClients?: PublicClient[]) =>
  simulateBatch({ client, account: ACCOUNT, calls: callList, fallbackClients });

beforeEach(resetBatchExecutorCodeCache);

const failure = async (promise: Promise<unknown>): Promise<BatchSimulationError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BatchSimulationError);
    return error as BatchSimulationError;
  }
  throw new Error('expected the simulation to fail');
};

describe('simulateBatch — the request', () => {
  it('runs the bundle as one self-call with the embedded executor at the account', async () => {
    const { client, call } = makeClient(async () => ({
      data: bundle([
        { success: true, returnData: TRUE },
        { success: true, returnData: '0x' }
      ])
    }));

    // Resolves with a value: a query function that returns undefined is an error to
    // TanStack Query, which would turn every clean simulation into a failure.
    await expect(run(client)).resolves.toEqual([
      { success: true, returnData: TRUE },
      { success: true, returnData: '0x' }
    ]);

    expect(call).toHaveBeenCalledTimes(1);
    const [params] = call.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.account).toBe(ACCOUNT);
    expect(params.to).toBe(ACCOUNT);
    expect(params.value).toBe(0n);
    expect(params.stateOverride).toEqual([{ address: ACCOUNT, code: EXECUTOR_CODE }]);
    // Failures must be ALLOWED in the validator: Multicall3's own re-raise would discard
    // the sub-call's reason, and the (success, returnData) entries carry it instead.
    expect((params.data as string).startsWith('0x82ad56cb')).toBe(true); // aggregate3 selector
    expect(params.data).toContain('0'.repeat(63) + '1'); // allowFailure: true
  });

  it('reads the executor code from its canonical address once per session', async () => {
    const { client, getCode } = makeClient(async () => ({
      data: bundle([{ success: true, returnData: TRUE }])
    }));

    await run(client, [approve]);
    await run(client, [approve]);

    expect(getCode).toHaveBeenCalledTimes(1);
    expect(getCode).toHaveBeenCalledWith({ address: BATCH_EXECUTOR_ADDRESS });
  });
});

describe('simulateBatch — a failed sub-call', () => {
  it('decodes an Error(string) reason and names the call', async () => {
    const { client } = makeClient(async () => ({
      data: bundle([{ success: false, returnData: ALLOWANCE_REVERT }])
    }));

    const error = await failure(run(client, [swap]));

    expect(error.kind).toBe('reverted');
    expect(error.callIndex).toBe(0);
    expect(error.message).toContain('Dai/insufficient-allowance');
    expect(error.message).toContain('daiToUsds');
  });

  it("decodes a custom error with the call's own ABI", async () => {
    const { client } = makeClient(async () => ({
      data: bundle([
        { success: true, returnData: TRUE },
        {
          success: false,
          returnData: encodeErrorResult({ abi: daiUsdsAbi, errorName: 'NotAllowed', args: [ACCOUNT, 10n] })
        }
      ])
    }));

    const error = await failure(run(client));

    expect(error.callIndex).toBe(1);
    expect(error.message).toContain(`NotAllowed(${ACCOUNT}, 10)`);
  });

  it('reports a reasonless revert as such', async () => {
    const { client } = makeClient(async () => ({
      data: bundle([{ success: false, returnData: '0x' }])
    }));

    const error = await failure(run(client, [approve]));

    expect(error.kind).toBe('reverted');
    expect(error.message).toContain('reverted without a reason');
  });

  it('treats a success that returned nothing where the ABI declares outputs as a codeless target', async () => {
    // A raw CALL to an address with no code succeeds and returns nothing — the shape of
    // a wrong-chain address-map miss (APP-528). `approve` returns a bool, so `0x` here
    // means the target did not run ERC-20 code.
    const { client } = makeClient(async () => ({
      data: bundle([
        { success: true, returnData: '0x' },
        { success: true, returnData: '0x' }
      ])
    }));

    const error = await failure(run(client));

    expect(error.kind).toBe('reverted');
    expect(error.callIndex).toBe(0);
    expect(error.message).toContain('no code');
  });

  it('accepts an empty return from a function that declares no outputs', async () => {
    const { client } = makeClient(async () => ({
      data: bundle([{ success: true, returnData: '0x' }])
    }));

    await expect(run(client, [swap])).resolves.toEqual([{ success: true, returnData: '0x' }]);
  });
});

describe('simulateBatch — the RPC', () => {
  class RpcError extends BaseError {
    constructor(code: number, message: string) {
      super(message, { cause: Object.assign(new Error(message), { code }) });
    }
  }

  it.each([
    [-32602, 'invalid params'],
    [-32601, 'method not found'],
    [-32004, 'method not supported'],
    [-32001, 'method eth_call not supported']
  ])('classifies JSON-RPC %i as structural', async (code, message) => {
    const { client } = makeClient(async () => {
      throw new RpcError(code, message);
    });

    const error = await failure(run(client));

    expect(error.kind).toBe('structural');
  });

  it('classifies an override the RPC accepted but ignored as structural', async () => {
    // A self-call to an EOA whose code was NOT overridden returns nothing at all.
    const { client } = makeClient(async () => ({ data: undefined }));

    const error = await failure(run(client));

    expect(error.kind).toBe('structural');
  });

  it('reads the executor code from another configured chain when this one has none', async () => {
    // The bytes are chain-agnostic and only ever run inside the simulation, so a chain
    // without Multicall3 still gets a validated bundle rather than the sequential fallback.
    const { client, call } = makeClient(
      async () => ({ data: bundle([{ success: true, returnData: TRUE }]) }),
      {
        executorCode: async () => undefined
      }
    );
    const { client: mainnet, getCode: mainnetGetCode } = makeClient(async () => ({}));

    await expect(run(client, [approve], [mainnet])).resolves.toHaveLength(1);

    expect(mainnetGetCode).toHaveBeenCalledWith({ address: BATCH_EXECUTOR_ADDRESS });
    const [params] = call.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.stateOverride).toEqual([{ address: ACCOUNT, code: EXECUTOR_CODE }]);
  });

  it('classifies no executor deployed on any reachable chain as structural', async () => {
    const { client, call } = makeClient(async () => ({ data: bundle([]) }), {
      executorCode: async () => undefined
    });
    const { client: other } = makeClient(async () => ({}), { executorCode: async () => '0x' });

    const error = await failure(run(client, calls, [other]));

    expect(error.kind).toBe('structural');
    expect(call).not.toHaveBeenCalled();
  });

  it('treats a failed executor code read as transient and does not cache it', async () => {
    let attempts = 0;
    const { client, getCode } = makeClient(
      async () => ({ data: bundle([{ success: true, returnData: TRUE }]) }),
      {
        executorCode: async () => {
          if (attempts++ === 0) throw new Error('fetch failed');
          return EXECUTOR_CODE;
        }
      }
    );

    const error = await failure(run(client, [approve]));
    expect(error.kind).toBe('transient');

    await expect(run(client, [approve])).resolves.toHaveLength(1);
    expect(getCode).toHaveBeenCalledTimes(2);
  });

  it('classifies a network failure as transient', async () => {
    const { client } = makeClient(async () => {
      throw new BaseError('HTTP request failed.', { cause: new Error('fetch failed') });
    });

    const error = await failure(run(client));

    expect(error.kind).toBe('transient');
  });

  it('classifies a bundle-level revert as reverted', async () => {
    const { client } = makeClient(async () => {
      throw new RpcError(3, 'execution reverted: Multicall3: value mismatch');
    });

    const error = await failure(run(client));

    expect(error.kind).toBe('reverted');
    expect(error.message).toContain('value mismatch');
  });
});
