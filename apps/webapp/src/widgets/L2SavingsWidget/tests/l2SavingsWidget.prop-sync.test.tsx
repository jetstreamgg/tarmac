/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { L2SavingsWidget } from '..';
import { SavingsFlow } from '@/widgets/SavingsWidget/lib/constants';

/**
 * Characterization test for prop-sync behavior in L2SavingsWidget.
 *
 * The widget receives `externalWidgetState.flow` and mirrors it into local
 * `tabIndex` state via `useEffect(setTabIndex(initialTabIndex), [initialTabIndex])`.
 * Locks in the observable end-state behavior so the refactor to the
 * render-time "adjust state on prop change" pattern doesn't regress.
 */
describe('L2SavingsWidget prop-sync', () => {
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

  it('switches the active tab when externalWidgetState.flow changes between renders', async () => {
    const { rerender } = render(<L2SavingsWidget externalWidgetState={{ flow: SavingsFlow.SUPPLY }} />, {
      wrapper: WagmiWrapper
    });

    // Initial: SUPPLY → supply input copy visible (default token is USDS).
    expect(await screen.findByText('How much USDS would you like to supply?')).toBeTruthy();

    // Rerender with WITHDRAW → withdraw input copy should appear.
    rerender(<L2SavingsWidget externalWidgetState={{ flow: SavingsFlow.WITHDRAW }} />);
    expect(await screen.findByText('How much USDS would you like to withdraw?')).toBeTruthy();

    // And back to SUPPLY.
    rerender(<L2SavingsWidget externalWidgetState={{ flow: SavingsFlow.SUPPLY }} />);
    expect(await screen.findByText('How much USDS would you like to supply?')).toBeTruthy();
  });
});
