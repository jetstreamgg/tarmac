/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { TradeWidget } from '..';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

vi.mock('@jetstreamgg/sky-hooks', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useChainId: vi.fn(() => {
      return 1337;
    }),
    useTokenBalance: vi.fn(() => {
      return { data: { value: 10n }, refetch: vi.fn() };
    }),
    useTokenAllowance: vi.fn(() => {
      return { data: 10n, mutate: vi.fn(), isLoading: false };
    }),
    useApproveToken: vi.fn(() => {
      return { execute: vi.fn() };
    }),
    useSwap: vi.fn(() => {
      return { execute: vi.fn() };
    })
    // Add any other hooks that the TradeWidget uses
  };
});

describe('Trade widget tests', () => {
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
    renderWithWagmiWrapper(<TradeWidget onConnect={() => true} />);

    const tradeButton = await screen.findByText('Trade');
    expect(tradeButton).toBeTruthy();

    const fromTokenSelector = await screen.findByText('Select token');
    expect(fromTokenSelector).toBeTruthy();

    const toTokenSelector = await screen.findByText('Select token');
    expect(toTokenSelector).toBeTruthy();
  });
});
