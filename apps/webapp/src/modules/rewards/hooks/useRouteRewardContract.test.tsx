import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';

// The reward route resolves its contract against the chain the route guard
// judges, so the two cannot disagree. They did (APP-591): with the wallet on an
// unconfigured chain and a switch it never answered, the guard found the
// contract on the switch's target and kept the route, while this hook looked
// on the wallet's chain, found nothing, and the page rendered empty.

const MAINNET = 1;
const POLYGON = 137;

let mockTargetChainId = MAINNET;
const contractsByChain: Record<number, { contractAddress: string }[]> = {
  [MAINNET]: [{ contractAddress: '0xAbC' }],
  [POLYGON]: []
};

vi.mock('@/hooks', () => ({
  useAvailableTokenRewardContracts: (chainId: number) => contractsByChain[chainId]
}));
vi.mock('@/lib/navigation', () => ({
  useRouteIntent: () => Intent.REWARDS_INTENT,
  useRouteEntityParams: () => ({ rewardContract: '0xabc' })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useTargetChainId: () => mockTargetChainId
}));

const { useRouteRewardContract } = await import('./useRouteRewardContract');

beforeEach(() => {
  mockTargetChainId = MAINNET;
});

describe('useRouteRewardContract', () => {
  it('resolves the path param against the target chain, case-insensitively', () => {
    const { result } = renderHook(() => useRouteRewardContract());
    expect(result.current?.contractAddress).toBe('0xAbC');
  });

  it('resolves nothing on a chain without the contract, which the guard then redirects', () => {
    mockTargetChainId = POLYGON;
    const { result } = renderHook(() => useRouteRewardContract());
    expect(result.current).toBeUndefined();
  });
});
