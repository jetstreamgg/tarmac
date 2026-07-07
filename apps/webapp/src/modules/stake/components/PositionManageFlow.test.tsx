import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';

const h = vi.hoisted(() => ({
  modalProps: undefined as Record<string, unknown> | undefined,
  sheetProps: undefined as Record<string, unknown> | undefined
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

vi.mock('./PositionDetailsModal', () => ({
  PositionDetailsModal: (props: Record<string, unknown>) => {
    h.modalProps = props;
    return <div data-testid="details-modal-stub" />;
  }
}));

vi.mock('./ManagePositionTakeover', () => ({
  ManagePositionTakeover: (props: Record<string, unknown>) => {
    h.sheetProps = props;
    return <div data-testid="manage-sheet-stub" />;
  }
}));

import { PositionManageFlow, manageActionInit, stakeTabInit } from './PositionManageFlow';

describe('manageActionInit', () => {
  it('maps menu actions to card pre-toggles (UX B.3)', () => {
    expect(manageActionInit('stake')).toEqual({ stakeCard: 'stake' });
    expect(manageActionInit('withdraw')).toEqual({ stakeCard: 'withdraw' });
    expect(manageActionInit('borrow')).toEqual({ borrowCard: 'borrow' });
    expect(manageActionInit('repay')).toEqual({ borrowCard: 'repay' });
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

describe('PositionManageFlow', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('flow=manage&urn_index=2');
    setSearchParamsMock.mockClear();
    h.modalProps = undefined;
    h.sheetProps = undefined;
  });
  afterEach(cleanup);

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

  it('swaps to the sheet on a menu action and back again', () => {
    render(<PositionManageFlow />);

    act(() => (h.modalProps!.onAction as (a: string) => void)('withdraw'));
    expect(screen.getByTestId('manage-sheet-stub')).toBeTruthy();
    expect(h.sheetProps?.init).toEqual({ stakeCard: 'withdraw' });

    act(() => (h.sheetProps!.onBack as () => void)());
    expect(screen.getByTestId('details-modal-stub')).toBeTruthy();
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
});
