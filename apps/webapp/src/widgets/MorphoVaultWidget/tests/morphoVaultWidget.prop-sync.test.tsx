/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { MorphoVaultWidget } from '..';
import { TOKENS } from '@/hooks';
import { MorphoVaultFlow } from '../lib/constants';

/**
 * Characterization test for prop-sync behavior in MorphoVaultWidget.
 *
 * The widget receives `externalWidgetState.flow` and mirrors it into local
 * `tabIndex` state via `useEffect(setTabIndex(initialTabIndex), [initialTabIndex])`.
 * Locks in the observable end-state behavior so the refactor to the
 * render-time "adjust state on prop change" pattern doesn't regress.
 */
describe('MorphoVaultWidget prop-sync', () => {
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

  const baseProps = {
    vaultAddress: '0x0000000000000000000000000000000000000001' as const,
    assetAddress: '0x0000000000000000000000000000000000000002' as const,
    assetToken: TOKENS.usdc
  };

  it('switches the active tab when externalWidgetState.flow changes between renders', async () => {
    const { rerender } = render(
      <MorphoVaultWidget {...baseProps} externalWidgetState={{ flow: MorphoVaultFlow.SUPPLY }} />,
      { wrapper: WagmiWrapper }
    );

    // Initial: SUPPLY → supply input copy visible.
    expect(await screen.findByText('How much USDC would you like to supply?')).toBeTruthy();

    // Rerender with WITHDRAW → withdraw input copy should appear.
    rerender(<MorphoVaultWidget {...baseProps} externalWidgetState={{ flow: MorphoVaultFlow.WITHDRAW }} />);
    expect(await screen.findByText('How much USDC would you like to withdraw?')).toBeTruthy();

    // And back to SUPPLY.
    rerender(<MorphoVaultWidget {...baseProps} externalWidgetState={{ flow: MorphoVaultFlow.SUPPLY }} />);
    expect(await screen.findByText('How much USDC would you like to supply?')).toBeTruthy();
  });

  /**
   * Characterizes the "Handle external state changes" useEffect at index.tsx:276
   * (sets amount from validatedExternalState.amount when txStatus === IDLE).
   * Locks in: rerender with a new externalWidgetState.amount → input value reflects it.
   */
  it('updates the supply input value when externalWidgetState.amount changes between renders', async () => {
    const { rerender } = render(
      <MorphoVaultWidget
        {...baseProps}
        externalWidgetState={{ flow: MorphoVaultFlow.SUPPLY, amount: '10' }}
      />,
      { wrapper: WagmiWrapper }
    );

    // Locate the input field inside the testid wrapper that USDC widgets use.
    const initialInput = (await screen.findByText('How much USDC would you like to supply?'))
      .closest('div')
      ?.parentElement?.querySelector('input');
    expect(initialInput).toBeTruthy();
    expect(initialInput?.value).toBe('10');

    rerender(
      <MorphoVaultWidget
        {...baseProps}
        externalWidgetState={{ flow: MorphoVaultFlow.SUPPLY, amount: '25' }}
      />
    );

    // After rerender, the input should reflect the new value.
    const updatedInput = (await screen.findByText('How much USDC would you like to supply?'))
      .closest('div')
      ?.parentElement?.querySelector('input');
    expect(updatedInput?.value).toBe('25');
  });
});
