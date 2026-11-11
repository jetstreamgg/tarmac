/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
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

const WALLET = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2546bcd3c84621e976d8185a91a922ae77ecec30';

describe('useBridgeForm: a contract wallet sending to itself', () => {
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

  const form = (recipient?: string) => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => {
      result.current.onInput('1');
      if (recipient) result.current.setRecipient(recipient);
    });
    return result.current;
  };

  it('is flagged when the wallet has code on the source and the destination pays it', () => {
    mocks.code = { [`1:${WALLET}`]: 'contract', [`8453:${WALLET}`]: 'contract' };
    expect(form().senderIsContract).toBe(true);
    // Its own address typed in, checksummed, still pays the wallet.
    expect(form(getAddress(WALLET)).senderIsContract).toBe(true);
  });

  it('is not flagged for an EOA, or for an EIP-7702 account (no code by codeKind)', () => {
    expect(form().senderIsContract).toBe(false);
  });

  it('is not flagged once another recipient is typed, even a contract: the destination pays that one', () => {
    mocks.code = {
      [`1:${WALLET}`]: 'contract',
      [`8453:${WALLET}`]: 'contract',
      [`1:${OTHER}`]: 'contract',
      [`8453:${OTHER}`]: 'contract'
    };
    expect(form(OTHER).senderIsContract).toBe(false);
  });

  it('is not flagged while the code is unknown, which blocks Review instead', () => {
    mocks.code = { [`1:${WALLET}`]: undefined };
    const unknown = form();
    expect(unknown.senderIsContract).toBe(false);
    expect(unknown.reviewBlocked).toBe(true);
  });
});
