import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import { Intent } from '@/lib/enums';
import { chainId, forkChainId } from '@/utils/chainId';

const FORK_L2_IDS = Object.values(forkChainId);

vi.mock('wagmi', () => ({ useChainId: vi.fn(), useChains: vi.fn() }));
vi.mock('@/data/wagmi/config/forkChains', () => ({ forkL2ChainIds: Object.values(forkChainId) }));

import { useChainId, useChains } from 'wagmi';
import { useProductNetworks } from './useProductNetworks';

const DEV_CONFIG_IDS = [
  mainnet.id,
  chainId.tenderly,
  base.id,
  arbitrum.id,
  optimism.id,
  unichain.id,
  ...FORK_L2_IDS
];

const render = (connected: number) => {
  vi.mocked(useChainId).mockReturnValue(connected);
  vi.mocked(useChains).mockReturnValue(DEV_CONFIG_IDS.map(id => ({ id })) as never);
  return renderHook(() => useProductNetworks(Intent.SAVINGS_INTENT)).result.current;
};

describe('useProductNetworks in the dev build with fork L2s', () => {
  it('offers only the fork family while connected to a fork', () => {
    for (const connected of [chainId.tenderly, forkChainId.base]) {
      const ids = render(connected);
      expect(ids).toEqual(expect.arrayContaining([chainId.tenderly, ...FORK_L2_IDS]));
      expect(ids).not.toContain(mainnet.id);
      expect(ids).not.toContain(base.id);
    }
  });

  it('never offers a fork L2 next to its real L2 while connected to a real chain', () => {
    for (const connected of [mainnet.id, base.id]) {
      const ids = render(connected);
      for (const forkL2 of FORK_L2_IDS) expect(ids).not.toContain(forkL2);
    }
  });

  it('keeps the real chains while connected to one', () => {
    const ids = render(base.id);
    expect(ids).toContain(mainnet.id);
    expect(ids).toContain(base.id);
  });
});
