import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimableReward, ClaimSource } from '../types';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  merkl: [] as ClaimableReward[],
  sky: [] as ClaimableReward[],
  stake: [] as ClaimableReward[],
  flowCalls: [] as unknown[],
  entry: undefined as { confirmDisabled: boolean } | undefined,
  restakeSeen: false
}));

// Each mocked adapter maps its own selected rewards to a stand-in Call ({ to: id }), so
// de-selection genuinely changes the merged calls the panel forwards to the flow.
vi.mock('../adapters/merklAdapter', () => ({
  merklAdapter: {
    source: 'merkl',
    useClaimable: () => ({ rewards: h.merkl, isLoading: false }),
    useClaimCalls: (selected: ClaimableReward[]) => ({
      calls: selected.filter(r => r.source === 'merkl').map(r => ({ to: r.id })),
      prepared: true
    })
  }
}));
vi.mock('../adapters/skyRewardsAdapter', () => ({
  skyRewardsAdapter: {
    source: 'sky-rewards',
    useClaimable: () => ({ rewards: h.sky, isLoading: false }),
    useClaimCalls: (selected: ClaimableReward[]) => ({
      calls: selected.filter(r => r.source === 'sky-rewards').map(r => ({ to: r.id })),
      prepared: true
    })
  }
}));
vi.mock('../adapters/stakeAdapter', () => ({
  stakeAdapter: {
    source: 'stake',
    useClaimable: () => ({ rewards: h.stake, isLoading: false }),
    useClaimCalls: (selected: ClaimableReward[], options?: { restake?: boolean }) => {
      if (options?.restake) h.restakeSeen = true;
      return {
        calls: selected.filter(r => r.source === 'stake').map(r => ({ to: r.id })),
        prepared: true
      };
    }
  }
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1, useChains: () => [{ id: 1, name: 'Ethereum' }] };
});

vi.mock('@/hooks', () => ({
  useTransactionFlow: (params: { calls: unknown[] }) => {
    h.flowCalls = params.calls;
    return { execute: vi.fn(), prepared: true };
  }
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() }
  })
}));

vi.mock('@/modules/ui/hooks/useModalEntryBody', () => ({
  useModalEntryBody: (params: { confirmDisabled: boolean }) => {
    h.entry = { confirmDisabled: params.confirmDisabled };
    return (body: unknown) => body;
  }
}));

import { ClaimRewardsPanel } from './ClaimRewardsPanel';
import type { ClaimScope } from '../types';

const reward = (source: ClaimSource, id: string, symbol: string): ClaimableReward => ({
  id,
  source,
  sourceLabel: source === 'merkl' ? 'Merkl' : source === 'sky-rewards' ? 'Sky Rewards' : 'Staking',
  tokenSymbol: symbol,
  icon: null,
  formattedAmount: '10.00',
  amountUsd: 10,
  chainId: 1
});

const renderPanel = (scope: ClaimScope = { kind: 'all' }) =>
  render(
    <I18nProvider i18n={i18n}>
      <ClaimRewardsPanel sessionId="s1" scope={scope} />
    </I18nProvider>
  );

describe('ClaimRewardsPanel', () => {
  beforeEach(() => {
    h.merkl = [];
    h.sky = [];
    h.stake = [];
    h.flowCalls = [];
    h.entry = undefined;
    h.restakeSeen = false;
  });
  afterEach(() => cleanup());

  it('shows the empty state with no rewards, and disables confirm', () => {
    renderPanel();
    expect(screen.getByText('There are currently no claimable rewards.')).toBeTruthy();
    expect(h.entry?.confirmDisabled).toBe(true);
  });

  it('merges every source’s calls and forwards them to one flow', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    h.sky = [reward('sky-rewards', '0xb', 'SKY')];
    h.stake = [reward('stake', '0:0xc', 'SPK')];
    renderPanel();

    expect(h.flowCalls).toHaveLength(3);
    expect(h.entry?.confirmDisabled).toBe(false);
    // Multiple sources → group headers rendered.
    expect(screen.getByTestId('claim-group-merkl')).toBeTruthy();
    expect(screen.getByTestId('claim-group-sky-rewards')).toBeTruthy();
  });

  it('drops a de-selected reward from the merged calls', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO'), reward('merkl', '0xb', 'SKY')];
    renderPanel();
    expect(h.flowCalls).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId('claim-reward-checkbox')[0]);
    expect(h.flowCalls).toHaveLength(1);
  });

  it('hides the checkbox and group header for a single reward', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    renderPanel({ kind: 'vault', vaultAddress: '0xvault' });

    expect(screen.queryByTestId('claim-reward-checkbox')).toBeNull();
    expect(screen.queryByTestId('claim-group-merkl')).toBeNull();
    expect(screen.getByText('MORPHO')).toBeTruthy();
  });

  it('offers the restake toggle only in the stake scope with a SKY reward', () => {
    h.stake = [reward('stake', '0:0xc', 'SKY')];
    renderPanel({ kind: 'stake', index: 0n });

    const toggle = screen.getByTestId('claim-restake-toggle');
    expect(toggle).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Restake SKY rewards'));
    expect(h.restakeSeen).toBe(true);
  });

  it('shows no restake toggle without a SKY stake reward', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    renderPanel({ kind: 'vault', vaultAddress: '0xvault' });
    expect(screen.queryByTestId('claim-restake-toggle')).toBeNull();
  });
});
