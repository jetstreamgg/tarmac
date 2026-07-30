import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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
  screenContents: [] as unknown[],
  restakeSeen: false
}));

// Each mocked adapter maps its own rewards to a stand-in Call ({ to: id }), so the
// merged calls the panel forwards to the flow are observable per source.
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

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useTransactionFlow: (params: { calls: unknown[] }) => {
      h.flowCalls = params.calls;
      return { execute: vi.fn(), prepared: true };
    }
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() }
  })
}));

vi.mock('@/modules/ui/hooks/useModalEntryBody', () => ({
  useModalEntryBody: (params: { confirmDisabled: boolean; transactionScreenContent?: unknown }) => {
    h.entry = { confirmDisabled: params.confirmDisabled };
    h.screenContents.push(params.transactionScreenContent);
    return (body: unknown) => body;
  }
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { ClaimRewardsPanel } from './ClaimRewardsPanel';
import type { ClaimScope } from '../types';

const reward = (source: ClaimSource, id: string, symbol: string, amountUsd = 10): ClaimableReward => ({
  id,
  source,
  sourceLabel: source === 'merkl' ? 'Merkl' : source === 'sky-rewards' ? 'Sky Rewards' : 'Staking',
  tokenSymbol: symbol,
  icon: null,
  formattedAmount: '10.00',
  amountUsd,
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
    h.screenContents = [];
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
  });

  it('renders one hero row per reward — amount, USD in parens, token badge (Figma 1036:190108)', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO', 78.9)];
    h.sky = [reward('sky-rewards', '0xb', 'SKY', 200.9)];
    renderPanel();

    const rows = screen.getAllByTestId('claim-reward-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('10.00')).toBeTruthy();
    expect(within(rows[0]).getByText('($78.90)')).toBeTruthy();
    expect(within(rows[0]).getByText('MORPHO')).toBeTruthy();
    expect(within(rows[1]).getByText('($200.90)')).toBeTruthy();
    expect(within(rows[1]).getByText('SKY')).toBeTruthy();
    // The QA-round comps draw no per-token selection or source group headers.
    expect(screen.queryByTestId('claim-reward-checkbox')).toBeNull();
    expect(screen.queryByTestId('claim-group-merkl')).toBeNull();
  });

  it('pairs [Network fee | Network] in the summary grid (Figma 1036:190091)', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    renderPanel({ kind: 'vault', vaultAddress: '0xvault' });

    const fee = screen.getByTestId('claim-modal-row-Network fee');
    expect(within(fee).getByText('–')).toBeTruthy();
    const network = screen.getByTestId('claim-modal-row-Network');
    expect(within(network).getByText('Ethereum')).toBeTruthy();
  });

  it('hides the summary grid with no rewards', () => {
    renderPanel();
    expect(screen.queryByTestId('claim-modal-row-Network')).toBeNull();
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

  it('keeps the wallet-screen summary referentially stable across re-renders (loop guard)', () => {
    // A fresh element per render feeds useModalEntryBody's sync effect a new dep
    // each time, looping updateModalContent → re-render → "Maximum update depth"
    // (crashes the page when the modal opens — the D4 vault-form failure mode).
    h.sky = [reward('sky-rewards', '0xb', 'SKY')];
    const { rerender } = renderPanel({ kind: 'reward-contract', address: '0xb' });
    rerender(
      <I18nProvider i18n={i18n}>
        <ClaimRewardsPanel sessionId="s1" scope={{ kind: 'reward-contract', address: '0xb' }} />
      </I18nProvider>
    );

    const contents = h.screenContents.filter(content => content !== undefined);
    expect(contents.length).toBeGreaterThanOrEqual(2);
    expect(contents[contents.length - 1]).toBe(contents[0]);
  });
});
