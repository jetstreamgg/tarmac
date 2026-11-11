/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { cctpL2Contracts } from '../adapters/cctp/contracts';
import type { BridgeRouteFacts } from '../model/resolveRoute';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { useCctpResumeForm } from './useCctpResumeForm';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const OTHER = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');
const UNIT = 10n ** 12n;
const USDC = 250n * 10n ** 6n;
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a',
  network: 'base',
  usdcAmount: USDC,
  recipient: SENDER.toLowerCase(),
  at: 1
};
const OPEN = { isOpen: true, maxAmount: 10n ** 25n, liquidity: 10n ** 25n };

const mocks = vi.hoisted(() => ({
  gate: undefined as BridgeRouteFacts['cctp'],
  gateArgs: [] as Record<string, unknown>[],
  balanceArgs: [] as Record<string, unknown>[],
  balance: { data: undefined as { value: bigint } | undefined, isLoading: false },
  safeStatus: 'not-safe' as string,
  chains: [1, 8453, 10, 42161, 130]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({ isConnected: true, address: SENDER }),
  useChains: () => mocks.chains.map(id => ({ id }))
}));
vi.mock('@/hooks/ui/useAppChainId', () => ({ useAppChainId: () => 1 }));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useSafeWalletStatus: () => mocks.safeStatus,
  useTokenBalance: (args: Record<string, unknown>) => {
    mocks.balanceArgs.push(args);
    return { ...mocks.balance, refetch: vi.fn(), error: null };
  }
}));
vi.mock('./useCctpGate', () => ({
  useCctpGate: (args: Record<string, unknown>) => {
    mocks.gateArgs.push(args);
    return mocks.gate;
  }
}));

const render = (swap: UnfinishedCctpSwap = SWAP) => renderHook(() => useCctpResumeForm(swap)).result.current;

describe('useCctpResumeForm', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      gate: OPEN,
      gateArgs: [],
      balanceArgs: [],
      balance: { data: { value: USDC }, isLoading: false },
      safeStatus: 'not-safe',
      chains: [1, 8453, 10, 42161, 130]
    });
  });

  it("reads the gate of the swap's network for a burn with no swap", () => {
    render();
    expect(mocks.gateArgs.at(-1)).toEqual({
      from: 'base',
      to: 'ethereum',
      sourceChainId: 8453,
      ethereumChainId: 1,
      swap: false
    });
  });

  it("continues the swap's own bridge, for its USDC only", () => {
    const { form, blockedReason } = render();
    expect(form).toMatchObject({
      amount: USDC * UNIT,
      from: 'base',
      to: 'ethereum',
      recipient: undefined,
      isConnected: true,
      reviewBlocked: false
    });
    expect(form.route?.kind).toBe('cctp');
    expect(blockedReason).toBeUndefined();
  });

  it('stays blocked and reads nothing with no swap', () => {
    const { form, blockedReason } = renderHook(() => useCctpResumeForm(undefined)).result.current;
    expect(form).toMatchObject({ route: undefined, reviewBlocked: true });
    expect(blockedReason).toBeUndefined();
    expect(mocks.gateArgs.at(-1)).toMatchObject({ from: 'ethereum', to: 'ethereum' });
    expect(mocks.balanceArgs.at(-1)).toMatchObject({ enabled: false });
  });

  it('keeps the recipient the swap was for when it is another address', () => {
    expect(render({ ...SWAP, recipient: OTHER.toLowerCase() }).form.recipient).toBe(OTHER);
  });

  it("reads the wallet's USDC on the swap's network", () => {
    render();
    expect(mocks.balanceArgs.at(-1)).toMatchObject({
      address: SENDER,
      token: cctpL2Contracts('base').usdc,
      chainId: 8453
    });
  });

  // An unread gate resolves as open, so a pair with no gate must not get a route.
  it('blocks when the pair has no CCTP gate', () => {
    mocks.gate = undefined;
    const { form, blockedReason } = render();
    expect(form).toMatchObject({ route: undefined, reviewBlocked: true });
    expect(blockedReason).toBe('pair-not-allowed');
  });

  it.each([
    ['loading', 'loading', 'facts-loading'],
    ['unread', 'error', 'facts-error'],
    ['closed', { ...OPEN, isOpen: false }, 'closed'],
    ['under the amount', { ...OPEN, maxAmount: USDC * UNIT - 1n }, 'over-limit'],
    ['short of liquidity', { ...OPEN, liquidity: USDC * UNIT - 1n }, 'no-liquidity']
  ] as const)('blocks with the gate %s, never falling back to the native route', (_, gate, reason) => {
    mocks.gate = gate;
    const { form, blockedReason } = render();
    expect(form).toMatchObject({ route: undefined, reviewBlocked: true });
    expect(blockedReason).toBe(reason);
  });

  it.each([
    [
      'the USDC left is less than the swap returned',
      { data: { value: USDC - 1n }, isLoading: false },
      'insufficient'
    ],
    ['the USDC balance is loading', { data: undefined, isLoading: true }, 'balance-loading'],
    ['the USDC balance could not be read', { data: undefined, isLoading: false }, 'balance-unknown']
  ] as const)('blocks when %s', (_, balance, reason) => {
    mocks.balance = balance;
    const { form, blockedReason } = render();
    expect(form.reviewBlocked).toBe(true);
    expect(blockedReason).toBe(reason);
  });

  it.each([
    ['checking', 'wallet-checking'],
    ['unknown', 'wallet-unknown']
  ])('blocks while the Safe check is %s', (status, reason) => {
    mocks.safeStatus = status;
    const { form, blockedReason } = render();
    expect(form.reviewBlocked).toBe(true);
    expect(blockedReason).toBe(reason);
  });

  it("blocks when the app can't run on the swap's network", () => {
    mocks.chains = [1];
    const { form, blockedReason } = render();
    expect(form.reviewBlocked).toBe(true);
    expect(blockedReason).toBe('source-unavailable');
  });
});
