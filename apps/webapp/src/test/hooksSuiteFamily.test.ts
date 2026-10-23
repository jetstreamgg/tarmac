import { expect, it, vi } from 'vitest';
import { arbitrum, base } from 'viem/chains';
import { TENDERLY_CHAIN_ID } from '@/hooks/constants';
import { familyMainnetId } from '@/utils';
import hooksConfig from '../../vitest.hooks.config';

// The vnet hooks suite (test/hooks/WagmiWrapper.tsx) configures the Tenderly mainnet fork and its
// L2 forks under their real ids, without chain 1, so a mainnet read from an L2 must land on the fork.
it('reads the Ethereum chain of a connected L2 as the Tenderly fork in the hooks suite', () => {
  for (const [key, value] of Object.entries(hooksConfig.test?.env ?? {})) vi.stubEnv(key, String(value));
  for (const l2 of [base.id, arbitrum.id]) expect(familyMainnetId(l2)).toBe(TENDERLY_CHAIN_ID);
});
