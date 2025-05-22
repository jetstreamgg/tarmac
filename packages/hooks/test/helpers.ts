import { expect } from 'vitest';
import { WriteHook } from '../src';
import { renderHook, waitFor } from '@testing-library/react';
import { WagmiWrapper } from './WagmiWrapper';

export const waitForPreparedExecuteAndMine = async (
  result: { current: WriteHook },
  loadingTimeout: number = 3000
) => {
  await waitFor(
    () => {
      expect(result.current.prepared).toBe(true);
    },
    { timeout: 15000 }
  );
  result.current.execute();

  await waitFor(
    () => {
      expect(result.current.isLoading).toBe(true);
    },
    { timeout: loadingTimeout }
  );
  await waitFor(
    () => {
      expect(result.current.isLoading).toBe(false);
    },
    { timeout: loadingTimeout }
  );
  expect(result.current.error).toBeNull();
};

export const getUrnAddress = async (urnIndex: bigint, useUrnAddress: any) => {
  const { result: resultUrnAddress } = renderHook(() => useUrnAddress(urnIndex), { wrapper: WagmiWrapper });
  await waitFor(
    () => {
      expect(resultUrnAddress.current.data).toBeDefined();
      return;
    },
    { timeout: 5000 }
  );
  return resultUrnAddress.current.data as `0x${string}`;
};
