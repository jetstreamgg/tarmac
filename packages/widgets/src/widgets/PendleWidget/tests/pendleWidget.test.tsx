/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders the "Powered by Pendle" label with an external link', async () => {
    renderWithWagmiWrapper(<PendleWidget market={market} onConnect={() => true} />);

    const link = await screen.findByRole('link', { name: /Pendle/i });
    expect(link.getAttribute('href')).toContain('pendle.finance');
  });

  it('shows an enabled "Connect Wallet" button when not connected', async () => {
    renderWithWagmiWrapper(<PendleWidget market={market} onConnect={() => true} />);

    const button = (await screen.findByTestId('widget-button')) as HTMLButtonElement;
    // WagmiWrapper's mock connection isn't connected; the action button should
    // stay enabled so clicking it triggers the connect flow.
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Connect Wallet');
  });
});
