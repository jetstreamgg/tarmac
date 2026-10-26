/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { encodeFunctionData, getAddress, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctpFixtures';
import { TOKEN_MESSENGER_V2, cctpL2Contracts } from '../adapters/cctp/contracts';
import { useCctpBurnLegs } from './useCctpBurnLegs';

const mocks = vi.hoisted(() => ({
  allowances: [] as Record<string, unknown>[],
  usds: 0n as bigint | undefined,
  usdc: 0n as bigint | undefined,
  allowanceError: null as Error | null,
  clients: {} as Record<number, unknown>,
  legs: undefined as undefined | Record<string, unknown>,
  execute: vi.fn(),
  refusal: vi.fn(),
  resumeRefusal: vi.fn(),
  record: vi.fn(),
  clear: vi.fn(),
  markBurn: vi.fn(),
  storageWritable: true
}));

vi.mock('wagmi', () => ({
  usePublicClient: ({ chainId }: { chainId?: number }) => (chainId ? mocks.clients[chainId] : undefined)
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => {
    mocks.allowances.push(params);
    const isUsds = params.spender === cctpL2Contracts('base').psm3;
    return {
      data: params.contractAddress ? (isUsds ? mocks.usds : mocks.usdc) : undefined,
      error: mocks.allowanceError,
      mutate: vi.fn()
    };
  }
}));
vi.mock('../adapters/cctp/gate', () => ({
  cctpBurnRefusal: mocks.refusal,
  cctpResumeRefusal: mocks.resumeRefusal,
  CCTP_SWAP_FAILED_MESSAGE: 'The swap of this bridge failed, so there is nothing to bridge.'
}));
vi.mock('../store/cctpSwapStore', () => ({
  cctpSwapStore: { record: mocks.record, clear: mocks.clear, markBurn: mocks.markBurn }
}));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => mocks.storageWritable }));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return {
      isBatch: false,
      ready: true,
      error: null,
      execute: mocks.execute,
      reset: vi.fn(),
      stop: vi.fn()
    };
  }
}));

const BASE = 8453;
const ETHEREUM = 1;
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n;
const getCallbacks = () => ({}) as TxCallbacks;
const SCOPE = 'scope';
const OTHER = '0x1111111111111111111111111111111111111111';
const SWAP_HASH = '0x' + 'ab'.repeat(32);
const BURN_HASH = '0x' + 'cd'.repeat(32);
const REPRICED_HASH = '0x' + 'ef'.repeat(32);
const RESUME = {
  swapTxHash: SWAP_HASH,
  network: 'base' as const,
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: BASE_BURN_MINT_RECIPIENT.toLowerCase(),
  at: 0
};

const render = (overrides: Partial<Parameters<typeof useCctpBurnLegs>[0]> = {}) =>
  renderHook(() =>
    useCctpBurnLegs({
      enabled: true,
      from: 'base',
      chainId: BASE,
      ethereumChainId: ETHEREUM,
      account: BASE_BURN_TX.from,
      recipient: BASE_BURN_MINT_RECIPIENT,
      amount: AMOUNT,
      getCallbacks,
      ...overrides
    })
  ).result.current;

const calls = () => mocks.legs!.calls as Call[];

describe('useCctpBurnLegs (golden: Base burn 0x5bb3d46a…6b6a)', () => {
  beforeEach(() => {
    mocks.allowances = [];
    mocks.usds = 0n;
    mocks.usdc = 0n;
    mocks.allowanceError = null;
    mocks.clients = { [BASE]: { chain: 'base' }, [ETHEREUM]: { chain: 'ethereum' } };
    mocks.legs = undefined;
    mocks.execute.mockReset();
    mocks.refusal.mockReset();
    mocks.resumeRefusal.mockReset();
    mocks.record.mockReset();
    mocks.clear.mockReset();
    mocks.markBurn.mockReset();
    mocks.storageWritable = true;
  });

  it('sends approve, swap, approve and the real burn calldata on the L2, keyed on depositForBurn', () => {
    const legs = render();
    expect(mocks.legs).toMatchObject({ chainId: BASE, sendFunctionName: 'depositForBurn' });
    expect(mocks.legs!.client).toBe(mocks.clients[BASE]);
    expect(calls().map(call => (call as { functionName?: string }).functionName)).toEqual([
      'approve',
      'swapExactIn',
      'approve',
      'depositForBurn'
    ]);
    expect(encodeFunctionData(calls()[3] as never)).toBe(BASE_BURN_TX.input);
    expect(legs.needsApprove).toBe(true);
  });

  it('reads both allowances on the L2 from the sender', () => {
    render();
    const { psm3, usds, usdc } = cctpL2Contracts('base');
    const owner = getAddress(BASE_BURN_TX.from);
    expect(mocks.allowances.slice(0, 2)).toEqual([
      { chainId: BASE, contractAddress: usds, owner, spender: psm3 },
      { chainId: BASE, contractAddress: usdc, owner, spender: TOKEN_MESSENGER_V2 }
    ]);
  });

  it('skips the approves the allowances cover', () => {
    mocks.usds = AMOUNT;
    mocks.usdc = BASE_BURN_AMOUNT;
    expect(render().needsApprove).toBe(false);
    expect(calls()).toHaveLength(2);
  });

  it('builds nothing while an allowance loads', () => {
    mocks.usdc = undefined;
    render();
    expect(calls()).toEqual([]);
  });

  it('builds nothing, and reports why, for a recipient CCTP must never mint to', () => {
    const legs = render({ recipient: '0x000000000000000000000000000000000000dEaD' });
    expect(calls()).toEqual([]);
    expect(legs.error).toBeInstanceOf(Error);
  });

  it('swaps the whole amount, whatever USDC the wallet already holds', () => {
    mocks.usds = AMOUNT;
    mocks.usdc = BASE_BURN_AMOUNT;
    render();
    expect(calls().map(call => (call as { functionName?: string }).functionName)).toEqual([
      'swapExactIn',
      'depositForBurn'
    ]);
  });

  it('continues a stopped bridge: burns only its swap USDC, to its recipient, with no USDS read or swap', () => {
    const legs = render({ resume: RESUME, recipient: OTHER, amount: 1n });
    expect(calls().map(call => (call as { functionName?: string }).functionName)).toEqual([
      'approve',
      'depositForBurn'
    ]);
    expect(encodeFunctionData(calls()[1] as never)).toBe(BASE_BURN_TX.input);
    expect(
      mocks.allowances.find(read => read.spender === cctpL2Contracts('base').psm3)?.contractAddress
    ).toBe(undefined);
    expect(legs.error).toBeNull();
  });

  it('refuses to continue a bridge started on another network', () => {
    const legs = render({ resume: { ...RESUME, network: 'optimism' } });
    expect(calls()).toEqual([]);
    expect(legs.error?.message).toMatch(/another network/);
  });

  it('bridges to another recipient while localStorage takes writes', () => {
    const legs = render({ recipient: OTHER });
    expect(calls()).toHaveLength(4);
    expect(legs.error).toBeNull();
  });

  it('builds nothing, and reports why, for another recipient while localStorage takes no writes', () => {
    mocks.storageWritable = false;
    const legs = render({ recipient: OTHER });
    expect(calls()).toEqual([]);
    expect(legs.error?.message).toMatch(/browser storage/);
    expect(render().error).toBeNull();
  });

  it('keeps a sent swap for the recipient of the run, and links it to its burn once sent', () => {
    const legs = render({ scope: SCOPE, recipient: OTHER });
    act(() => legs.execute());
    expect(mocks.execute).toHaveBeenCalledOnce();
    const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: object) => void;
    onLegSent(SWAP_HASH, { functionName: 'approve', args: [] });
    expect(mocks.record).not.toHaveBeenCalled();
    onLegSent(SWAP_HASH, calls()[1]);
    expect(mocks.record).toHaveBeenCalledWith(SCOPE, {
      swapTxHash: SWAP_HASH,
      network: 'base',
      usdcAmount: BASE_BURN_AMOUNT,
      recipient: getAddress(OTHER),
      at: expect.any(Number)
    });
    expect(mocks.clear).not.toHaveBeenCalled();
    onLegSent(BURN_HASH, calls()[3]);
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, SWAP_HASH, BURN_HASH);
  });

  it('keeps a repriced swap under the hash that mines, and drops the one it replaced', () => {
    render({ scope: SCOPE });
    const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: object) => void;
    const swap = calls()[1];
    onLegSent(SWAP_HASH, swap);
    onLegSent(REPRICED_HASH, swap);
    expect(mocks.clear).toHaveBeenCalledWith(SCOPE, SWAP_HASH);
    expect(mocks.record).toHaveBeenLastCalledWith(
      SCOPE,
      expect.objectContaining({ swapTxHash: REPRICED_HASH })
    );
    onLegSent(BURN_HASH, calls()[3]);
    expect(mocks.markBurn).toHaveBeenLastCalledWith(SCOPE, REPRICED_HASH, BURN_HASH);
  });

  it('drops nothing when the same swap is reported twice', () => {
    render({ scope: SCOPE });
    const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: object) => void;
    const swap = calls()[1];
    onLegSent(SWAP_HASH, swap);
    onLegSent(SWAP_HASH, swap);
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("keeps an earlier run's swap when another run sends its own", () => {
    render({ scope: SCOPE });
    const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: object) => void;
    onLegSent(SWAP_HASH, { ...calls()[1] });
    onLegSent(REPRICED_HASH, { ...calls()[1] });
    expect(mocks.record).toHaveBeenCalledTimes(2);
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('links the continued swap to its burn once sent', () => {
    render({ scope: SCOPE, resume: RESUME });
    (mocks.legs!.onLegSent as (hash: string, variables: object) => void)(BURN_HASH, calls()[1]);
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, SWAP_HASH, BURN_HASH);
  });

  it('links the continued swap to its bundle once the wallet accepts it, and tells the caller', () => {
    const onCallsSent = vi.fn();
    render({ scope: SCOPE, resume: RESUME, batch: true, onCallsSent });
    (mocks.legs!.onCallsSent as (id: string) => void)('bundle');
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, SWAP_HASH, 'bundle');
    expect(onCallsSent).toHaveBeenCalledWith('bundle');
  });

  // One resume launch hosts every Continue card: the bridge on show can change while a send is out.
  const renderResumable = (overrides: Partial<Parameters<typeof useCctpBurnLegs>[0]>) =>
    renderHook(
      ({ resume }: { resume: typeof RESUME }) =>
        useCctpBurnLegs({
          enabled: true,
          from: 'base',
          chainId: BASE,
          ethereumChainId: ETHEREUM,
          account: BASE_BURN_TX.from,
          recipient: BASE_BURN_MINT_RECIPIENT,
          amount: AMOUNT,
          getCallbacks,
          scope: SCOPE,
          ...overrides,
          resume
        }),
      { initialProps: { resume: RESUME } }
    );
  const OTHER_RESUME = { ...RESUME, swapTxHash: '0x' + '12'.repeat(32) };

  it('links the continued swap it sent when its bundle is accepted after another bridge is on show', () => {
    const { result, rerender } = renderResumable({ batch: true });
    act(() => result.current.execute());
    rerender({ resume: OTHER_RESUME });
    (mocks.legs!.onCallsSent as (id: string) => void)('bundle');
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, SWAP_HASH, 'bundle');
    expect(mocks.markBurn).not.toHaveBeenCalledWith(SCOPE, OTHER_RESUME.swapTxHash, expect.anything());
  });

  it('links the continued swap it sent when its burn leg is sent after another bridge is on show', () => {
    const { result, rerender } = renderResumable({});
    act(() => result.current.execute());
    const burn = calls()[1];
    rerender({ resume: OTHER_RESUME });
    (mocks.legs!.onLegSent as (hash: string, variables: object) => void)(BURN_HASH, burn);
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, SWAP_HASH, BURN_HASH);
    expect(mocks.markBurn).not.toHaveBeenCalledWith(SCOPE, OTHER_RESUME.swapTxHash, expect.anything());
  });

  it('drops no swap for a bundle that is not a continued bridge', () => {
    render({ scope: SCOPE, batch: true });
    (mocks.legs!.onCallsSent as (id: string) => void)('bundle');
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.markBurn).not.toHaveBeenCalled();
  });

  it('keeps no swap without a scope, or from a Safe by any connector, whose hash the chain cannot confirm', () => {
    render();
    (mocks.legs!.onLegSent as (hash: string, variables: object) => void)(SWAP_HASH, calls()[1]);
    render({ scope: SCOPE, isSafeApp: true });
    (mocks.legs!.onLegSent as (hash: string, variables: object) => void)(SWAP_HASH, calls()[1]);
    render({ scope: SCOPE, isSafeWallet: true });
    (mocks.legs!.onLegSent as (hash: string, variables: object) => void)(SWAP_HASH, calls()[1]);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  const renderSafeFlip = (isSafeWallet: boolean) =>
    renderHook(
      ({ safe }: { safe: boolean }) =>
        useCctpBurnLegs({
          enabled: true,
          from: 'base',
          chainId: BASE,
          ethereumChainId: ETHEREUM,
          account: BASE_BURN_TX.from,
          recipient: BASE_BURN_MINT_RECIPIENT,
          amount: AMOUNT,
          getCallbacks,
          scope: SCOPE,
          isSafeWallet: safe
        }),
      { initialProps: { safe: isSafeWallet } }
    );

  it('keeps no swap from a run a Safe confirmed, though its status reads unsettled when the leg is sent', () => {
    const { result, rerender } = renderSafeFlip(true);
    act(() => result.current.execute());
    const run = mocks.execute.mock.calls[0][0];
    // Checking or unknown read as not a Safe.
    rerender({ safe: false });
    (mocks.legs!.onLegSent as (hash: string, variables: object, context: unknown) => void)(
      SWAP_HASH,
      calls()[1],
      run
    );
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('keeps the swap of a run an account confirmed as not a Safe, though its status changes before the leg is sent', () => {
    const { result, rerender } = renderSafeFlip(false);
    act(() => result.current.execute());
    const run = mocks.execute.mock.calls[0][0];
    rerender({ safe: true });
    (mocks.legs!.onLegSent as (hash: string, variables: object, context: unknown) => void)(
      SWAP_HASH,
      calls()[1],
      run
    );
    expect(mocks.record).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ swapTxHash: SWAP_HASH }));
  });

  it('checks the chain before continuing, then reads the gate with no swap', async () => {
    render({ resume: RESUME });
    const preflight = mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>;
    const refused = new Error('This bridge was already sent.');
    mocks.resumeRefusal.mockResolvedValueOnce(refused);
    await expect(preflight(mocks.clients[BASE])).resolves.toBe(refused);
    expect(mocks.resumeRefusal).toHaveBeenCalledWith({
      network: 'base',
      swapTxHash: SWAP_HASH,
      account: getAddress(BASE_BURN_TX.from),
      usdcAmount: RESUME.usdcAmount,
      recipient: RESUME.recipient,
      client: mocks.clients[BASE]
    });
    expect(mocks.refusal).not.toHaveBeenCalled();
    mocks.resumeRefusal.mockResolvedValueOnce(undefined);
    mocks.refusal.mockResolvedValue(undefined);
    await expect(preflight(mocks.clients[BASE])).resolves.toBeUndefined();
    expect(mocks.refusal).toHaveBeenCalledWith({
      network: 'base',
      amount: AMOUNT,
      source: mocks.clients[BASE],
      destination: mocks.clients[ETHEREUM],
      swap: false
    });
  });

  // A Retry after the run's own swap mined sends no swap: the pocket that swap may have emptied doesn't matter.
  it('reads the gate with no swap once the run has no swap left to send', async () => {
    render();
    const preflight = mocks.legs!.preflight as (
      client: unknown,
      nextCalls?: Call[]
    ) => Promise<Error | undefined>;
    mocks.refusal.mockResolvedValue(undefined);
    const swapAt = calls().findIndex(
      call => (call as { functionName?: string }).functionName === 'swapExactIn'
    );
    await preflight(mocks.clients[BASE], calls().slice(swapAt + 1));
    expect(mocks.refusal).toHaveBeenLastCalledWith(expect.objectContaining({ swap: false }));
    await preflight(mocks.clients[BASE], calls().slice(swapAt));
    expect(mocks.refusal).toHaveBeenLastCalledWith(expect.objectContaining({ swap: true }));
  });

  it('reads nothing while disabled', () => {
    expect(render({ enabled: false }).error).toBeNull();
    expect(mocks.allowances.every(read => read.contractAddress === undefined)).toBe(true);
    expect(calls()).toEqual([]);
  });

  it('reports a failed allowance read', () => {
    mocks.allowanceError = new Error('rpc down');
    expect(render().error).toBe(mocks.allowanceError);
  });

  it('reads the gate on both chains before the prompt, and refuses without an Ethereum client', async () => {
    render();
    const preflight = mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>;
    mocks.refusal.mockResolvedValue(undefined);
    await expect(preflight(mocks.clients[BASE])).resolves.toBeUndefined();
    expect(mocks.refusal).toHaveBeenCalledWith({
      network: 'base',
      amount: AMOUNT,
      source: mocks.clients[BASE],
      destination: mocks.clients[ETHEREUM],
      swap: true
    });
    expect(mocks.resumeRefusal).not.toHaveBeenCalled();
    render({ ethereumChainId: undefined });
    const refused = mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>;
    await expect(refused(mocks.clients[BASE])).resolves.toBeInstanceOf(Error);
  });

  // The launch probes storage on each Review; the legs must follow it both ways, not their first render.
  it('follows the storage probe of each Review for another recipient, both ways', () => {
    const view = renderHook(
      ({ storageWritable }: { storageWritable: boolean }) =>
        useCctpBurnLegs({
          enabled: true,
          from: 'base',
          chainId: BASE,
          ethereumChainId: ETHEREUM,
          account: BASE_BURN_TX.from,
          recipient: OTHER,
          amount: AMOUNT,
          getCallbacks,
          storageWritable
        }),
      { initialProps: { storageWritable: true } }
    );
    expect(calls()).toHaveLength(4);
    view.rerender({ storageWritable: false });
    expect(calls()).toEqual([]);
    expect(view.result.current.error?.message).toMatch(/browser storage/);
    view.rerender({ storageWritable: true });
    expect(calls()).toHaveLength(4);
    expect(view.result.current.error).toBeNull();
  });

  it('refuses another recipient at the prompt when localStorage stopped taking writes after the Review', async () => {
    mocks.refusal.mockResolvedValue(undefined);
    render({ recipient: OTHER });
    expect(calls()).toHaveLength(4);
    const preflight = mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>;
    mocks.storageWritable = false;
    await expect(preflight(mocks.clients[BASE])).resolves.toMatchObject({
      message: expect.stringMatching(/browser storage/)
    });
    // The wallet's own address needs no storage to be claimed.
    render();
    const own = mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>;
    await expect(own(mocks.clients[BASE])).resolves.toBeUndefined();
  });
});
