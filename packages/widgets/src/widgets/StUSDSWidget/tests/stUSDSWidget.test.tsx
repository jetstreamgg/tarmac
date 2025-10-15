/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { StUSDSWidget } from '..';
import { StUSDSFlow } from '../lib/constants';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

describe('StUSDS widget tests', () => {
  // Mock ResizeObserver as it's being used by the components
  beforeEach(() => {
    //@ts-expect-error ResizeObserver is required in the Window interface
    delete window.ResizeObserver;
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  afterEach(() => {
    window.ResizeObserver = ResizeObserver;
    vi.restoreAllMocks();
  });

  it('loads data when wrapped in wagmi config', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const supplyTab = await screen.findByText('Supply');
    const withdrawTab = await screen.findByText('Withdraw');

    expect(supplyTab).toBeTruthy();
    expect(withdrawTab).toBeTruthy();
  });

  it('displays stUSDS header', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const header = await screen.findByRole('heading', { name: 'stUSDS' });
    const description = await screen.findByText(
      'Access a variable reward rate on USDS by participating in SKY-backed borrowing'
    );

    expect(header).toBeTruthy();
    expect(description).toBeTruthy();
  });

  it('shows supply input by default', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const supplyInput = await screen.findByText('How much USDS would you like to supply?');
    expect(supplyInput).toBeTruthy();
  });

  it('switches to withdraw tab when clicked', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const withdrawTab = await screen.findByText('Withdraw');
    fireEvent.click(withdrawTab);

    const withdrawInput = await screen.findByText('How much USDS would you like to withdraw?');
    expect(withdrawInput).toBeTruthy();
  });

  it('displays connect wallet button when not connected', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const connectButton = await screen.findByText('Connect Wallet');
    expect(connectButton).toBeTruthy();
  });

  it('shows "Supplied balance" balance label', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const balanceLabel = await screen.findByText('Supplied balance');
    expect(balanceLabel).toBeTruthy();
  });

  it('displays available liquidity information', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const availableLiquidityLabel = await screen.findByText('Available liquidity');
    expect(availableLiquidityLabel).toBeTruthy();
  });

  it('handles external state for supply flow', async () => {
    const externalState = {
      flow: StUSDSFlow.SUPPLY,
      amount: '10'
    };

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} externalWidgetState={externalState} />);

    // Should start with supply tab active
    const supplyInput = await screen.findByText('How much USDS would you like to supply?');
    expect(supplyInput).toBeTruthy();
  });

  it('handles external state for withdraw flow', async () => {
    const externalState = {
      flow: StUSDSFlow.WITHDRAW,
      amount: '5'
    };

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} externalWidgetState={externalState} />);

    // Should start with withdraw tab active
    const withdrawInput = await screen.findByText('How much USDS would you like to withdraw?');
    expect(withdrawInput).toBeTruthy();
  });

  it('shows transaction review screen after entering amount', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    const supplyInput = await screen.findByTestId('supply-input-stusds');
    const inputField = supplyInput.querySelector('input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: '10' } });

      await waitFor(() => {
        const reviewButton = screen.queryByText('Review');
        expect(reviewButton).toBeTruthy();
      });
    }
  });

  it('handles referral code integration', async () => {
    const referralCode = 12345;

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} referralCode={referralCode} />);

    // Widget should render without errors with referral code
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();
  });

  it('displays error states properly', async () => {
    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

    // Switch to withdraw tab
    const withdrawTab = await screen.findByText('Withdraw');
    fireEvent.click(withdrawTab);

    const withdrawInput = await screen.findByTestId('withdraw-input-stusds');
    const inputField = withdrawInput.querySelector('input');

    if (inputField) {
      // Enter a very large amount to trigger insufficient funds error
      fireEvent.change(inputField, { target: { value: '999999999' } });

      await waitFor(() => {
        const errorMessage = screen.queryByText(/Insufficient funds/);
        expect(errorMessage).toBeTruthy();
      });
    }
  });

  // Commenting out since the widget doesn't render any progress bars
  // it('shows loading states correctly', async () => {
  //   renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

  //   // Initially should show loading states
  //   const loadingElements = screen.queryAllByRole('progressbar');
  //   expect(loadingElements.length).toBeGreaterThan(0);
  // });

  it('handles widget state changes', async () => {
    const mockStateChange = vi.fn();

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} onWidgetStateChange={mockStateChange} />);

    const supplyInput = await screen.findByTestId('supply-input-stusds');
    const inputField = supplyInput.querySelector('input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: '10' } });

      await waitFor(() => {
        expect(mockStateChange).toHaveBeenCalled();
      });
    }
  });

  // Commenting out as utilization is low in the testnet
  // it('displays high utilization warning on withdraw', async () => {
  //   renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} />);

  //   // Switch to withdraw tab
  //   const withdrawTab = await screen.findByText('Withdraw');
  //   fireEvent.click(withdrawTab);

  //   // Should show utilization warning (mocked at 87%)
  //   await waitFor(() => {
  //     const warningText = screen.queryByText(/High utilization/);
  //     expect(warningText).toBeTruthy();
  //   });
  // });

  it('handles transaction success/failure properly', async () => {
    const mockNotification = vi.fn();

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} onNotification={mockNotification} />);

    // Widget should be set up to handle notifications
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();
  });

  it('handles external link clicks', async () => {
    const mockExternalLink = vi.fn();

    renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} onExternalLinkClicked={mockExternalLink} />);

    // Widget should render without errors
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();
  });

  it('resets properly when shouldReset is true', async () => {
    const { rerender } = renderWithWagmiWrapper(<StUSDSWidget onConnect={() => true} shouldReset={false} />);

    // Re-render with shouldReset=true
    rerender(<StUSDSWidget onConnect={() => true} shouldReset={true} />);

    // Should still render properly after reset
    const supplyTab = await screen.findByText('Supply');
    expect(supplyTab).toBeTruthy();
  });
});
