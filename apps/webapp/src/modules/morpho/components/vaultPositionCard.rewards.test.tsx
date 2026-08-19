import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const USER = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
// A real registry vault: useMerklRewards only keeps tokens whose breakdown
// reason names a known Morpho vault, so a placeholder address wouldn't parse.
const VAULT = '0xE15fcC81118895b67b6647BBd393182dF44E11E0' as const;
const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F' as const;

/**
 * The campaign accrued 0.04 USDS lifetime and 0.02 of it has already been
 * claimed, so 0.02 is what another `claim` would pay out. This is the shape
 * that produced APP-442: the card read the 0.04 while the claim modal quoted
 * the 0.02 the distributor actually sends.
 */
const GROSS = '40000000000000000';
const CLAIMED = '20000000000000000';

// Unresolved vault read (data undefined) holds the card slot: skeleton while in
// flight, error card if the read failed.
const h = vi.hoisted(() => ({
  vaultUnresolved: false,
  vaultError: null as Error | null
}));

const merklPayload = (claimed = CLAIMED) => [
  {
    chain: { id: 1, name: 'Ethereum', icon: '', endOfDisputePeriod: 0, liveCampaigns: 1 },
    rewards: [
      {
        root: '0xroot',
        distributionChainId: 1,
        recipient: USER,
        amount: GROSS,
        claimed,
        pending: '0',
        proofs: ['0xproof'],
        token: { address: USDS, chainId: 1, symbol: 'USDS', decimals: 18, price: 1 },
        breakdowns: [
          {
            root: '0xroot',
            distributionChainId: 1,
            reason: `MorphoSupply_${VAULT}`,
            amount: GROSS,
            claimed,
            pending: '0',
            campaignId: '0xcampaign',
            subCampaignId: ''
          }
        ]
      }
    ]
  }
];

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: USER, isConnected: true, isConnecting: false }),
    // The claim adapter's recently-claimed filter; an empty result leaves the
    // reward in place.
    useReadContracts: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getTokenDecimals: () => 18,
    // 8.24 USDS supplied — enough of a position to render the "My position" card.
    useErc4626VaultData: () => ({
      data: h.vaultUnresolved ? undefined : { userAssets: 8_240_000_000_000_000_000n },
      error: h.vaultError,
      mutate: () => {}
    }),
    useVaultMarketData: () => ({ data: { rate: { netRate: 0.05 } } })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('../hooks/useVaultModal', () => ({
  useVaultModal: () => ({ openSupply: () => {}, openWithdraw: () => {} })
}));
vi.mock('@/modules/claim', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/claim')>();
  return { ...actual, useClaimRewardsModal: () => ({ openClaim: () => {} }) };
});

import { merklAdapter } from '@/modules/claim';
import { VaultPositionCard } from './VaultPositionCard';

const usds = { symbol: 'USDS', name: 'USDS', address: { 1: USDS } } as unknown as Token;

const renderCard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <VaultPositionCard
          vaultAddress={VAULT}
          assetToken={usds}
          vaultName="USDS Flagship"
          provider="morpho"
        />
      </I18nProvider>
    </QueryClientProvider>
  );

  /**
   * Resolves once the Merkl read has actually landed. Asserting the ABSENCE of
   * a claim button is otherwise indistinguishable from asserting it before the
   * fetch resolved, which would pass against the bug as happily as against the
   * fix.
   */
  const settled = () =>
    vi.waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some(q => String(q.queryKey[0]).includes('reward') && q.state.status === 'success')
      ).toBe(true)
    );

  return { settled };
};

const stubMerkl = (claimed?: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(merklPayload(claimed)), { status: 200 }))
  );

describe('VaultPositionCard held slot (APP-491)', () => {
  beforeEach(() => {
    stubMerkl();
    h.vaultUnresolved = false;
    h.vaultError = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('holds the slot with a skeleton while the position read is in flight', () => {
    h.vaultUnresolved = true;
    renderCard();

    expect(screen.queryByTestId('vault-position-card-skeleton')).not.toBeNull();
    expect(screen.queryByTestId('vault-position-card-error')).toBeNull();
  });

  it('settles a failed position read on the error card, not an endless skeleton', () => {
    h.vaultUnresolved = true;
    h.vaultError = new Error('read failed');
    renderCard();

    expect(screen.queryByTestId('vault-position-card-error')).not.toBeNull();
    expect(screen.queryByTestId('vault-position-card-skeleton')).toBeNull();
  });
});

describe('VaultPositionCard claimable rewards (APP-442)', () => {
  beforeEach(() => {
    stubMerkl();
    h.vaultUnresolved = false;
    h.vaultError = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('shows the unclaimed remainder, not the gross campaign total', async () => {
    renderCard();

    expect(await screen.findByText('0.02')).toBeTruthy();
    expect(screen.queryByText('0.04')).toBeNull();
  });

  it('matches the amount the claim modal quotes for the same vault', async () => {
    renderCard();
    await screen.findByText('0.02');

    // Same source of truth as the modal body: whatever the adapter yields for
    // this vault scope is what the card must be rendering.
    const { result } = await import('@testing-library/react').then(({ renderHook }) =>
      renderHook(() => merklAdapter.useClaimable({ kind: 'vault', vaultAddress: VAULT }), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {children}
          </QueryClientProvider>
        )
      })
    );

    await vi.waitFor(() => expect(result.current.rewards.length).toBe(1));
    expect(screen.getByText(result.current.rewards[0].formattedAmount)).toBeTruthy();
  });

  it('offers Claim rewards while something is unclaimed', async () => {
    renderCard();

    expect(await screen.findByTestId('vault-position-claim')).toBeTruthy();
  });

  it('dashes the stat and drops the Claim button once the campaign is fully claimed', async () => {
    stubMerkl(GROSS);
    const { settled } = renderCard();
    await settled();

    expect(screen.getByTestId('vault-position-withdraw')).toBeTruthy();
    expect(screen.queryByTestId('vault-position-claim')).toBeNull();
    expect(screen.queryByText('0.04')).toBeNull();
  });
});
