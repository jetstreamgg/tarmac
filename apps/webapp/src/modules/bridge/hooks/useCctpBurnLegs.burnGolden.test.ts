/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { encodeFunctionData, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  GOLDEN_L2,
  GOLDEN_RECIPIENT,
  GOLDEN_SENDER,
  GOLDEN_TOKEN_MESSENGER,
  GOLDEN_USDC,
  GOLDEN_USDS,
  goldenBurnLegs
} from '../adapters/cctp/burnGolden.fixtures';
import { CCTP_L2_NETWORKS, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import { useCctpBurnLegs } from './useCctpBurnLegs';

// What the wallet is asked to sign on every L2: the swap's USDC to the
// sender, the mint to the recipient, at that chain's own contracts.

const mocks = vi.hoisted(() => ({
  allowances: [] as Record<string, unknown>[],
  legs: undefined as undefined | Record<string, unknown>
}));

vi.mock('wagmi', () => ({
  usePublicClient: ({ chainId }: { chainId?: number }) => (chainId ? { chainId } : undefined)
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => {
    mocks.allowances.push(params);
    return { data: params.contractAddress ? 0n : undefined, error: null, mutate: vi.fn() };
  }
}));
vi.mock('../adapters/cctp/gate', () => ({
  cctpBurnRefusal: vi.fn(),
  cctpResumeRefusal: vi.fn(),
  CCTP_SWAP_FAILED_MESSAGE: ''
}));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return { isBatch: false, ready: true, error: null, execute: vi.fn(), reset: vi.fn(), stop: vi.fn() };
  }
}));

const CHAIN_ID: Record<CctpL2NetworkId, number> = {
  base: 8453,
  optimism: 10,
  unichain: 130,
  arbitrum: 42161
};
const getCallbacks = () => ({}) as TxCallbacks;

const render = (overrides: Partial<Parameters<typeof useCctpBurnLegs>[0]>) =>
  renderHook(() =>
    useCctpBurnLegs({
      enabled: true,
      from: 'base',
      chainId: CHAIN_ID.base,
      ethereumChainId: 1,
      account: GOLDEN_SENDER,
      recipient: undefined,
      amount: GOLDEN_USDS,
      getCallbacks,
      ...overrides
    })
  ).result.current;

const sent = () =>
  (mocks.legs!.calls as (Call & { to: string })[]).map(call => ({
    to: call.to.toLowerCase(),
    data: encodeFunctionData(call as never)
  }));

describe.each(CCTP_L2_NETWORKS)('the legs of a CCTP bridge from %s', network => {
  const chainId = CHAIN_ID[network];

  beforeEach(() => {
    mocks.allowances = [];
    mocks.legs = undefined;
  });

  it('mint to another recipient, and swap to the sender', () => {
    const legs = render({ from: network, chainId, recipient: GOLDEN_RECIPIENT });

    expect(legs.error).toBeNull();
    expect(sent()).toEqual(goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_RECIPIENT }));
    expect(mocks.legs).toMatchObject({ chainId, sendFunctionName: 'depositForBurn' });
  });

  it('mint to the sender when no recipient was entered', () => {
    render({ from: network, chainId });
    expect(sent()).toEqual(goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_SENDER }));
  });

  it('burn a continued bridge to the recipient its swap was sent for', () => {
    render({
      from: network,
      chainId,
      // The form now names no recipient: the stored one still gets the mint.
      resume: {
        swapTxHash: `0x${'ab'.repeat(32)}`,
        network,
        usdcAmount: GOLDEN_USDC,
        recipient: GOLDEN_RECIPIENT.toLowerCase(),
        at: 0
      }
    });
    expect(sent()).toEqual(
      goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_RECIPIENT }).slice(2)
    );
  });

  it('read the sender allowances of that chain, for the contracts that spend', () => {
    render({ from: network, chainId });
    const { psm3, usds, usdc } = GOLDEN_L2[network];
    expect(mocks.allowances.slice(0, 2)).toEqual([
      { chainId, contractAddress: usds, owner: GOLDEN_SENDER, spender: psm3 },
      { chainId, contractAddress: usdc, owner: GOLDEN_SENDER, spender: GOLDEN_TOKEN_MESSENGER }
    ]);
  });
});
