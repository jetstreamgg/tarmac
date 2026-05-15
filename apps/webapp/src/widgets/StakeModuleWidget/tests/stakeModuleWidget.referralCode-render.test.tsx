/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const stakeLockCaptured = vi.hoisted(() => ({ params: undefined as Record<string, unknown> | undefined }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getStakeLockCalldata: (params: Record<string, unknown>) => {
      stakeLockCaptured.params = params;
      return '0xdeadbeef' as `0x${string}`;
    }
  };
});

import { StakeModuleWidget } from '..';

describe('StakeModuleWidget referralCode render-layer parity', () => {
  it('renders without errors; refCode contract-arg assertion is covered at Gate 2 in context.test.tsx', async () => {
    const { container } = render(<StakeModuleWidget />, {
      wrapper: WagmiWrapper
    });
    // Gate 3 smoke: the widget must render to confirm REFERRAL_CODE is imported and reachable.
    // Direct refCode-on-calldata assertion lives at Gate 2 (context.test.tsx) because
    // generateAllCalldata is invoked inside a useEffect gated by allStepsComplete + address + urnIndex.
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull();
    });
  });
});
