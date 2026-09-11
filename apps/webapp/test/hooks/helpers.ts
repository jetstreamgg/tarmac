import { expect } from 'vitest';
import { WriteHook } from '../../src/hooks';
import { renderHook, waitFor } from '@testing-library/react';
import { WagmiWrapper } from './WagmiWrapper';
import { BatchWriteHook } from '../../src/hooks/hooks';

export const waitForPreparedExecuteAndMine = async (
  result: { current: WriteHook | BatchWriteHook; rerender?: () => void },
  loadingTimeout: number = 5000
) => {
  await waitFor(
    () => {
      expect(result.current.prepared).toBe(true);
    },
    {
      timeout: 15000,
      interval: 100,
      onTimeout: error => {
        console.log({ writeHookResponse: result.current });
        return error;
      }
    }
  );
  result.current.execute();

  // A Tenderly vnet mines on send, so the hook's `isLoading` can switch on and
  // back off between two of waitFor's polls — waiting to *see* it on is a race
  // the suite lost intermittently. The mined hash and the error stick, so wait
  // for whichever of the three shows first, then for the flag to settle.
  await waitFor(
    () => {
      const { isLoading, data, error } = result.current;
      expect(isLoading || data !== undefined || error !== null).toBe(true);
    },
    {
      timeout: 15000,
      interval: 100,
      onTimeout: error => {
        console.log({ writeHookResponse: result.current });
        return error;
      }
    }
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
