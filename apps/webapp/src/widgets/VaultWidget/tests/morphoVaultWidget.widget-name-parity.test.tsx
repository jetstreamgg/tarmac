/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { TOKENS } from '@/hooks';

const captured = vi.hoisted(() => ({ args: undefined as unknown[] | undefined }));

vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: (...args: unknown[]) => {
    captured.args = args;
    return () => {};
  }
}));

import { VaultWidget } from '..';

describe('VaultWidget widget-name parity', () => {
  beforeEach(() => {
    captured.args = undefined;
  });

  it("calls useWidgetAnalytics with the hardcoded widgetName 'vaults'", async () => {
    render(
      <VaultWidget
        vaultAddress="0x0000000000000000000000000000000000000001"
        assetAddress="0x0000000000000000000000000000000000000002"
        assetToken={TOKENS.usdc}
      />,
      { wrapper: WagmiWrapper }
    );
    await waitFor(() => {
      expect(captured.args).toBeDefined();
    });
    expect(captured.args?.[0]).toBe('vaults');
    expect(typeof captured.args?.[1]).toBe('number');
  });
});
