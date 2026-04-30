/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PENDLE_MARKETS } from '@jetstreamgg/sky-hooks';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { PendleWidget } from '..';

const renderWithWagmiWrapper = (ui: any, options?: any) =>
  render(ui, { wrapper: WagmiWrapper, ...options });

const market = PENDLE_MARKETS[0];

describe('Pendle widget tests', () => {
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

  it('renders the supply tab by default with the market header', async () => {
    renderWithWagmiWrapper(<PendleWidget market={market} onConnect={() => true} />);

    expect(await screen.findByText('Supply')).toBeTruthy();
    expect(screen.getByText('Withdraw')).toBeTruthy();
    // PT-<symbol> appears in multiple places (header, market card, etc.) — assert at least one.
    expect(screen.getAllByText(`PT-${market.underlyingSymbol}`, { exact: false }).length).toBeGreaterThan(0);
  });

  it('toggles the routing disclosure when clicked', async () => {
    renderWithWagmiWrapper(<PendleWidget market={market} onConnect={() => true} />);

    const toggle = await screen.findByTestId('pendle-routing-disclosure-toggle');
    expect(toggle.textContent).toContain('see details');

    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('hide details');
  });

  it('disables the action button when not connected', async () => {
    renderWithWagmiWrapper(<PendleWidget market={market} onConnect={() => true} />);

    const button = (await screen.findByTestId('widget-button')) as HTMLButtonElement;
    // WagmiWrapper's mock connection isn't connected; widget should disable until connect.
    expect(button.disabled).toBe(true);
  });
});
