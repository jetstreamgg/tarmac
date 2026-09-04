import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';
import type { StakeUrnBark, StakeUserPosition } from '../hooks/useStakeUserPositions';

const h = vi.hoisted(() => ({
  modalProps: undefined as Record<string, unknown> | undefined,
  sheetProps: undefined as Record<string, unknown> | undefined,
  claimProps: undefined as Record<string, unknown> | undefined,
  reopenProps: undefined as Record<string, unknown> | undefined,
  postMortemProps: undefined as Record<string, unknown> | undefined,
  positions: undefined as unknown[] | undefined
}));

let mockSearchParams = new URLSearchParams();
const setSearchParamsMock = vi.fn<SetSearchParams>(next => {
  mockSearchParams =
    typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

vi.mock('../hooks/useStakeUserPositions', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeUserPositions')>();
  return {
    ...actual,
    useStakeUserPositions: () => ({ data: h.positions, isLoading: false, error: null, mutate: vi.fn() })
  };
});

vi.mock('./PositionDetailsModal', () => ({
  PositionDetailsModal: (props: Record<string, unknown>) => {
    h.modalProps = props;
    return <div data-testid="details-modal-stub" />;
  }
}));

vi.mock('./LiquidationPostMortemModal', () => ({
  LiquidationPostMortemModal: (props: Record<string, unknown>) => {
    h.postMortemProps = props;
    return <div data-testid="post-mortem-modal-stub" />;
  }
}));

vi.mock('./ManagePositionTakeover', () => ({
  ManagePositionTakeover: (props: Record<string, unknown>) => {
    h.sheetProps = props;
    return <div data-testid="manage-sheet-stub" />;
  }
}));

vi.mock('./StakeClaimModal', () => ({
  StakeClaimModal: (props: Record<string, unknown>) => {
    h.claimProps = props;
    return <div data-testid="claim-modal-stub" />;
  }
}));

vi.mock('./OpenPositionTakeover', () => ({
  OpenPositionTakeover: (props: Record<string, unknown>) => {
    h.reopenProps = props.reopen as Record<string, unknown>;
    return <div data-testid="reopen-takeover-stub" />;
  }
}));

import { PositionManageFlow, manageActionInit, stakeTabInit } from './PositionManageFlow';

describe('manageActionInit', () => {
  it('maps menu actions to card pre-toggles (UX B.3)', () => {
    expect(manageActionInit('stake')).toEqual({ stakeCard: 'stake' });
    expect(manageActionInit('withdraw')).toEqual({ stakeCard: 'withdraw' });
    expect(manageActionInit('borrow')).toEqual({ borrowCard: 'borrow' });
    expect(manageActionInit('repay')).toEqual({ borrowCard: 'repay' });
    expect(manageActionInit('reward')).toEqual({ rewardCard: true });
    expect(manageActionInit('delegate')).toEqual({ delegateCard: true });
  });
});

describe('stakeTabInit', () => {
  it('honors the legacy lock/free deep-link values (M2)', () => {
    expect(stakeTabInit('lock')).toEqual({ stakeCard: 'stake', borrowCard: 'borrow' });
    expect(stakeTabInit('free')).toEqual({ stakeCard: 'withdraw', borrowCard: 'repay' });
    expect(stakeTabInit('anything')).toBeNull();
    expect(stakeTabInit(null)).toBeNull();
  });
});

function makeBark(overrides: Partial<StakeUrnBark> = {}): StakeUrnBark {
  return {
    id: '1-ilk-1',
    ilk: '0x4c534556322d534b592d41',
    clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
    clipperId: '1',
    ink: 1n,
    art: 1n,
    due: 1n,
    blockTimestamp: 1_700_000_000,
    transactionHash: '0xf90d3823abc',
    ...overrides
  };
}

function makePosition(overrides: Partial<StakeUserPosition> = {}): StakeUserPosition {
  return {
    index: 2,
    skyLocked: 0n,
    usdsDebt: 0n,
    barks: [],
    lastMutationTimestamp: undefined,
    ...overrides
  };
}

describe('PositionManageFlow', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2');
    setSearchParamsMock.mockClear();
    h.modalProps = undefined;
    h.sheetProps = undefined;
    h.claimProps = undefined;
    h.reopenProps = undefined;
    h.postMortemProps = undefined;
    h.positions = [makePosition()];
  });
  afterEach(cleanup);

  it('routes a liquidated position to the post-mortem modal instead of the details modal (F8)', () => {
    h.positions = [makePosition({ barks: [makeBark()] })];
    render(<PositionManageFlow />);

    expect(screen.getByTestId('post-mortem-modal-stub')).toBeTruthy();
    expect(screen.queryByTestId('details-modal-stub')).toBeNull();
    expect(h.postMortemProps?.urnIndex).toBe(2);

    act(() => (h.postMortemProps!.onClose as () => void)());
    expect(mockSearchParams.get('flow')).toBeNull();
  });

  it('routes a liquidated position to the post-mortem even on a stake_tab deep link', () => {
    // stake_tab mounts the flow directly in the sheet view — the liquidation
    // guard must run BEFORE the view dispatch, or a barked urn opens a manage
    // sheet over zeroed collateral.
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2&stake_tab=free');
    h.positions = [makePosition({ barks: [makeBark()] })];
    render(<PositionManageFlow />);

    expect(screen.getByTestId('post-mortem-modal-stub')).toBeTruthy();
    expect(screen.queryByTestId('manage-sheet-stub')).toBeNull();
  });

  it('routes a liquidated position to the post-mortem even on initialSheetInit', () => {
    h.positions = [makePosition({ barks: [makeBark()] })];
    render(<PositionManageFlow initialSheetInit={{ borrowCard: 'repay' }} />);

    expect(screen.getByTestId('post-mortem-modal-stub')).toBeTruthy();
    expect(screen.queryByTestId('manage-sheet-stub')).toBeNull();
  });

  it('keeps a non-liquidated position on the ordinary details modal', () => {
    h.positions = [makePosition({ skyLocked: 100n, barks: [] })];
    render(<PositionManageFlow />);

    expect(screen.getByTestId('details-modal-stub')).toBeTruthy();
    expect(screen.queryByTestId('post-mortem-modal-stub')).toBeNull();
  });

  it('mounts the details modal for a valid urn_index', () => {
    render(<PositionManageFlow />);
    expect(screen.getByTestId('details-modal-stub')).toBeTruthy();
    expect(h.modalProps?.urnIndex).toBe(2);
  });

  it('mounts nothing without a parseable urn_index', () => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=nope');
    const { container } = render(<PositionManageFlow />);
    expect(container.innerHTML).toBe('');

    mockSearchParams = new URLSearchParams('flow=manage');
    const second = render(<PositionManageFlow />);
    expect(second.container.innerHTML).toBe('');
  });

  it('swaps to the sheet on a menu action; the sheet only closes (no back to the modal)', () => {
    render(<PositionManageFlow />);

    act(() => (h.modalProps!.onAction as (a: string) => void)('withdraw'));
    expect(screen.getByTestId('manage-sheet-stub')).toBeTruthy();
    expect(h.sheetProps?.init).toEqual({ stakeCard: 'withdraw' });

    // Design QA 2800:91832: the sheet has no back arrow — it is not handed one.
    expect(h.sheetProps?.onBack).toBeUndefined();
    act(() => (h.sheetProps!.onClose as () => void)());
    expect(mockSearchParams.get('flow')).toBeNull();
    expect(mockSearchParams.get('urn_index')).toBeNull();
  });

  it('swaps to the claim modal and its × returns to the details modal (F6/C11)', () => {
    render(<PositionManageFlow />);

    act(() => (h.modalProps!.onClaim as () => void)());
    expect(screen.getByTestId('claim-modal-stub')).toBeTruthy();
    expect(h.claimProps?.urnIndex).toBe(2);

    act(() => (h.claimProps!.onClose as () => void)());
    expect(screen.getByTestId('details-modal-stub')).toBeTruthy();
    // The flow params stay staged — only a successful claim clears them.
    expect(mockSearchParams.get('flow')).toBe('manage');
  });

  it('swaps to the reopen takeover with the urn context and history shape (F6/C17)', () => {
    render(<PositionManageFlow />);

    act(() => (h.modalProps!.onReopen as (b: boolean) => void)(true));
    expect(screen.getByTestId('reopen-takeover-stub')).toBeTruthy();
    expect(h.reopenProps?.urnIndex).toBe(2);
    expect(h.reopenProps?.borrowExpanded).toBe(true);

    // No back arrow on the takeover (Design QA 2800:91832): × clears the flow.
    expect(h.reopenProps?.onBack).toBeUndefined();
    act(() => (h.reopenProps!.onClose as () => void)());
    expect(mockSearchParams.get('flow')).toBeNull();
  });

  it('opens the sheet directly on a stake_tab deep link', () => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=1&stake_tab=free');
    render(<PositionManageFlow />);

    expect(screen.getByTestId('manage-sheet-stub')).toBeTruthy();
    expect(h.sheetProps?.init).toEqual({ stakeCard: 'withdraw', borrowCard: 'repay' });
  });

  it('close clears every manage param', () => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2&stake_tab=lock');
    render(<PositionManageFlow />);

    act(() => (h.sheetProps!.onClose as () => void)());
    expect(mockSearchParams.get('flow')).toBeNull();
    expect(mockSearchParams.get('urn_index')).toBeNull();
    expect(mockSearchParams.get('stake_tab')).toBeNull();
  });

  it('opens the sheet directly on initialSheetInit, ahead of stake_tab and details', () => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2&stake_tab=lock');
    const onInitialSheetInitConsumed = vi.fn();
    render(
      <PositionManageFlow
        initialSheetInit={{ borrowCard: 'repay' }}
        onInitialSheetInitConsumed={onInitialSheetInitConsumed}
      />
    );

    expect(screen.getByTestId('manage-sheet-stub')).toBeTruthy();
    expect(h.sheetProps?.init).toEqual({ borrowCard: 'repay' });
    expect(onInitialSheetInitConsumed).toHaveBeenCalledTimes(1);
  });

  it('leaves existing details/stake_tab behavior unchanged without initialSheetInit', () => {
    const onInitialSheetInitConsumed = vi.fn();
    render(<PositionManageFlow onInitialSheetInitConsumed={onInitialSheetInitConsumed} />);

    expect(screen.getByTestId('details-modal-stub')).toBeTruthy();
    expect(onInitialSheetInitConsumed).not.toHaveBeenCalled();
  });
});
