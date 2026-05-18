/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const captured = vi.hoisted(() => ({ args: undefined as unknown[] | undefined }));

vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: (...args: unknown[]) => {
    captured.args = args;
    return () => {};
  }
}));

import { SavingsWidget } from '..';

describe('SavingsWidget widget-name parity', () => {
  beforeEach(() => {
    captured.args = undefined;
  });

  it("calls useWidgetAnalytics with the hardcoded widgetName 'savings'", async () => {
    render(<SavingsWidget />, { wrapper: WagmiWrapper });
    await waitFor(() => {
      expect(captured.args).toBeDefined();
    });
    expect(captured.args?.[0]).toBe('savings');
    expect(typeof captured.args?.[1]).toBe('number');
  });
});
