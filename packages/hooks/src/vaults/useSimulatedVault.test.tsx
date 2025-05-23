import { describe, expect, it } from 'vitest';
import { WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useSimulatedVault } from './useSimulatedVault';
import { parseEther } from 'viem';

describe('Hook should return error messages for incorrect vault parameters', async () => {
  // TODO: We should move error messages to a constants file for reuse
  const DUST_ERROR = 'Minimum borrow amount is 30000';
  const DUST_REPAY_ERROR = 'Debt must be payed off entirely, or left with a minimum of 30000';
  const INSUFFICIENT_COLLATERAL_ERROR = 'Insufficient collateral';

  const wrapper = WagmiWrapper;

  it('shows dust limit error when opening a position and drawing debt', async () => {
    const colAmt = parseEther('100');
    const existingDebtAmt = parseEther('0');
    const newDebtAmt = parseEther('5000');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error(DUST_ERROR));
      return;
    });
  });

  it('shows dust limit error when repaying some debt', async () => {
    const colAmt = parseEther('100');
    const existingDebtAmt = parseEther('10000');
    const newDebtAmt = parseEther('5000');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error(DUST_REPAY_ERROR));
      return;
    });
  });

  it('shows insufficient collateral when trying to draw more than the collateral value', async () => {
    const colAmt = parseEther('10');
    const existingDebtAmt = parseEther('0');
    const newDebtAmt = parseEther('16080');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error(INSUFFICIENT_COLLATERAL_ERROR));
      return;
    });
  });

  it('shows insufficient collateral when trying to draw more than the collateral value from a position with existing debt', async () => {
    const colAmt = parseEther('100');
    const existingDebtAmt = parseEther('30000');
    const newDebtAmt = parseEther('130000');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error(INSUFFICIENT_COLLATERAL_ERROR));
      return;
    });
  });

  it('can draw a small additional amount of debt from a position with existing debt', async () => {
    const colAmt = parseEther('20');
    const existingDebtAmt = parseEther('30000');
    const newDebtAmt = parseEther('30005');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toEqual(null);
      return;
    });
  });

  it('drawing more debt from a position does not show an error as long as there is enough collateral to cover it', async () => {
    const colAmt = parseEther('304.88');
    const existingDebtAmt = parseEther('119516');
    const newDebtAmt = parseEther('120000');

    const { result } = renderHook(() => useSimulatedVault(colAmt, newDebtAmt, existingDebtAmt), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.riskLevel).toEqual('MEDIUM');
      return;
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(null);
      return;
    });
  });
});
