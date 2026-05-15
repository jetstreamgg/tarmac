import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../../test/hooks';

import { useSavingsData } from './useSavingsData';

describe('useSavingsData', async () => {
  it('Should return a loading state', () => {
    const { result } = renderHook(() => useSavingsData('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'), {
      wrapper: WagmiWrapper
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('should return savings data', async () => {
    const { result } = renderHook(() => useSavingsData('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    expect(result.current.data?.savingsRate).toBeGreaterThan(1000000000000000n);
    expect(result.current.data?.savingsTvl).toBeGreaterThan(1000000000000000000000000n);
    expect(result.current.data?.userNstBalance).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.userSavingsBalance).toBeGreaterThanOrEqual(0n);
    expect(result.current.dataSources.length).toEqual(5);
  });

  afterAll(() => {
    cleanup();
  });
});
