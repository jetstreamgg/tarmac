import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Token icons/avatars pull image/wagmi machinery irrelevant to the summary layout.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => null }));

import { StakeManageConfirmSummary } from './StakeManageConfirmSummary';

const WAD = 10n ** 18n;
const DELEGATE_A = '0x1111111111111111111111111111111111111111' as const;
const DELEGATE_B = '0x2222222222222222222222222222222222222222' as const;

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

  it('renders the delegate From → To block for a delegate-only change', () => {
    renderSummary({ delegateFrom: DELEGATE_A, delegateTo: DELEGATE_B });

    const block = screen.getByTestId('stake-manage-summary-delegate');
    expect(block.textContent).toContain('From');
    expect(block.textContent).toContain('To');
  });

  it('keeps the delegate block visible when amounts are staged in the same bundle', () => {
    // Mixed manage action: the review screen must preview EVERY leg —
    // "Change delegate" is one of the steps, so hiding its From → To block
    // behind the amount heroes under-reports the transaction.
    renderSummary({ skyToFree: 500n * WAD, usdsToWipe: 1_000n * WAD, delegateTo: DELEGATE_B });

    expect(screen.getByTestId('stake-manage-summary-withdraw')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-summary-repay')).toBeTruthy();
    expect(screen.getByTestId('stake-manage-summary-delegate')).toBeTruthy();
  });

  it('omits the delegate block when no change is staged', () => {
    renderSummary({ skyToLock: 100n * WAD, delegateFrom: DELEGATE_A });

    expect(screen.getByTestId('stake-manage-summary-stake')).toBeTruthy();
    expect(screen.queryByTestId('stake-manage-summary-delegate')).toBeNull();
  });

  it('renders the reward From → To block for a staged reward change (APP-516)', () => {
    renderSummary({ rewardFrom: 'SKY', rewardTo: 'USDS' });

    const block = screen.getByTestId('stake-manage-summary-reward');
    expect(block.textContent).toContain('From');
    expect(block.textContent).toContain('SKY');
    expect(block.textContent).toContain('To');
    expect(block.textContent).toContain('USDS');
  });

  it('omits the reward block when no change is staged', () => {
    renderSummary({ skyToLock: 100n * WAD, rewardFrom: 'SKY' });

    expect(screen.queryByTestId('stake-manage-summary-reward')).toBeNull();
  });
});
