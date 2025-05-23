/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { UpgradeWidgetWrapped } from '..';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

describe('Upgrade widget tests', () => {
  // We need to mock ResizeObserver as it's being used by the chakra slider
  // https://github.com/maslianok/react-resize-detector#testing-with-enzyme-and-jest
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
    renderWithWagmiWrapper(<UpgradeWidgetWrapped onConnect={() => true} />);

    const items = await screen.findAllByText('Upgrade');

    // Header and button
    expect(items).toHaveLength(2);
  });
});
