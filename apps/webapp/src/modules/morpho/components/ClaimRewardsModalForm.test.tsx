import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

type Reward = {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenPrice: number;
  totalAmount: bigint;
  claimed: bigint;
  formattedTotalAmount: string;
  totalAmountUsd: number;
  sources: unknown[];
  proofs: string[];
  root: string;
  distributionChainId: number;
};

const reward = (tokenAddress: string, tokenSymbol: string): Reward => ({
  tokenAddress,
  tokenSymbol,
  tokenDecimals: 18,
  tokenPrice: 1,
  totalAmount: 100n,
  claimed: 0n,
  formattedTotalAmount: '22.90',
  totalAmountUsd: 15.78,
  sources: [],
  proofs: ['0x1'],
  root: '0x',
  distributionChainId: 1
});

const h = vi.hoisted(() => ({
  rewards: [] as Reward[],
  claimArgs: undefined as { rewards: Reward[] } | undefined,
  updateModalContent: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChains: () => [{ id: 1, name: 'Ethereum' }] };
});

vi.mock('@/hooks', () => ({
  useMerklRewards: () => ({
    data: { rewards: h.rewards, hasClaimableRewards: h.rewards.length > 0 },
    isLoading: false
  }),
  useMerklClaimRewards: (args: { rewards: Reward[] }) => {
    h.claimArgs = args;
    return { execute: vi.fn(), prepared: true };
  }
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    updateModalContent: h.updateModalContent,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() }
  }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { ClaimRewardsModalForm } from './ClaimRewardsModalForm';

const renderForm = () =>
  render(
    <I18nProvider i18n={i18n}>
      <ClaimRewardsModalForm sessionId="s1" />
    </I18nProvider>
  );

describe('ClaimRewardsModalForm', () => {
  beforeEach(() => {
    h.rewards = [];
    h.claimArgs = undefined;
    h.updateModalContent.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the single-token layout (no checkbox) and claims that token', () => {
    h.rewards = [reward('0xaaa', 'MORPHO')];
    renderForm();

    expect(screen.getByTestId('claim-rewards-form')).toBeTruthy();
    expect(screen.queryByTestId('claim-reward-checkbox')).toBeNull();
    expect(screen.getByText('22.90 MORPHO')).toBeTruthy();
    expect(h.claimArgs?.rewards).toHaveLength(1);
  });

  it('defaults to all tokens selected in the multi-token layout', () => {
    h.rewards = [reward('0xaaa', 'MORPHO'), reward('0xbbb', 'SKY')];
    renderForm();

    expect(screen.getAllByTestId('claim-reward-checkbox')).toHaveLength(2);
    // Both selected by default → the claim hook receives the full set.
    expect(h.claimArgs?.rewards).toHaveLength(2);
  });

  it('claims only the selected subset when a token is de-selected', () => {
    h.rewards = [reward('0xaaa', 'MORPHO'), reward('0xbbb', 'SKY')];
    renderForm();

    fireEvent.click(screen.getAllByTestId('claim-reward-checkbox')[0]);

    // After de-selecting one, the claim hook is called with just the remaining token.
    expect(h.claimArgs?.rewards).toHaveLength(1);
    expect(h.claimArgs?.rewards[0].tokenSymbol).toBe('SKY');
    // Gating is pushed to the shared modal as selection changes.
    expect(h.updateModalContent).toHaveBeenCalled();
  });
});
