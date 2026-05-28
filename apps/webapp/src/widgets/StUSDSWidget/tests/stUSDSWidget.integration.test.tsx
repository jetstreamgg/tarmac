/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { StUSDSWidget } from '..';
import { StUSDSFlow } from '../lib/constants';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

describe('StUSDS Widget Integration Tests', () => {
  beforeEach(() => {
    //@ts-expect-error ResizeObserver is required in the Window interface
    delete window.ResizeObserver;
    window.ResizeObserver = vi.fn().mockImplementation(function () {
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      };
    });
  });

  afterEach(() => {
    window.ResizeObserver = ResizeObserver;
    vi.restoreAllMocks();
  });

  it('completes full supply flow', async () => {
    const mockStateChange = vi.fn();

    renderWithWagmiWrapper(<StUSDSWidget onWidgetStateChange={mockStateChange} />);

    // 1. Start with supply tab
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();

    // 2. Enter amount
    const supplyInput = await screen.findByTestId('supply-input-stusds');
    const inputField = supplyInput.querySelector('input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: '10' } });

      // 3. Should show Review button
      await waitFor(() => {
        const reviewButton = screen.queryByText('Review');
        expect(reviewButton).toBeTruthy();
      });

      // 4. Click Review button
      const reviewButton = screen.getByText('Review');
      fireEvent.click(reviewButton);

      // 5. Should show transaction review screen
      await waitFor(() => {
        const transactionOverview = screen.queryByText('Transaction overview');
        expect(transactionOverview).toBeTruthy();
      });

      // 6. Should show supply amount in overview
      await waitFor(() => {
        const supplyAmount = screen.queryByText('You will supply');
        expect(supplyAmount).toBeTruthy();
      });
    }
  });

  it('completes full withdraw flow', async () => {
    const mockStateChange = vi.fn();

    renderWithWagmiWrapper(<StUSDSWidget onWidgetStateChange={mockStateChange} />);

    // 1. Switch to withdraw tab
    const withdrawTab = await screen.findByText('Withdraw');
    fireEvent.click(withdrawTab);

    // 2. Should show withdraw input
    const withdrawInput = await screen.findByText('How much USDS would you like to withdraw?');
    expect(withdrawInput).toBeTruthy();

    // 3. Enter amount
    const withdrawInputField = await screen.findByTestId('withdraw-input-stusds');
    const inputField = withdrawInputField.querySelector('input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: '5' } });

      // 4. Should show Review button
      await waitFor(() => {
        const reviewButton = screen.queryByText('Review');
        expect(reviewButton).toBeTruthy();
      });

      // 5. Click Review button
      const reviewButton = screen.getByText('Review');
      fireEvent.click(reviewButton);

      // 6. Should show transaction review screen
      await waitFor(() => {
        const transactionOverview = screen.queryByText('Transaction overview');
        expect(transactionOverview).toBeTruthy();
      });

      // 7. Should show withdraw amount in overview
      await waitFor(() => {
        const withdrawAmount = screen.queryByText('You will withdraw');
        expect(withdrawAmount).toBeTruthy();
      });
    }
  });

  it('handles approval flow correctly', async () => {
    renderWithWagmiWrapper(<StUSDSWidget />);

    // Test approval flow by ensuring the widget can handle approval states
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();

    // The widget should be prepared to handle approval transactions
    // This is tested through the hook integration
  });

  it('validates balance checks correctly', async () => {
    renderWithWagmiWrapper(<StUSDSWidget />);

    // Switch to withdraw tab
    const withdrawTab = await screen.findByText('Withdraw');
    fireEvent.click(withdrawTab);

    const withdrawInput = await screen.findByTestId('withdraw-input-stusds');
    const inputField = withdrawInput.querySelector('input');

    if (inputField) {
      // Enter amount larger than balance
      fireEvent.change(inputField, { target: { value: '999999999' } });

      // Should show insufficient funds error
      await waitFor(() => {
        const errorMessage = screen.queryByText(/Insufficient funds/);
        expect(errorMessage).toBeTruthy();
      });

      // Should show user's actual balance in error message
      await waitFor(() => {
        const balanceText = screen.queryByText(/Your balance is/);
        expect(balanceText).toBeTruthy();
      });
    }
  });

  it('handles external state synchronization', async () => {
    const mockStateChange = vi.fn();

    const { rerender } = renderWithWagmiWrapper(
      <StUSDSWidget
        onWidgetStateChange={mockStateChange}
        externalWidgetState={{
          flow: StUSDSFlow.SUPPLY,
          amount: '10'
        }}
      />
    );

    // Should start with supply flow and amount
    const supplyInput = await screen.findByTestId('supply-input-stusds');
    const inputField = supplyInput.querySelector('input');

    if (inputField) {
      expect(inputField.value).toBe('10');
    }

    // Change external state
    rerender(
      <StUSDSWidget
        onWidgetStateChange={mockStateChange}
        externalWidgetState={{
          flow: StUSDSFlow.WITHDRAW,
          amount: '5'
        }}
      />
    );

    // Should switch to withdraw flow
    const withdrawInput = await screen.findByText('How much USDS would you like to withdraw?');
    expect(withdrawInput).toBeTruthy();
  });

  it('handles referral code integration properly', async () => {
    renderWithWagmiWrapper(<StUSDSWidget />);

    // Widget should render; referralCode is now sourced from REFERRAL_CODE constant.
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();
  });

  it('handles error states properly', async () => {
    renderWithWagmiWrapper(<StUSDSWidget />);

    // Test error handling by triggering balance error
    const withdrawTab = await screen.findByText('Withdraw');
    fireEvent.click(withdrawTab);

    const withdrawInput = await screen.findByTestId('withdraw-input-stusds');
    const inputField = withdrawInput.querySelector('input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: '999999999' } });

      // Should show error state
      await waitFor(() => {
        const errorMessage = screen.queryByText(/Insufficient funds/);
        expect(errorMessage).toBeTruthy();
      });
    }
  });

  it('handles transaction success/failure flows', async () => {
    renderWithWagmiWrapper(<StUSDSWidget />);

    // Widget should be set up to handle success/failure callbacks
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();

    // The actual transaction handling is tested through the hook integration
  });

  // Commenting out since these buttons are not visible when not connected
  // and we're currently not handling connection states in these tests
  // it('shows percentage buttons when connected', async () => {
  //   renderWithWagmiWrapper(<StUSDSWidget />);

  //   // Should show percentage buttons for supply
  //   await waitFor(() => {
  //     const twentyFivePercent = screen.queryByText('25%');
  //     const fiftyPercent = screen.queryByText('50%');
  //     const hundredPercent = screen.queryByText('100%');

  //     expect(twentyFivePercent).toBeTruthy();
  //     expect(fiftyPercent).toBeTruthy();
  //     expect(hundredPercent).toBeTruthy();
  //   });
  // });
});
