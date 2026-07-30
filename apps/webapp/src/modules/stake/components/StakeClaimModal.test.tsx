import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ClaimableReward } from '@/modules/claim/types';

i18n.load('en', {});
i18n.activate('en');

const SKY_FARM = '0xb44c2fb4181d7cb06bdff34a46fdfe4a259b40fc' as const;
const SPK_FARM = '0x99cbc0e4e8427f53999b9e4a5d9b7ba6d8b4bb5b' as const;

const h = vi.hoisted(() => ({
  rewards: [] as unknown[],
  rewardsLoading: false,
  launchMock: vi.fn(),
  updateMock: vi.fn(),
  isModalOpen: false,
  txStatus: 'idle',
  confirmMock: vi.fn(),
  retryMock: vi.fn(),
  launchParams: undefined as Record<string, unknown> | undefined,
  plainPrepared: true,
  restakePrepared: true,
  invalidateMock: vi.fn(),
  setSearchParamsMock: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({ address: '0x1', isConnected: true })
  };
});

vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  // The bundling badge asks whether the wallet can batch; these renders have no
  // WagmiProvider, so answer "no" and the fee row stays a plain value.
  useIsBatchSupported: () => ({
    data: false,
    isLoading: false,
    error: null,
    mutate: () => {},
    dataSources: []
  })
}));

vi.mock('@/hooks/shared/useNetworkFee', () => ({
  // The fee row is read-only and network-backed; these tests render without a
  // WagmiProvider, so stub it to the un-resolved state the row falls back on.
  useNetworkFee: () => ({ data: undefined, isLoading: false, error: null, mutate: () => {}, dataSources: [] })
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: h.invalidateMock })
  };
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [new URLSearchParams(), h.setSearchParamsMock]
  };
});

vi.mock('@/modules/claim/adapters/stakeAdapter', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/claim/adapters/stakeAdapter')>();
  return {
    ...actual,
    stakeAdapter: {
      ...actual.stakeAdapter,
      useClaimable: () => ({ rewards: h.rewards, isLoading: h.rewardsLoading })
    }
  };
});

vi.mock('../hooks/useStakeClaimLaunch', () => ({
  useStakeClaimLaunch: (params: { selected: ClaimableReward[] }) => {
    h.launchParams = params as unknown as Record<string, unknown>;
    return {
      confirm: h.confirmMock,
      retry: h.retryMock,
      restakeAvailable: params.selected.some(reward => reward.tokenSymbol.toUpperCase() === 'SKY'),
      plainPrepared: h.plainPrepared,
      plainLoading: false,
      restakePrepared: h.restakePrepared,
      restakeLoading: false,
      calldata: [],
      calls: [],
      isBatch: false
    };
  }
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launchMock,
    updateModalContent: h.updateMock,
    isModalOpen: h.isModalOpen,
    txCallbacks: {
      onMutate: vi.fn(),
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn()
    },
    txStatus: h.txStatus
  }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakeClaimModal } from './StakeClaimModal';
import { TooltipProvider } from '@/components/ui/tooltip';

const reward = (contract: string, symbol: string, formattedAmount: string, amountUsd: number) => ({
  id: `1:${contract}`,
  source: 'stake' as const,
  sourceLabel: 'Staking',
  tokenSymbol: symbol,
  icon: null,
  formattedAmount,
  amountUsd,
  chainId: 1
});

function renderLauncher() {
  const onClose = vi.fn();
  const view = render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <StakeClaimModal urnIndex={1} onClose={onClose} />
      </TooltipProvider>
    </I18nProvider>
  );
  return { onClose, view };
}

const launchConfig = () => h.launchMock.mock.calls[0][0];

/**
 * The panel body lives in the launch config's backgroundContent — render it to test.
 * TooltipProvider because the grid's fee cell carries the estimate's info tooltip
 * (the app mounts one at the root, `pages/App.tsx`).
 */
function renderPanel() {
  renderLauncher();
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>{launchConfig().backgroundContent as ReactNode}</TooltipProvider>
    </I18nProvider>
  );
}

/** The last live-update partial the panel pushed. */
const lastUpdate = () => h.updateMock.mock.calls.at(-1)![1];

describe('StakeClaimModal', () => {
  beforeEach(() => {
    h.rewards = [
      // Adapter order is farm order — the modal must render SKY first regardless.
      reward(SPK_FARM, 'SPK', '17.66', 12.01),
      reward(SKY_FARM, 'SKY', '22.90', 15.78)
    ];
    h.rewardsLoading = false;
    h.isModalOpen = false;
    h.txStatus = 'idle';
    h.plainPrepared = true;
    h.restakePrepared = true;
    h.launchMock.mockClear();
    h.updateMock.mockClear();
    h.confirmMock.mockClear();
    h.retryMock.mockClear();
    h.launchParams = undefined;
    h.invalidateMock.mockClear();
    h.setSearchParamsMock.mockClear();
  });
  afterEach(cleanup);

  it('launches the shared modal at mount with the claim config (Figma 1036:213978 / 1036:214007)', () => {
    renderLauncher();

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = launchConfig();
    expect(config.title).toBe('Claim rewards');
    expect(config.transactionTitle).toBe('Confirm claim');
    expect(config.subtitles.loading).toBe('Your claim is being processed on the blockchain. Please wait.');
    expect(config.subtitles.success).toBe('You’ve claimed your rewards');
    expect(config.toast).toEqual({
      loading: 'Claiming rewards',
      success: 'Claim successful',
      error: 'Claim failed'
    });
    expect(config.entry).toEqual({ confirmLabel: 'Claim', confirmDisabled: true });
    expect(config.backgroundContent).toBeTruthy();
    expect(config.analytics).toMatchObject({ widgetName: 'stake', flow: 'manage' });
  });

  it('renders a hero row per reward, SKY first, over [Network fee | Network] (Figma 1036:213978)', () => {
    renderPanel();

    const rows = screen.getAllByTestId(/^stake-claim-reward-/);
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'stake-claim-reward-sky',
      'stake-claim-reward-spk'
    ]);
    expect(screen.getByTestId('stake-claim-reward-sky').textContent).toContain('22.90');
    expect(screen.getByTestId('stake-claim-reward-sky').textContent).toContain('$15.78');
    expect(screen.getByTestId('stake-claim-row-Network').textContent).toContain('Ethereum');
    expect(screen.getByTestId('stake-claim-row-Network fee').textContent).toContain('–');
    // The urn's full claimable set is claimed — no per-token selection.
    expect((h.launchParams?.selected as ClaimableReward[]).map(r => r.tokenSymbol)).toEqual(['SKY', 'SPK']);
  });

  it('pushes the two-CTA entry while SKY is claimable: primary restake, secondary plain claim', () => {
    renderPanel();

    const update = lastUpdate();
    expect(update.entry).toMatchObject({
      confirmLabel: 'Claim & Restake SKY',
      confirmDisabled: false,
      secondaryConfirmLabel: 'Claim',
      secondaryConfirmDisabled: false
    });

    update.onConfirm();
    expect(h.confirmMock).toHaveBeenLastCalledWith(true);
    update.onSecondaryConfirm();
    expect(h.confirmMock).toHaveBeenLastCalledWith(false);
    update.onRetry();
    expect(h.retryMock).toHaveBeenCalled();
  });

  it('collapses to a single primary Claim when SKY is not claimable', () => {
    h.rewards = [reward(SPK_FARM, 'SPK', '17.66', 12.01)];
    renderPanel();

    const update = lastUpdate();
    expect(update.entry).toMatchObject({ confirmLabel: 'Claim', confirmDisabled: false });
    expect(update.entry.secondaryConfirmLabel).toBeUndefined();
    expect(update.onSecondaryConfirm).toBeUndefined();

    update.onConfirm();
    expect(h.confirmMock).toHaveBeenLastCalledWith(false);
  });

  it('pushes the relabelled hero summary for the wallet screen (Figma 1036:214012)', () => {
    renderPanel();

    const summary = render(
      <I18nProvider i18n={i18n}>{lastUpdate().transactionScreenContent as ReactNode}</I18nProvider>
    );
    const heroes = summary.getAllByTestId(/^stake-claim-summary-/);
    expect(heroes.map(el => el.getAttribute('data-testid'))).toEqual([
      'stake-claim-summary-sky',
      'stake-claim-summary-spk'
    ]);
    expect(summary.getAllByText('Claim amount')).toHaveLength(2);
  });

  it('freezes the live pushes once the transaction leaves the entry screen', () => {
    // Post-claim, the refetch empties `rewards`; pushing that state would blank
    // the executed heroes on the wallet/status screens.
    h.txStatus = 'success';
    h.rewards = [];
    renderPanel();

    expect(h.updateMock).not.toHaveBeenCalled();
  });

  it('shows the empty message and disables the CTA when nothing is claimable', () => {
    h.rewards = [];
    renderPanel();

    expect(screen.getByText('There are currently no claimable rewards.')).toBeTruthy();
    expect(lastUpdate().entry.confirmDisabled).toBe(true);
  });

  it('calls onClose when the shared modal closes (C11)', () => {
    h.isModalOpen = true;
    const { onClose, view } = renderLauncher();
    expect(onClose).not.toHaveBeenCalled();

    h.isModalOpen = false;
    // Same tree shape as the initial render — dropping the provider here would
    // remount the launcher and reset the "was open" ref this asserts on.
    view.rerender(
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <StakeClaimModal urnIndex={1} onClose={onClose} />
        </TooltipProvider>
      </I18nProvider>
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('refreshes positions and returns to the positions tab after a claim succeeds (C20)', () => {
    renderLauncher();

    launchConfig().onSuccess();

    const invalidated = h.invalidateMock.mock.calls.map(call => call[0].queryKey[0]);
    expect(invalidated).toEqual(
      expect.arrayContaining([
        'stake-user-positions',
        'stake-history',
        'readContract',
        'readContracts',
        'simulateDrip'
      ])
    );

    const updater = h.setSearchParamsMock.mock.calls[0][0];
    const params = updater(new URLSearchParams('flow=manage&urn_index=1&stake_tab=lock'));
    expect(params.get('flow')).toBeNull();
    expect(params.get('urn_index')).toBeNull();
    expect(params.get('stake_tab')).toBeNull();
    expect(params.get('tab')).toBe('positions');
  });
});
