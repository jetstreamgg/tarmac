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
  flowPrepared: true,
  entry: undefined as { confirmDisabled: boolean } | undefined,
  screenContents: [] as unknown[],
  analytics: undefined as unknown,
  toast: undefined as { success: string } | undefined,
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

// Spread over the real module rather than replaced wholesale: the footer's fee
// row pulls NetworkFeeValue/NetworkFeeLabel in, and those reach for several more
// hooks than this panel names itself.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    // The DS Tooltip reads this to suppress itself on touch devices.
    useIsTouchDevice: () => false,
    useNetworkFee: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    useTransactionFlow: (params: { calls: unknown[] }) => {
      h.flowCalls = params.calls;
      return { execute: vi.fn(), prepared: h.flowPrepared };
    },
    // Controlled registry so the reward-contract attribution blob is deterministic.
    useAvailableTokenRewardContracts: () => [
      {
        name: 'With: USDS Get: SKY',
        contractAddress: '0xb',
        supplyToken: { symbol: 'USDS', address: { 1: '0xusds' } },
        rewardToken: { symbol: 'SKY', address: { 1: '0xsky' } }
      }
    ],
    // No WagmiProvider in these renders → the fee row stays a plain value.
    useIsBatchSupported: () => ({
      data: false,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    })
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() }
  })
}));

vi.mock('@/modules/ui/hooks/useModalEntryBody', () => ({
  useModalEntryBody: (params: {
    confirmDisabled: boolean;
    transactionScreenContent?: unknown;
    analytics?: unknown;
    toast?: { success: string };
  }) => {
    h.entry = { confirmDisabled: params.confirmDisabled };
    h.screenContents.push(params.transactionScreenContent);
    h.analytics = params.analytics;
    h.toast = params.toast;
    return (body: unknown) => body;
  }
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { ClaimRewardsPanel } from './ClaimRewardsPanel';
import type { ClaimScope } from '../types';
import { TooltipProvider } from '@/components/ui/tooltip';

const reward = (source: ClaimSource, id: string, symbol: string, amountUsd = 10): ClaimableReward => ({
  id,
  source,
  tokenName: `${symbol} token`,
  tokenSymbol: symbol,
  icon: null,
  formattedAmount: '10.00',
  amount: 10,
  tokenAddress: `0x${symbol.toLowerCase()}` as `0x${string}`,
  amountUsd,
  chainId: 1
});

const renderPanel = (scope: ClaimScope = { kind: 'all' }) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <ClaimRewardsPanel sessionId="s1" scope={scope} />
      </TooltipProvider>
    </I18nProvider>
  );

describe('ClaimRewardsPanel', () => {
  beforeEach(() => {
    h.merkl = [];
    h.sky = [];
    h.stake = [];
    h.flowCalls = [];
    h.flowPrepared = true;
    h.entry = undefined;
    h.screenContents = [];
    h.analytics = undefined;
    h.toast = undefined;
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
    expect(screen.getAllByTestId('claim-reward-row')).toHaveLength(3);
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

  it('claims everything in scope — no per-reward opt-out', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO'), reward('merkl', '0xb', 'SKY')];
    renderPanel({ kind: 'merkl' });

    expect(h.flowCalls).toHaveLength(2);
    // The redesigned modal (Figma 1036:190105) shows amounts only — the scope
    // is the selection, so there is nothing to uncheck.
    expect(screen.queryByTestId('claim-reward-checkbox')).toBeNull();
  });

  it('keeps confirm disabled until the flow itself is prepared', () => {
    // The sequential flow's `execute` silently returns without a simulated
    // request, so an early confirm would walk the modal to the wallet screen
    // having dispatched nothing — clicking a row's Claim and the CTA straight
    // after a page load used to hit exactly that.
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    h.flowPrepared = false;
    renderPanel({ kind: 'merkl-token', tokenAddress: '0xa' });

    expect(h.flowCalls).toHaveLength(1);
    expect(h.entry?.confirmDisabled).toBe(true);
  });

  it('renders a single row for a single-reward scope', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    renderPanel({ kind: 'merkl-token', tokenAddress: '0xa' });

    expect(screen.getAllByTestId('claim-reward-row')).toHaveLength(1);
    expect(screen.getByText(/MORPHO/)).toBeTruthy();
  });

  it('names the amount in the success toast when exactly one reward is in scope', () => {
    h.sky = [reward('sky-rewards', '0xb', 'SPK')];
    renderPanel({ kind: 'reward-contract', address: '0xb' });

    expect(h.toast?.success).toBe('Claimed 10.00 SPK');
  });

  it('keeps the generic success toast for a stacked claim — one headline cannot carry several amounts', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO'), reward('merkl', '0xb', 'SKY')];
    renderPanel({ kind: 'merkl' });

    expect(h.toast?.success).toBe('Rewards claimed');
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
        <TooltipProvider>
          <ClaimRewardsPanel sessionId="s1" scope={{ kind: 'reward-contract', address: '0xb' }} />
        </TooltipProvider>
      </I18nProvider>
    );

    const contents = h.screenContents.filter(content => content !== undefined);
    expect(contents.length).toBeGreaterThanOrEqual(2);
    expect(contents[contents.length - 1]).toBe(contents[0]);
  });
});

describe('ClaimRewardsPanel — analytics attribution by scope (APP-444 B4/B8)', () => {
  beforeEach(() => {
    h.merkl = [];
    h.sky = [];
    h.stake = [];
    h.flowCalls = [];
    h.flowPrepared = true;
    h.entry = undefined;
    h.screenContents = [];
    h.analytics = undefined;
    h.toast = undefined;
    h.restakeSeen = false;
  });
  afterEach(() => cleanup());

  it('reports a reward-contract claim under the legacy rewards widget with the contract blob', () => {
    h.sky = [reward('sky-rewards', '0xb', 'SKY')];
    renderPanel({ kind: 'reward-contract', address: '0xb' });

    expect(h.analytics).toEqual({
      widgetName: 'rewards',
      flow: 'claim',
      action: 'claim',
      data: {
        module: 'rewards',
        product: 'With: USDS Get: SKY',
        productAddress: '0xb',
        assetAddress: '0xusds',
        assetSymbol: 'USDS',
        isBatchTx: false,
        claimedRewards: [{ tokenSymbol: 'SKY', amount: 10, tokenAddress: '0xsky' }]
      }
    });
  });

  it('reports the ecosystem Claim all as claim_all with the slim rewards blob', () => {
    h.sky = [reward('sky-rewards', '0xb', 'SKY'), reward('sky-rewards', '0xd', 'SPK')];
    renderPanel({ kind: 'sky-rewards' });

    expect(h.analytics).toEqual({
      widgetName: 'rewards',
      flow: 'claim',
      action: 'claim_all',
      data: {
        module: 'rewards',
        claimedRewards: [
          { tokenSymbol: 'SKY', amount: 10, tokenAddress: '0xsky' },
          { tokenSymbol: 'SPK', amount: 10, tokenAddress: '0xspk' }
        ]
      }
    });
  });

  it('reports the Merkl scopes under the vaults widget (module morpho)', () => {
    h.merkl = [reward('merkl', '0xa', 'MORPHO')];
    renderPanel({ kind: 'vault', vaultAddress: '0xvault' });

    expect(h.analytics).toEqual({
      widgetName: 'vaults',
      flow: 'claim',
      action: 'claim',
      data: {
        module: 'morpho',
        claimedRewards: [{ tokenSymbol: 'MORPHO', amount: 10, tokenAddress: '0xmorpho' }]
      }
    });
  });

  it('pushes no analytics for the stake scope — StakeClaimModal owns that attribution', () => {
    h.stake = [reward('stake', '0:0xc', 'SKY')];
    renderPanel({ kind: 'stake', index: 0n });
    expect(h.analytics).toBeUndefined();
  });
});
