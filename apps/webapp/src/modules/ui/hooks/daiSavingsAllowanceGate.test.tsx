import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBatchUpgradeAndSavingsSupply } from '@/hooks/savings/useBatchUpgradeAndSavingsSupply';

// In the fast suite: tests under src/hooks run against the Tenderly vnets.

const reads = vi.hoisted(() => ({
  dai: undefined as bigint | undefined,
  usds: undefined as bigint | undefined
}));
const flow = vi.hoisted(() => ({ enabled: undefined as boolean | undefined }));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useAccount: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true }),
  useChainId: () => 1
}));
vi.mock('@/hooks/tokens/useTokenAllowance', () => ({ useTokenAllowance: () => ({ data: reads.dai }) }));
vi.mock('@/hooks/savings/useSavingsAllowance', () => ({ useSavingsAllowance: () => ({ data: reads.usds }) }));
vi.mock('@/hooks/shared/useBatchWriteFlow', () => ({
  useBatchWriteFlow: ({ enabled }: { enabled: boolean }) => {
    flow.enabled = enabled;
    return {};
  }
}));

const render = () => renderHook(() => useBatchUpgradeAndSavingsSupply({ amount: 10n }));

describe('useBatchUpgradeAndSavingsSupply allowance gate', () => {
  it('stays disabled until both allowances have loaded, instead of adding approves for missing reads', () => {
    reads.dai = undefined;
    reads.usds = 100n;
    render();
    expect(flow.enabled).toBe(false);

    reads.dai = 100n;
    reads.usds = undefined;
    render();
    expect(flow.enabled).toBe(false);

    reads.usds = 100n;
    render();
    expect(flow.enabled).toBe(true);
  });
});
