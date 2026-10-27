/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBridgeForm } from './useBridgeForm';

const mocks = vi.hoisted(() => ({
  appChainId: 1,
  canSwitchChain: true,
  safeStatus: 'not-safe' as 'safe' | 'not-safe',
  switched: [] as number[],
  refetched: [] as number[],
  isOpen: { status: 'success', data: 1n } as { status: 'pending' | 'error' | 'success'; data?: bigint },
  reads: [] as { chainId?: number; address?: string; functionName: string; enabled?: boolean }[],
  /** Code by `chainId:address`; an address not listed has none. */
  code: {} as Record<string, 'contract' | 'none' | undefined>,
  codeChecking: false,
  codeReads: [] as string[]
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  useReadContract: (args: {
    chainId?: number;
    address?: string;
    functionName: string;
    query?: { enabled?: boolean };
  }) => {
    mocks.reads.push({ ...args, enabled: args.query?.enabled });
    return args.query?.enabled ? mocks.isOpen : { status: 'pending', data: undefined };
  }
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useSafeWalletStatus: () => mocks.safeStatus,
  useTokenBalance: ({ chainId }: { chainId: number }) => ({
    data: { value: 10n ** 18n },
    isLoading: false,
    refetch: () => mocks.refetched.push(chainId)
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    canSwitchChain: mocks.canSwitchChain,
    handleSwitchChain: ({ chainId }: { chainId: number }) => mocks.switched.push(chainId)
  })
}));
vi.mock('./useSafeConfig', () => ({ useSafeConfig: () => ({ lookup: undefined, isChecking: false }) }));
// The CCTP gate has its own suite (useBridgeForm.cctp.test.tsx); unread here, an L2 source blocks.
vi.mock('./useCctpGate', () => ({ useCctpGate: () => undefined }));
vi.mock('./useAddressCode', () => ({
  useAddressCode: ({ address, chainId }: { address?: string; chainId?: number }) => {
    if (!address || chainId === undefined) return { code: undefined, isChecking: false };
    const key = `${chainId}:${address.toLowerCase()}`;
    mocks.codeReads.push(key);
    if (mocks.codeChecking) return { code: undefined, isChecking: true };
    return { code: key in mocks.code ? mocks.code[key] : 'none', isChecking: false };
  }
}));

describe('useBridgeForm: a source the app cannot switch (Safe) stays on the wallet network', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 1, canSwitchChain: false, safeStatus: 'safe', switched: [] });
  });

  it('flip keeps the source', () => {
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.isSourceStatic).toBe(true);
    act(() => result.current.flip());
    expect(result.current.from).toBe('ethereum');
    expect(result.current.sourceUnavailable).toBe(false);
  });

  it('picking the source as destination does not swap it', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('ethereum'));
    expect(result.current.from).toBe('ethereum');
  });

  it('picking another source does nothing', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectFrom('base'));
    expect(result.current.from).toBe('ethereum');
    expect(result.current.sourceUnavailable).toBe(false);
  });

  it('still lets the destination change', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('arbitrum'));
    expect(result.current.to).toBe('arbitrum');
  });
});

describe('useBridgeForm: a destination that moves the source keeps the picked destination', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 8453, canSwitchChain: true, safeStatus: 'not-safe', switched: [] });
  });

  it('Base to Arbitrum switches to Ethereum and keeps Arbitrum', () => {
    const { result, rerender } = renderHook(() => useBridgeForm());
    expect(result.current.from).toBe('base');
    act(() => result.current.selectTo('arbitrum'));
    expect(mocks.switched).toEqual([1]);
    mocks.appChainId = 1;
    rerender();
    expect(result.current.from).toBe('ethereum');
    expect(result.current.to).toBe('arbitrum');
  });
});

describe('useBridgeForm: refetchBalances', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      appChainId: 1,
      canSwitchChain: true,
      safeStatus: 'not-safe',
      switched: [],
      refetched: []
    });
  });

  it('rereads the source and destination balances', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('optimism'));
    act(() => result.current.refetchBalances());
    expect(mocks.refetched).toEqual([1, 10]);
  });
});

describe('useBridgeForm: the L1 bridge isOpen gate', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      appChainId: 1,
      canSwitchChain: true,
      safeStatus: 'not-safe',
      switched: [],
      isOpen: { status: 'success', data: 1n },
      reads: []
    });
  });

  const lastRead = () => mocks.reads[mocks.reads.length - 1];

  it('reads the Base L1 bridge proxy on Ethereum and routes when open', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.onInput('1'));
    expect(lastRead()).toMatchObject({
      chainId: 1,
      address: '0xA5874756416Fa632257eEA380CAbd2E87cED352A',
      functionName: 'isOpen',
      enabled: true
    });
    expect(result.current.route?.kind).toBe('native');
    expect(result.current.blockedReason).toBeUndefined();
  });

  it('reads the Arbitrum L1 gateway for an Arbitrum deposit', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('arbitrum'));
    expect(lastRead()).toMatchObject({ address: '0x84b9700E28B23F873b82c1BEb23d86C091b6079E', chainId: 1 });
  });

  it.each([0n, 2n])('blocks as closed when isOpen is %s', value => {
    mocks.isOpen = { status: 'success', data: value };
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.onInput('1'));
    expect(result.current.route).toBeUndefined();
    expect(result.current.blockedReason).toBe('closed');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('blocks while the read is loading', () => {
    mocks.isOpen = { status: 'pending' };
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.onInput('1'));
    expect(result.current.blockedReason).toBe('facts-loading');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('blocks when the read fails or returns nothing', () => {
    mocks.isOpen = { status: 'error' };
    const failed = renderHook(() => useBridgeForm());
    expect(failed.result.current.blockedReason).toBe('facts-error');
    mocks.isOpen = { status: 'success' };
    const empty = renderHook(() => useBridgeForm());
    expect(empty.result.current.blockedReason).toBe('facts-error');
  });

  it('does not read or gate an L2 source', () => {
    mocks.appChainId = 8453;
    mocks.isOpen = { status: 'success', data: 0n };
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.from).toBe('base');
    expect(lastRead()).toMatchObject({ address: undefined, enabled: false });
  });

  it('blocks the routes that are not live yet', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('avalanche'));
    expect(result.current.route).toBeUndefined();
    expect(result.current.blockedReason).toBe('pair-not-allowed');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('does not offer a flip into a route that is not live', () => {
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.route?.kind).toBe('native');
    act(() => result.current.selectTo('avalanche'));
    expect(result.current.canFlip).toBe(false);
  });
});

const WALLET = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2546bcd3c84621e976d8185a91a922ae77ecec30';

describe('useBridgeForm: the recipient code check', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      appChainId: 1,
      canSwitchChain: true,
      safeStatus: 'not-safe',
      switched: [],
      isOpen: { status: 'success', data: 1n },
      reads: [],
      code: {},
      codeChecking: false,
      codeReads: []
    });
  });

  const typed = (recipient: string) => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => {
      result.current.onInput('1');
      result.current.setRecipient(recipient);
    });
    return result;
  };

  it('reads a typed recipient on the source and destination and passes an EOA', () => {
    const result = typed(OTHER);
    expect(mocks.codeReads).toEqual(expect.arrayContaining([`1:${OTHER}`, `8453:${OTHER}`]));
    expect(result.current.recipientProblem).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
  });

  it('blocks a typed recipient that is a contract on Ethereum with no code on the destination', () => {
    mocks.code = { [`1:${OTHER}`]: 'contract', [`8453:${OTHER}`]: 'none' };
    const result = typed(OTHER);
    expect(result.current.recipientProblem).toBe('contract-not-on-destination');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('blocks a token or bridge contract typed as recipient', () => {
    const result = typed('0x820C137fa70C8691f0e44Dc420a5e53c168921Dc');
    expect(result.current.recipientProblem).toBe('system-contract');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('fails closed when the recipient code is unknown, and while it loads', () => {
    mocks.code = { [`1:${OTHER}`]: undefined };
    expect(typed(OTHER).current.recipientProblem).toBe('unverified');
    mocks.codeChecking = true;
    const loading = typed(OTHER);
    expect(loading.current.recipientChecking).toBe(true);
    expect(loading.current.reviewBlocked).toBe(true);
  });

  it('asks a contract wallet without code on the destination for a recipient', () => {
    mocks.code = { [`1:${WALLET}`]: 'contract', [`8453:${WALLET}`]: 'none' };
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.onInput('1'));
    expect(mocks.codeReads).toEqual(expect.arrayContaining([`1:${WALLET}`, `8453:${WALLET}`]));
    expect(result.current.needsRecipient).toBe(true);
    expect(result.current.recipientReason).toBe('contract-not-on-destination');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('lets that wallet through once it types an EOA recipient', () => {
    mocks.code = { [`1:${WALLET}`]: 'contract', [`8453:${WALLET}`]: 'none' };
    const result = typed(OTHER);
    expect(result.current.needsRecipient).toBe(false);
    expect(result.current.recipientProblem).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
  });
});
