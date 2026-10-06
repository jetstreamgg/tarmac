import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

i18n.load('en', {});
i18n.activate('en');

const WAD = 10n ** 18n;
const URN_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const CURRENT_DELEGATE = '0x3333333333333333333333333333333333333333' as const;
const OTHER_DELEGATE = '0x4444444444444444444444444444444444444444' as const;

const h = vi.hoisted(() => ({
  launchMock: vi.fn(),
  updateMock: vi.fn(),
  executeMock: vi.fn(),
  isModalOpen: false,
  txStatus: 'idle',
  launchParams: undefined as Record<string, unknown> | undefined,
  prepared: true,
  launchLoading: false,
  launchError: null as Error | null,
  voteDelegate: undefined as `0x${string}` | undefined,
  rewardContract: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc' as `0x${string}`,
  rewardDeprecated: false,
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
  useIsBatchSupported: () => ({
    data: false,
    isLoading: false,
    error: null,
    mutate: () => {},
    dataSources: []
  })
}));

vi.mock('@/hooks/shared/useNetworkFee', () => ({
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

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUserDelegates: () => ({
      data: [
        { id: CURRENT_DELEGATE, ownerAddress: CURRENT_DELEGATE, totalDelegated: 5000n * WAD, metadata: null },
        { id: OTHER_DELEGATE, ownerAddress: OTHER_DELEGATE, totalDelegated: 1000n * WAD, metadata: null }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useStakeRewardContracts: () => ({
      data: [
        { contractAddress: actual.lsSkySpkRewardAddress[1] },
        { contractAddress: actual.lsSkyUsdsRewardAddress[1] },
        { contractAddress: actual.lsSkySkyRewardAddress[1] }
      ],
      isLoading: false,
      error: null,
      mutate: () => undefined
    }),
    useRewardContractTokens: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useMultipleRewardsChartInfo: () => ({ data: [[]], isLoading: false, error: null })
  };
});

vi.mock('../hooks/useStakePositionDetail', () => ({
  useStakePositionDetail: () => ({
    urnAddress: URN_ADDRESS,
    vault: {
      collateralType: 'LSEV2-SKY-A',
      collateralAmount: 100n * WAD,
      debtValue: 0n,
      dust: 0n,
      riskLevel: 'LOW',
      liquidationProximityPercentage: 0,
      liquidationPrice: 0n,
      delayedPrice: 0n
    },
    vaultLoading: false,
    hasDebt: false,
    rewardContract: h.rewardContract,
    rewardDeprecated: h.rewardDeprecated,
    rewardSymbol: 'SKY',
    voteDelegate: h.voteDelegate,
    stabilityFee: 0.0851,
    skyPriceUsd: 0.05
  })
}));

vi.mock('../hooks/useStakeManageLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeManageLaunch')>();
  return {
    ...actual,
    useStakeManageLaunch: (params: Record<string, unknown>) => {
      h.launchParams = params;
      return {
        launch: vi.fn(),
        execute: h.executeMock,
        steps: [{ label: 'Change' }],
        calldata: [],
        calls: [],
        isBatch: false,
        legCount: 1,
        prepared: h.prepared,
        isLoading: h.launchLoading,
        error: h.launchError,
        usdValue: 5
      };
    }
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launchMock,
    updateModalContent: h.updateMock,
    isModalOpen: h.isModalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: h.txStatus
  }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => null }));

import { lsSkySkyRewardAddress, lsSkySpkRewardAddress, lsSkyUsdsRewardAddress } from '@/hooks';
import { StakeChangeRewardModal, StakeChangeDelegateModal } from './StakeChangeSelectionModal';
import { TooltipProvider } from '@/components/ui/tooltip';

type Kind = 'reward' | 'delegate';

function renderLauncher(kind: Kind) {
  const onClose = vi.fn();
  const Modal = kind === 'reward' ? StakeChangeRewardModal : StakeChangeDelegateModal;
  const view = render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <Modal urnIndex={1} onClose={onClose} />
      </TooltipProvider>
    </I18nProvider>
  );
  return { onClose, view };
}

const launchConfig = () => h.launchMock.mock.calls[0][0];

function renderPanel(kind: Kind) {
  renderLauncher(kind);
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>{launchConfig().backgroundContent as ReactNode}</TooltipProvider>
    </I18nProvider>
  );
}

const lastUpdate = () => h.updateMock.mock.calls.at(-1)![1];
const pressed = (testId: string) => screen.getByTestId(testId).getAttribute('aria-pressed');

describe('StakeChangeSelectionModal', () => {
  beforeEach(() => {
    h.isModalOpen = false;
    h.txStatus = 'idle';
    h.prepared = true;
    h.launchLoading = false;
    h.launchError = null;
    h.voteDelegate = CURRENT_DELEGATE;
    h.rewardContract = lsSkySkyRewardAddress[1];
    h.rewardDeprecated = false;
    h.launchMock.mockClear();
    h.updateMock.mockClear();
    h.executeMock.mockClear();
    h.launchParams = undefined;
    h.invalidateMock.mockClear();
    h.setSearchParamsMock.mockClear();
  });
  afterEach(cleanup);

  it('launches the Change reward token modal at mount (Figma 3015:61490)', () => {
    renderLauncher('reward');

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config = launchConfig();
    expect(config.title).toBe('Change reward token');
    expect(config.transactionTitle).toBe('Confirm reward change');
    expect(config.entry).toEqual({ confirmLabel: 'Change', confirmDisabled: true });
    // Replaces the details modal in the same commit: no scrim fade-in.
    expect(config.scrimHandoff).toBe(true);
    expect(config.toast).toEqual({
      loading: 'Changing position',
      success: 'Your position is updated!',
      error: 'Failed to change the position'
    });
    expect(config.analytics).toMatchObject({ widgetName: 'stake', flow: 'manage', action: 'multicall' });
  });

  it('launches the Change delegate modal at mount (Figma 3015:61189)', () => {
    renderLauncher('delegate');
    expect(launchConfig().title).toBe('Change delegate');
    expect(launchConfig().transactionTitle).toBe('Confirm delegate change');
  });

  it('reward: the current farm is pre-selected and Change stays disabled until another tile is picked', () => {
    renderPanel('reward');

    // Single column; the deprecated SPK farm is hidden when it is not the urn's.
    expect(screen.getByTestId('stake-manage-reward-list').className).not.toContain('md:grid-cols-2');
    expect(screen.queryByTestId(`stake-manage-reward-${lsSkySpkRewardAddress[1].toLowerCase()}`)).toBeNull();
    expect(pressed(`stake-manage-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`)).toBe('true');
    expect(lastUpdate().entry).toMatchObject({ confirmLabel: 'Change', confirmDisabled: true });
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
    expect(h.launchParams?.enabled).toBe(false);
    // The picker is the review: the grid only backs the wallet screen.
    expect(h.launchParams?.transactionContentAsScreen).toBe(true);

    fireEvent.click(screen.getByTestId(`stake-manage-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`));
    expect(pressed(`stake-manage-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`)).toBe('true');
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkyUsdsRewardAddress[1]);
    expect(h.launchParams?.enabled).toBe(true);
    expect(lastUpdate().entry).toMatchObject({ confirmDisabled: false });

    // Back on the urn's own farm: no change staged.
    fireEvent.click(screen.getByTestId(`stake-manage-reward-${lsSkySkyRewardAddress[1].toLowerCase()}`));
    expect(h.launchParams?.enabled).toBe(false);
    expect(lastUpdate().entry).toMatchObject({ confirmDisabled: true });
  });

  it('reward: a deprecated current farm stays listed with its chip and warning', () => {
    h.rewardContract = lsSkySpkRewardAddress[1];
    h.rewardDeprecated = true;
    renderPanel('reward');

    const spk = screen.getByTestId(`stake-manage-reward-${lsSkySpkRewardAddress[1].toLowerCase()}`);
    expect(spk.getAttribute('aria-pressed')).toBe('true');
    expect(spk.textContent).toContain('Deprecated');
    expect(screen.getByTestId('stake-manage-reward-deprecated-warning')).toBeTruthy();
  });

  it('delegate: picking another delegate enables Change; clicking it again deselects', () => {
    renderPanel('delegate');

    expect(pressed(`stake-manage-delegate-${CURRENT_DELEGATE.toLowerCase()}`)).toBe('true');
    expect(lastUpdate().entry).toMatchObject({ confirmDisabled: true });

    fireEvent.click(screen.getByTestId(`stake-manage-delegate-${OTHER_DELEGATE.toLowerCase()}`));
    expect(h.launchParams?.selectedDelegate).toBe(OTHER_DELEGATE);
    expect(h.launchParams?.selectedRewardContract).toBe(lsSkySkyRewardAddress[1]);
    expect(lastUpdate().entry).toMatchObject({ confirmDisabled: false });

    fireEvent.click(screen.getByTestId(`stake-manage-delegate-${OTHER_DELEGATE.toLowerCase()}`));
    expect(h.launchParams?.selectedDelegate).toBe(CURRENT_DELEGATE);
    expect(lastUpdate().entry).toMatchObject({ confirmDisabled: true });
  });

  it('Change pushes the steps and runs the engine', () => {
    renderPanel('delegate');
    fireEvent.click(screen.getByTestId(`stake-manage-delegate-${OTHER_DELEGATE.toLowerCase()}`));

    (lastUpdate().onConfirm as () => void)();
    expect(h.executeMock).toHaveBeenCalledTimes(1);
    const pushed = h.updateMock.mock.calls.at(-1)![1];
    expect(pushed.steps).toEqual([{ label: 'Change' }]);
    expect(pushed.analytics).toMatchObject({
      action: 'multicall',
      data: { change: 'delegate', urnIndex: 1 }
    });
  });

  it('surfaces the engine prepare error under the CTA once a change is staged', () => {
    h.launchError = new Error('simulation reverted');
    h.prepared = false;
    renderPanel('reward');
    fireEvent.click(screen.getByTestId(`stake-manage-reward-${lsSkyUsdsRewardAddress[1].toLowerCase()}`));

    expect(lastUpdate().entry.confirmDisabled).toBe(true);
    expect(lastUpdate().entry.errorMessage).toBeTruthy();
  });

  it('freezes the entry once the transaction leaves IDLE', () => {
    h.txStatus = 'loading';
    renderPanel('reward');
    expect(h.updateMock).not.toHaveBeenCalled();
  });

  it('× returns to the details modal; success routes to the positions tab instead', () => {
    h.isModalOpen = true;
    const { onClose, view } = renderLauncher('reward');
    h.isModalOpen = false;
    view.rerender(
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <StakeChangeRewardModal urnIndex={1} onClose={onClose} />
        </TooltipProvider>
      </I18nProvider>
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanup();
    h.launchMock.mockClear();
    h.isModalOpen = true;
    const second = renderLauncher('reward');
    (launchConfig().onSuccess as () => void)();
    expect(h.invalidateMock).toHaveBeenCalled();
    const next = h.setSearchParamsMock.mock.calls[0][0](new URLSearchParams('flow=manage&urn_index=1'));
    expect(next.get('flow')).toBeNull();
    expect(next.get('urn_index')).toBeNull();
    expect(next.get('tab')).toBe('positions');
    h.isModalOpen = false;
    second.view.rerender(
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <StakeChangeRewardModal urnIndex={1} onClose={second.onClose} />
        </TooltipProvider>
      </I18nProvider>
    );
    expect(second.onClose).not.toHaveBeenCalled();
  });
});
