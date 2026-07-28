import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimableReward } from '@/modules/claim/types';

i18n.load('en', {});
i18n.activate('en');

const SKY_FARM = '0xb44c2fb4181d7cb06bdff34a46fdfe4a259b40fc' as const;
const SPK_FARM = '0x99cbc0e4e8427f53999b9e4a5d9b7ba6d8b4bb5b' as const;

const h = vi.hoisted(() => ({
  rewards: [] as unknown[],
  rewardsLoading: false,
  launchMock: vi.fn(),
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
      launch: h.launchMock,
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

function renderModal() {
  const onClose = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <StakeClaimModal urnIndex={1} onClose={onClose} />
      </TooltipProvider>
    </I18nProvider>
  );
  return { onClose };
}

const selectedSymbols = () => ((h.launchParams?.selected ?? []) as ClaimableReward[]).map(r => r.tokenSymbol);

describe('StakeClaimModal', () => {
  beforeEach(() => {
    h.rewards = [
      // Adapter order is farm order — the modal must render SKY first regardless.
      reward(SPK_FARM, 'SPK', '17.66', 12.01),
      reward(SKY_FARM, 'SKY', '22.90', 15.78)
    ];
    h.rewardsLoading = false;
    h.plainPrepared = true;
    h.restakePrepared = true;
    h.launchMock.mockClear();
    h.launchParams = undefined;
    h.invalidateMock.mockClear();
    h.setSearchParamsMock.mockClear();
  });
  afterEach(cleanup);

  it('renders a checkbox row per reward, SKY first, with Network rows (UX 1050:25394)', () => {
    renderModal();

    const rows = screen.getAllByTestId(/^stake-claim-row-/);
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'stake-claim-row-sky',
      'stake-claim-row-spk'
    ]);
    expect(screen.getByTestId('stake-claim-row-sky').textContent).toContain('22.90');
    expect(screen.getByTestId('stake-claim-network').textContent).toBe('Ethereum');
    expect(screen.getByTestId('stake-claim-fee').textContent).toBe('–');
  });

  it('offers Claim + Claim & Restake SKY while SKY is selected (default: all selected)', () => {
    renderModal();

    expect(screen.getByTestId('stake-claim-confirm').textContent).toBe('Claim');
    expect(screen.getByTestId('stake-claim-restake-confirm').textContent).toBe('Claim & Restake SKY');
    expect(selectedSymbols()).toEqual(['SKY', 'SPK']);
  });

  it('drops to a single Claim button when SKY is deselected (UX 1050:25642)', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('stake-claim-checkbox-sky'));

    expect(selectedSymbols()).toEqual(['SPK']);
    expect(screen.queryByTestId('stake-claim-restake-confirm')).toBeNull();
    expect((screen.getByTestId('stake-claim-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the single-reward hero without checkboxes (UX 1050:23669)', () => {
    h.rewards = [reward(SKY_FARM, 'SKY', '22.90', 15.78)];
    renderModal();

    expect(screen.getByTestId('stake-claim-single').textContent).toContain('22.90 SKY');
    expect(screen.queryAllByTestId(/^stake-claim-checkbox-/)).toHaveLength(0);
    expect(screen.getByTestId('stake-claim-restake-confirm')).toBeTruthy();
  });

  it('launches the plain claim and the restake variants per button', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('stake-claim-confirm'));
    expect(h.launchMock).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByTestId('stake-claim-restake-confirm'));
    expect(h.launchMock).toHaveBeenLastCalledWith(true);
  });

  it('disables Claim when everything is deselected', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('stake-claim-checkbox-sky'));
    fireEvent.click(screen.getByTestId('stake-claim-checkbox-spk'));

    expect((screen.getByTestId('stake-claim-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the empty message when nothing is claimable', () => {
    h.rewards = [];
    renderModal();

    expect(screen.getByText('There are currently no claimable rewards.')).toBeTruthy();
    expect((screen.getByTestId('stake-claim-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes back to the details modal via the X (C11)', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByTestId('stake-claim-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('refreshes positions and returns to the positions tab after a claim succeeds (C20)', () => {
    renderModal();

    const onSuccess = (h.launchParams as { onSuccess?: () => void } | undefined)?.onSuccess;
    expect(onSuccess).toBeTypeOf('function');
    onSuccess!();

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
