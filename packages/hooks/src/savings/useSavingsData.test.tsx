import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../test';

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

    expect(result.current.data?.savingsRate).toBe(59999997611290600n);
    expect(result.current.data?.savingsTvl).toBe(1964485263326169406547674321n);
    expect(result.current.data?.userNstBalance).toBe(11000000000000000000000n);
    expect(result.current.data?.userSavingsBalance).toBeGreaterThanOrEqual(1000000499822603103n);
    expect(result.current.dataSources.length).toEqual(5);
  });

  afterAll(() => {
    cleanup();
  });
});
