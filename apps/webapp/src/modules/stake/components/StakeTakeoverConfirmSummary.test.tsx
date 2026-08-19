import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Token icons pull image/wagmi machinery irrelevant to the summary layout.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakeTakeoverConfirmSummary } from './StakeTakeoverConfirmSummary';

const renderSummary = (props: Partial<React.ComponentProps<typeof StakeTakeoverConfirmSummary>> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeTakeoverConfirmSummary skyToLock={100n * 10n ** 18n} usdsToBorrow={0n} {...props} />
    </I18nProvider>
  );

describe('StakeTakeoverConfirmSummary', () => {
  afterEach(cleanup);

  it('names the selected reward token when provided', () => {
    renderSummary({ rewardSymbol: 'SKY' });

    const row = screen.getByTestId('stake-takeover-confirm-reward');
    expect(row.textContent).toContain('Reward');
    expect(row.textContent).toContain('SKY');
  });

  it('omits the reward row when no reward is passed at all', () => {
    renderSummary();

    expect(screen.queryByTestId('stake-takeover-confirm-reward')).toBeNull();
  });

  it('falls back to the shortened farm address when the symbol is unknown', () => {
    // A picked farm outside the generated address books must still show in the
    // review — the multicall carries its selectFarm leg either way.
    renderSummary({ rewardContract: '0x9999999999999999999999999999999999999999' });

    expect(screen.getByTestId('stake-takeover-confirm-reward').textContent).toContain('0x9999...9999');
  });

  it('prefers the symbol over the address when both are known', () => {
    renderSummary({ rewardSymbol: 'FOO', rewardContract: '0x9999999999999999999999999999999999999999' });

    const row = screen.getByTestId('stake-takeover-confirm-reward');
    expect(row.textContent).toContain('FOO');
    expect(row.textContent).not.toContain('0x9999');
  });

  it('keeps the borrow hero conditional on a non-zero amount', () => {
    renderSummary({ usdsToBorrow: 5n * 10n ** 18n, rewardSymbol: 'USDS' });

    expect(screen.getByText('Borrow amount')).toBeTruthy();
    expect(screen.getByText('Stake amount')).toBeTruthy();
  });
});
