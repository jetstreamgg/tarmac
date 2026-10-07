/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppChainId } from '@/hooks/ui/useAppChainId';
import { familyMainnetId } from '@/utils/isTestnetId';
import { usePendingScope } from './usePendingScope';

// A wallet parked on a chain the app doesn't configure: wagmi keeps naming the last configured one.
vi.mock('wagmi', () => ({
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001', chainId: 137 }),
  useChainId: () => 314310,
  useChains: () => [{ id: 1 }, { id: 314310 }]
}));

describe('usePendingScope', () => {
  it('scopes by the chain the app is on, the same family the form uses', () => {
    const { result } = renderHook(() => ({
      scope: usePendingScope(),
      formFamily: familyMainnetId(useAppChainId())
    }));
    expect(result.current.formFamily).not.toBe(familyMainnetId(314310));
    expect(result.current.scope.familyChainId).toBe(result.current.formFamily);
  });
});
