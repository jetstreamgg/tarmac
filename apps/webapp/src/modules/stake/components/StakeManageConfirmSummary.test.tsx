import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Token icons pull image/wagmi machinery irrelevant to the summary layout.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakeManageConfirmSummary } from './StakeManageConfirmSummary';

const WAD = 10n ** 18n;

const renderSummary = (props: Partial<React.ComponentProps<typeof StakeManageConfirmSummary>> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeManageConfirmSummary
        skyToLock={0n}
        skyToFree={0n}
        usdsToBorrow={0n}
        usdsToWipe={0n}
        skyPriceUsd={0.05}
        {...props}
      />
    </I18nProvider>
  );

describe('StakeManageConfirmSummary', () => {
  afterEach(cleanup);

  it('renders one hero per staged amount', () => {
    // A mixed manage action: the review must preview EVERY amount leg — each
    // one is its own step, so a missing hero under-reports the transaction.
    renderSummary({ skyToFree: 500n * WAD, usdsToWipe: 1_000n * WAD });

    expect(screen.getByTestId('stake-manage-summary-withdraw')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-summary-repay')).toBeTruthy();
    expect(screen.queryByTestId('stake-manage-summary-stake')).toBeNull();
    expect(screen.queryByTestId('stake-manage-summary-borrow')).toBeNull();
  });

  it('labels the stake and borrow heroes by direction', () => {
    renderSummary({ skyToLock: 100n * WAD, usdsToBorrow: 20n * WAD });

    expect(screen.getByTestId('stake-manage-summary-stake').textContent).toContain('Stake amount');
    expect(screen.getByTestId('stake-manage-summary-borrow').textContent).toContain('Borrow amount');
  });

  it('prices SKY through the protocol price and USDS at parity', () => {
    renderSummary({ skyToLock: 100n * WAD, usdsToBorrow: 20n * WAD });

    expect(screen.getByTestId('stake-manage-summary-stake').textContent).toContain('$5.00');
    expect(screen.getByTestId('stake-manage-summary-borrow').textContent).toContain('$20.00');
  });

  it('drops the USD subvalue when the SKY price is unresolved', () => {
    renderSummary({ skyToLock: 100n * WAD, skyPriceUsd: null });

    expect(screen.getByTestId('stake-manage-summary-stake').textContent).not.toContain('$');
  });

  it('renders nothing for a selection-only change', () => {
    // A reward- or delegate-only manage stages no amount: the heroes collapse
    // and `StakeConfirmGrid`'s Reward / Delegate cells carry the change.
    renderSummary();

    expect(screen.getByTestId('stake-manage-confirm-summary').textContent).toBe('');
  });
});
