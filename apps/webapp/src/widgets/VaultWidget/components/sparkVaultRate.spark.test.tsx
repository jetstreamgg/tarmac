/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

// `SparkVaultRate` renders whatever the single resolved source (`useSparkVaultResolvedRate`)
// returns — the Spark Savings API `apy` when present, else the on-chain `vsr`. Drive that hook
// from the test so we assert the *observable* rate the header/card shows. The API-vs-on-chain
// preference itself is unit-tested purely in `lib/vaults/sparkVaultRate.test.ts`.
//
// NB: we intentionally render WITHOUT `WagmiWrapper`. Because the hook is mocked, the component
// needs no wallet/query providers — and importing `WagmiWrapper` would pull this component's
// module into `importActual('@/hooks')`'s real-graph evaluation, yielding a second (un-mocked)
// `@/hooks` instance the component would bind to, so the mock would silently not apply.
let mockResolvedRate: { formattedRate?: string; isLoading: boolean } = {
  formattedRate: undefined,
  isLoading: false
};

vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useSparkVaultResolvedRate: () => mockResolvedRate
  };
});

import { SparkVaultRate } from './SparkVaultRate';

describe('SparkVaultRate (single resolved rate source)', () => {
  it('renders the resolved API rate when present', () => {
    mockResolvedRate = { formattedRate: '3.65%', isLoading: false };
    render(<SparkVaultRate vaultAddress={VAULT} />);
    expect(screen.getByText('3.65%')).toBeTruthy();
  });

  it('renders a genuinely-zero rate as 0% (distinct from missing data)', () => {
    mockResolvedRate = { formattedRate: '0.00%', isLoading: false };
    render(<SparkVaultRate vaultAddress={VAULT} />);
    expect(screen.getByText('0.00%')).toBeTruthy();
  });

  it('shows a placeholder (no rate text) while the rate is still loading', () => {
    mockResolvedRate = { formattedRate: undefined, isLoading: true };
    const { container } = render(<SparkVaultRate vaultAddress={VAULT} />);
    // No rate text yet, but the skeleton is rendered — not an empty/null return.
    expect(screen.queryByText(/%/)).toBeNull();
    expect(container.firstChild).not.toBeNull();
  });

  it('renders nothing when neither source has a rate (clean empty state)', () => {
    mockResolvedRate = { formattedRate: undefined, isLoading: false };
    const { container } = render(<SparkVaultRate vaultAddress={VAULT} />);
    expect(container.firstChild).toBeNull();
  });
});
