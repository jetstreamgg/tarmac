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

  it('always draws the stake hero', () => {
    renderSummary();

    expect(screen.getByText('Stake amount')).toBeTruthy();
    expect(screen.getByTestId('stake-takeover-confirm-summary').textContent).toContain('100');
  });

  it('keeps the borrow hero conditional on a non-zero amount', () => {
    renderSummary({ usdsToBorrow: 5n * 10n ** 18n });

    expect(screen.getByText('Borrow amount')).toBeTruthy();
    expect(screen.getByText('Stake amount')).toBeTruthy();
  });

  it('omits the borrow hero for a stake-only open', () => {
    renderSummary();

    expect(screen.queryByText('Borrow amount')).toBeNull();
  });
});
