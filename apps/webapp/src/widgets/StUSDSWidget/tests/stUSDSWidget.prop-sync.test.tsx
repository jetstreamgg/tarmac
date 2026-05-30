/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { StUSDSWidget } from '..';
import { StUSDSFlow } from '../lib/constants';

/**
 * Characterization test for prop-sync behavior in StUSDSWidget.
 *
 * The widget receives `externalWidgetState.flow` and mirrors it into local
 * `tabIndex` state via `useEffect(setTabIndex(initialTabIndex), [initialTabIndex])`.
 * This test locks in the observable end-state behavior so that the refactor
 * to the render-time "adjust state on prop change" pattern doesn't regress —
 * if the prop sync breaks, the active tab will not switch on rerender and
 * this test will fail.
 */
describe('StUSDSWidget prop-sync', () => {
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
    // RTL's rerender reuses the wrapper given on first render, so we pass
    // bare components (no WagmiWrapper re-wrap, which would nest routers).
    const { rerender } = render(<StUSDSWidget externalWidgetState={{ flow: StUSDSFlow.SUPPLY }} />, {
      wrapper: WagmiWrapper
    });

    // Initial: SUPPLY flow → supply input copy visible.
    expect(await screen.findByText('How much USDS would you like to supply?')).toBeTruthy();

    // Rerender with WITHDRAW → withdraw input copy should now be visible.
    rerender(<StUSDSWidget externalWidgetState={{ flow: StUSDSFlow.WITHDRAW }} />);
    expect(await screen.findByText('How much USDS would you like to withdraw?')).toBeTruthy();

    // And back to SUPPLY.
    rerender(<StUSDSWidget externalWidgetState={{ flow: StUSDSFlow.SUPPLY }} />);
    expect(await screen.findByText('How much USDS would you like to supply?')).toBeTruthy();
  });
});
