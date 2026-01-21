/// <reference types="vite/client" />

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StUsdsProviderType, StUsdsSelectionReason, StUsdsBlockedReason } from '@jetstreamgg/sky-hooks';
import { ProviderIndicator, ProviderIndicatorProps } from '../components/ProviderIndicator';
import { StUSDSFlow } from '../lib/constants';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';

// Use WagmiWrapper which includes I18nWidgetProvider
const renderWithWrapper = (ui: React.ReactElement) => render(ui, { wrapper: WagmiWrapper });

describe('ProviderIndicator', () => {
  beforeEach(() => {
    // Mock ResizeObserver
    // @ts-expect-error ResizeObserver is required in the Window interface
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

  describe('Native provider scenarios', () => {
    it('should not render when using native provider with default reason', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.NATIVE,
        selectionReason: StUsdsSelectionReason.NATIVE_DEFAULT,
        rateDifferencePercent: 0,
        flow: StUSDSFlow.SUPPLY
      };

      const { container } = renderWithWrapper(<ProviderIndicator {...props} />);

      // Wait for i18n to load
      await waitFor(() => {
        // Component should return null for native default
        expect(container.innerHTML).toBe('');
      });
    });

    it('should show fetching rates spinner when loading', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.CURVE,
        selectionReason: StUsdsSelectionReason.CURVE_BETTER_RATE,
        rateDifferencePercent: 0.5,
        flow: StUSDSFlow.SUPPLY,
        isLoading: true
      };

      const { container } = renderWithWrapper(<ProviderIndicator {...props} />);

      await waitFor(
        () => {
          expect(container.innerHTML).toContain('Fetching rates');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Curve provider - supply cap reached', () => {
    it('should show Curve-related message when native is blocked due to capacity', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.CURVE,
        selectionReason: StUsdsSelectionReason.CURVE_ONLY_AVAILABLE,
        rateDifferencePercent: 0,
        flow: StUSDSFlow.SUPPLY,
        nativeBlockedReason: StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED
      };

      const { container } = renderWithWrapper(<ProviderIndicator {...props} />);

      // Wait for i18n to load and component to render
      await waitFor(
        () => {
          expect(container.innerHTML).toContain('Curve');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Curve provider - better rate', () => {
    it('should show rate percentage when Curve has better rate', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.CURVE,
        selectionReason: StUsdsSelectionReason.CURVE_BETTER_RATE,
        rateDifferencePercent: 0.25,
        flow: StUSDSFlow.SUPPLY
      };

      renderWithWrapper(<ProviderIndicator {...props} />);

      await waitFor(
        () => {
          expect(screen.getByText(/\+0\.25%/)).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should format rate difference correctly', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.CURVE,
        selectionReason: StUsdsSelectionReason.CURVE_BETTER_RATE,
        rateDifferencePercent: 1.5,
        flow: StUSDSFlow.SUPPLY
      };

      renderWithWrapper(<ProviderIndicator {...props} />);

      await waitFor(
        () => {
          expect(screen.getByText(/\+1\.50%/)).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Both providers blocked', () => {
    it('should render when all providers are blocked', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.NATIVE,
        selectionReason: StUsdsSelectionReason.ALL_BLOCKED,
        rateDifferencePercent: 0,
        flow: StUSDSFlow.SUPPLY
      };

      const { container } = renderWithWrapper(<ProviderIndicator {...props} />);

      await waitFor(
        () => {
          expect(container.innerHTML.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Generic Curve fallback', () => {
    it('should render for supply with CURVE_ONLY_AVAILABLE', async () => {
      const props: ProviderIndicatorProps = {
        selectedProvider: StUsdsProviderType.CURVE,
        selectionReason: StUsdsSelectionReason.CURVE_ONLY_AVAILABLE,
        rateDifferencePercent: 0,
        flow: StUSDSFlow.SUPPLY
      };

      const { container } = renderWithWrapper(<ProviderIndicator {...props} />);

      await waitFor(
        () => {
          expect(container.innerHTML.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });
});
