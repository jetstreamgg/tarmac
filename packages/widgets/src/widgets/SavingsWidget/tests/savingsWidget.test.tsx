/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { SavingsWidget } from '..';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

describe('Savings widget tests', () => {
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
    renderWithWagmiWrapper(<SavingsWidget onConnect={() => true} />);

    const item = await screen.findByText('Supply');

    expect(item).toBeTruthy();
  });
});
