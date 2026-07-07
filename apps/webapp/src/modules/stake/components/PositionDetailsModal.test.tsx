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
  rewardContract: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc',
  rewardSymbol: 'SKY',
  voteDelegate: DELEGATE,
  rewardsRate: 0.015,
  estAnnualRewardsSky: parseUnits('10693', 18),
  claimableUsd: 90.22,
  claimableSymbols: ['SKY'],
  claimableTokenAmount: parseUnits('10.9', 18),
  claimableLoading: false,
  rewardsEarnedUsd: 128.9,
  stabilityFee: 85100000000000000000000000n * 10n ** 3n, // placeholder ray; display asserted loosely
  skyPriceUsd: 0.05,
  stakedUsd: 120788.9,
  borrowedUsd: 30000
};

function renderModal(overrides: Partial<StakePositionDetail> = {}, props: Record<string, unknown> = {}) {
  h.detail = { ...baseDetail, ...overrides };
  const onClose = vi.fn();
  const onAction = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <PositionDetailsModal urnIndex={0} onClose={onClose} onAction={onAction} {...props} />
    </I18nProvider>
  );
  return { onClose, onAction };
}

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
    expect(warning.textContent).toContain('48.00%');
    expect(warning.textContent).toContain('$0.0432');
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

    for (const testid of [
      'stake-manage-menu-claim',
      'stake-manage-menu-change-reward',
      'stake-manage-menu-close-position'
    ]) {
      const row = screen.getByTestId(testid) as HTMLButtonElement;
      expect(row.disabled).toBe(true);
      fireEvent.click(row);
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows the live claimable chip on the disabled claim row', () => {
    renderModal();
    expect(screen.getByTestId('stake-manage-menu-claim').textContent).toContain('10.9 SKY');
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
});
