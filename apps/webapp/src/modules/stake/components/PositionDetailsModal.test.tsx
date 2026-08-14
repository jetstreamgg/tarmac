import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { RiskLevel } from '@/hooks';
import type { StakePositionDetail } from '../hooks/useStakePositionDetail';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>
}));

vi.mock('../hooks/useStakePositionDetail', () => ({
  useStakePositionDetail: () => h.detail
}));

// Chain-aware presentational leaf — needs a WagmiProvider it doesn't deserve.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { PositionDetailsModal } from './PositionDetailsModal';

const DELEGATE = '0x0F23dE72e1581857eacD6308aebb69cF3a49CC86' as const;

const baseDetail: StakePositionDetail = {
  urnAddress: '0x8888888888888888888888888888888888888888',
  vault: {
    collateralType: 'LSEV2-SKY-A',
    collateralAmount: parseUnits('712888.9', 18),
    debtValue: parseUnits('30000', 18),
    riskLevel: RiskLevel.LOW,
    liquidationProximityPercentage: 52,
    liquidationPrice: parseUnits('0.0432', 18),
    delayedPrice: parseUnits('0.0608', 18),
    dust: parseUnits('30000', 18)
  },
  vaultLoading: false,
  hasDebt: true,
  isInactive: false,
  hasBorrowHistory: true,
  rewardContract: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc',
  rewardSymbol: 'SKY',
  voteDelegate: DELEGATE,
  rewardsRate: 0.015,
  rateLoading: false,
  estAnnualRewardsSky: parseUnits('10693', 18),
  claimableUsd: 90.22,
  claimableSymbols: ['SKY'],
  claimableTokenAmount: parseUnits('10.9', 18),
  claimableLoading: false,
  rewardsEarnedUsd: 128.9,
  rewardsEarnedLoading: false,
  stabilityFee: 85100000000000000000000000n * 10n ** 3n, // placeholder ray; display asserted loosely
  skyPriceUsd: 0.05,
  stakedUsd: 120788.9,
  borrowedUsd: 30000
};

function renderModal(overrides: Partial<StakePositionDetail> = {}, props: Record<string, unknown> = {}) {
  h.detail = { ...baseDetail, ...overrides };
  const onClose = vi.fn();
  const onAction = vi.fn();
  const onClaim = vi.fn();
  const onReopen = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <PositionDetailsModal
        urnIndex={0}
        onClose={onClose}
        onAction={onAction}
        onClaim={onClaim}
        onReopen={onReopen}
        {...props}
      />
    </I18nProvider>
  );
  return { onClose, onAction, onClaim, onReopen };
}

/** An emptied urn: zero collateral/debt, residual claimables per test. */
const inactiveDetail = (overrides: Partial<StakePositionDetail> = {}): Partial<StakePositionDetail> => ({
  vault: {
    ...baseDetail.vault!,
    collateralAmount: 0n,
    debtValue: 0n,
    liquidationPrice: undefined,
    liquidationProximityPercentage: undefined,
    riskLevel: undefined
  } as never,
  hasDebt: false,
  isInactive: true,
  hasBorrowHistory: false,
  estAnnualRewardsSky: null,
  stakedUsd: 0,
  borrowedUsd: 0,
  ...overrides
});

describe('PositionDetailsModal', () => {
  beforeEach(() => {
    h.detail = { ...baseDetail };
  });
  afterEach(cleanup);

  it('renders both heroes and the full 7-row menu when the urn has debt', () => {
    renderModal();

    expect(screen.getByText('Position 1')).toBeTruthy();
    expect(screen.getByText('Staked amount')).toBeTruthy();
    expect(screen.getByText('Borrowed amount')).toBeTruthy();

    for (const testid of [
      'stake-manage-menu-claim',
      'stake-manage-menu-borrow',
      'stake-manage-menu-repay',
      'stake-manage-menu-withdraw',
      'stake-manage-menu-change-reward',
      'stake-manage-menu-change-delegate',
      'stake-manage-menu-close-position'
    ]) {
      expect(screen.getByTestId(testid)).toBeTruthy();
    }
    expect(screen.getByTestId('stake-manage-cta-stake').textContent).toContain('Stake more SKY');
    expect(screen.queryByTestId('stake-manage-cta-borrow')).toBeNull();
  });

  it('keeps menu-row chevrons persistently visible (no hover-only opacity gate)', () => {
    renderModal();

    const chevron = screen.getByTestId('stake-manage-menu-claim').querySelector('svg.lucide-chevron-right');
    expect(chevron).toBeTruthy();
    expect(chevron?.getAttribute('class') ?? '').not.toContain('opacity-0');
  });

  it('reduces the menu and adds the Borrow USDS CTA without debt (UX 1050:21185)', () => {
    renderModal({
      hasDebt: false,
      vault: { ...baseDetail.vault!, debtValue: 0n },
      borrowedUsd: 0
    });

    expect(screen.queryByText('Borrowed amount')).toBeNull();
    expect(screen.queryByTestId('stake-manage-menu-borrow')).toBeNull();
    expect(screen.queryByTestId('stake-manage-menu-repay')).toBeNull();
    expect(screen.queryByTestId('stake-manage-menu-close-position')).toBeNull();
    expect(screen.getByTestId('stake-manage-menu-withdraw')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-cta-stake')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-cta-borrow').textContent).toContain('Borrow USDS');
  });

  it('derives the warning sentence from the liquidation proximity (M14)', () => {
    renderModal();
    const warning = screen.getByTestId('stake-position-warning');
    // Integer percent — the row banner interpolates the same value bare, and
    // the proximity math only ever produces integers.
    expect(warning.textContent).toContain('48%');
    expect(warning.textContent).not.toContain('48.00%');
    expect(warning.textContent).toContain('$0.0432');
  });

  it('holds the rewards-earned figure while either of its legs is loading', () => {
    renderModal({ rewardsEarnedLoading: true });
    expect(screen.queryByText('+$128.90')).toBeNull();
  });

  it('routes menu rows and CTAs through onAction', () => {
    const { onAction } = renderModal();

    fireEvent.click(screen.getByTestId('stake-manage-menu-withdraw'));
    expect(onAction).toHaveBeenLastCalledWith('withdraw');
    fireEvent.click(screen.getByTestId('stake-manage-menu-borrow'));
    expect(onAction).toHaveBeenLastCalledWith('borrow');
    fireEvent.click(screen.getByTestId('stake-manage-menu-repay'));
    expect(onAction).toHaveBeenLastCalledWith('repay');
    fireEvent.click(screen.getByTestId('stake-manage-menu-change-delegate'));
    expect(onAction).toHaveBeenLastCalledWith('delegate');
    fireEvent.click(screen.getByTestId('stake-manage-cta-stake'));
    expect(onAction).toHaveBeenLastCalledWith('stake');
  });

  it('keeps the undesigned flows disabled (M4: flagged, not improvised)', () => {
    const { onAction } = renderModal();

    for (const testid of ['stake-manage-menu-change-reward', 'stake-manage-menu-close-position']) {
      const row = screen.getByTestId(testid) as HTMLButtonElement;
      expect(row.disabled).toBe(true);
      fireEvent.click(row);
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it('opens the claim modal from the live claim row with its claimable chip (F6)', () => {
    const { onClaim } = renderModal();

    const row = screen.getByTestId('stake-manage-menu-claim') as HTMLButtonElement;
    // Chip shows the bare amount + token icon (Badges/Special) — no symbol text.
    expect(row.textContent).toContain('10.9');
    expect(row.textContent).not.toContain('SKY');
    expect(row.disabled).toBe(false);
    fireEvent.click(row);
    expect(onClaim).toHaveBeenCalled();
  });

  it('compacts a huge claimable amount in the chip', () => {
    renderModal({ claimableTokenAmount: parseUnits('123456789', 18) });
    expect(screen.getByTestId('stake-manage-menu-claim').textContent).toContain('123.46M');
  });

  it('keeps 4 decimals on a dust claimable instead of collapsing to <0.01', () => {
    renderModal({ claimableTokenAmount: parseUnits('0.0012', 18) });
    expect(screen.getByTestId('stake-manage-menu-claim').textContent).toContain('0.0012');
  });

  it('disables the claim row while nothing is claimable or the read is loading', () => {
    renderModal({ claimableTokenAmount: 0n });
    expect((screen.getByTestId('stake-manage-menu-claim') as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    renderModal({ claimableLoading: true });
    expect((screen.getByTestId('stake-manage-menu-claim') as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes through the close button', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByTestId('stake-position-details-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the delegate as a shortened address with a profile link', () => {
    renderModal();
    const delegateLink = screen.getByTestId('stake-position-delegate-link') as HTMLAnchorElement;
    expect(delegateLink.textContent).toContain('0x0F23...CC86');
    expect(delegateLink.href).toContain(DELEGATE.toLowerCase());
  });

  it('never shows the Inactive chip on an active position', () => {
    renderModal();
    expect(screen.queryByTestId('stake-position-inactive-chip')).toBeNull();
    expect(screen.queryByTestId('stake-manage-cta-reopen')).toBeNull();
  });

  it('skeletons the menu and CTAs while the vault state is unknown (no wrong-variant flash)', () => {
    renderModal({ vault: undefined, vaultLoading: true, hasDebt: false, isInactive: false });

    expect(screen.getByTestId('stake-manage-menu-loading')).toBeTruthy();
    expect(screen.queryAllByTestId(/^stake-manage-menu-(claim|borrow|repay|withdraw)/)).toHaveLength(0);
    expect(screen.queryByTestId('stake-manage-cta-stake')).toBeNull();
    expect(screen.queryByTestId('stake-manage-cta-reopen')).toBeNull();
  });
});

describe('PositionDetailsModal — inactive states (F6, UX 1194:20561 / 1194:21273)', () => {
  beforeEach(() => {
    h.detail = { ...baseDetail };
  });
  afterEach(cleanup);

  it('staked-only history: chip, 4-row menu, withdraw disabled, claim enabled with chip', () => {
    const { onAction, onClaim } = renderModal(inactiveDetail());

    expect(screen.getByTestId('stake-position-inactive-chip').textContent).toBe('Inactive');

    // Frame order: Claim rewards · Change reward · Change delegate · Withdraw SKY.
    const rows = screen.getAllByTestId(/^stake-manage-menu-/);
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'stake-manage-menu-claim',
      'stake-manage-menu-change-reward',
      'stake-manage-menu-change-delegate',
      'stake-manage-menu-withdraw'
    ]);

    const claimRow = screen.getByTestId('stake-manage-menu-claim') as HTMLButtonElement;
    expect(claimRow.disabled).toBe(false);
    expect(claimRow.textContent).toContain('10.9');
    fireEvent.click(claimRow);
    expect(onClaim).toHaveBeenCalled();

    expect((screen.getByTestId('stake-manage-menu-withdraw') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('stake-manage-menu-change-reward') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('stake-manage-menu-change-delegate'));
    expect(onAction).toHaveBeenLastCalledWith('delegate');

    // No borrow section for a urn that never borrowed.
    expect(screen.queryByText('Borrowed amount')).toBeNull();
    expect(screen.queryByTestId('stake-position-closed-copy')).toBeNull();
    expect(screen.queryByTestId('stake-position-warning')).toBeNull();
  });

  it('staked-&-borrowed history: zeroed borrow block, No position chip, closed copy, 7 disabled-heavy rows', () => {
    const { onAction } = renderModal(inactiveDetail({ hasBorrowHistory: true, claimableTokenAmount: 0n }));

    expect(screen.getByText('Borrowed amount')).toBeTruthy();
    expect(screen.getByTestId('stake-position-risk-pill').textContent).toBe('No position');
    expect(screen.getByTestId('stake-position-closed-copy').textContent).toContain(
      'Your position has been closed'
    );
    // Liquidation price is a dash; the warning sentence never renders.
    expect(screen.queryByTestId('stake-position-warning')).toBeNull();

    // Frame order: enabled rows first, then the disabled rest.
    const rows = screen.getAllByTestId(/^stake-manage-menu-/);
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'stake-manage-menu-change-reward',
      'stake-manage-menu-change-delegate',
      'stake-manage-menu-claim',
      'stake-manage-menu-borrow',
      'stake-manage-menu-repay',
      'stake-manage-menu-withdraw',
      'stake-manage-menu-close-position'
    ]);

    for (const testid of [
      'stake-manage-menu-claim',
      'stake-manage-menu-borrow',
      'stake-manage-menu-repay',
      'stake-manage-menu-withdraw',
      'stake-manage-menu-close-position'
    ]) {
      expect((screen.getByTestId(testid) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(screen.getByTestId('stake-manage-menu-change-delegate'));
    expect(onAction).toHaveBeenLastCalledWith('delegate');
  });

  it('keeps claim enabled on a borrowed-history urn with residual claimables (C16)', () => {
    renderModal(inactiveDetail({ hasBorrowHistory: true }));
    expect((screen.getByTestId('stake-manage-menu-claim') as HTMLButtonElement).disabled).toBe(false);
  });

  it('replaces the CTAs with Reopen position carrying the borrow-history shape (C17)', () => {
    const { onReopen } = renderModal(inactiveDetail());
    expect(screen.queryByTestId('stake-manage-cta-stake')).toBeNull();
    expect(screen.queryByTestId('stake-manage-cta-borrow')).toBeNull();
    fireEvent.click(screen.getByTestId('stake-manage-cta-reopen'));
    expect(onReopen).toHaveBeenLastCalledWith(false);
    cleanup();

    const borrowed = renderModal(inactiveDetail({ hasBorrowHistory: true }));
    fireEvent.click(screen.getByTestId('stake-manage-cta-reopen'));
    expect(borrowed.onReopen).toHaveBeenLastCalledWith(true);
  });
});

describe('PositionDetailsModal — phone-tier footer + manage sheet (M6, comps 1292:63278 / 1222:16239)', () => {
  beforeEach(() => {
    h.detail = { ...baseDetail };
  });
  afterEach(cleanup);

  it('renders the pinned footer pair and routes Stake more SKY through onAction', () => {
    const { onAction } = renderModal();

    fireEvent.click(screen.getByTestId('stake-details-cta-stake'));
    expect(onAction).toHaveBeenLastCalledWith('stake');
    expect(screen.getByTestId('stake-details-cta-manage').textContent).toContain('Manage position');
    expect(screen.queryByTestId('stake-details-cta-reopen')).toBeNull();
  });

  it('swaps the footer primary for Reopen on an inactive urn', () => {
    const { onReopen } = renderModal(inactiveDetail({ hasBorrowHistory: true }));

    expect(screen.queryByTestId('stake-details-cta-stake')).toBeNull();
    fireEvent.click(screen.getByTestId('stake-details-cta-reopen'));
    expect(onReopen).toHaveBeenLastCalledWith(true);
  });

  it('raises the manage sheet with the shared row composition under suffixed ids', () => {
    const { onAction } = renderModal();

    expect(screen.queryByTestId('stake-manage-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('stake-details-cta-manage'));
    expect(screen.getByTestId('stake-manage-sheet')).toBeTruthy();

    for (const testid of [
      'stake-manage-menu-claim-sheet',
      'stake-manage-menu-borrow-sheet',
      'stake-manage-menu-repay-sheet',
      'stake-manage-menu-withdraw-sheet',
      'stake-manage-menu-change-reward-sheet',
      'stake-manage-menu-change-delegate-sheet',
      'stake-manage-menu-close-position-sheet'
    ]) {
      expect(screen.getByTestId(testid)).toBeTruthy();
    }
    // Comp 1222:16239 pins a single Stake more SKY CTA while indebted.
    expect(screen.getByTestId('stake-manage-cta-stake-sheet')).toBeTruthy();
    expect(screen.queryByTestId('stake-manage-cta-borrow-sheet')).toBeNull();

    fireEvent.click(screen.getByTestId('stake-manage-menu-withdraw-sheet'));
    expect(onAction).toHaveBeenLastCalledWith('withdraw');
  });

  it('closes the sheet without taking the details modal down with it', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByTestId('stake-details-cta-manage'));
    fireEvent.click(screen.getByTestId('stake-manage-sheet-close'));
    expect(screen.queryByTestId('stake-manage-sheet')).toBeNull();
    expect(screen.getByTestId('stake-position-details')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
