import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StakeUrnBark, StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

const h = vi.hoisted(() => ({
  vault: undefined as Record<string, unknown> | undefined,
  vaultLoading: false
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnAddress: () => ({ data: '0x1111111111111111111111111111111111111111', isLoading: false }),
    useVault: () => ({ data: h.vault, isLoading: h.vaultLoading, error: null }),
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0x2222222222222222222222222222222222222222' }],
      isLoading: false
    }),
    useRewardContractsToClaim: () => ({
      data: [
        {
          contractAddress: '0x2222222222222222222222222222222222222222',
          claimBalance: 50000000000000000000n, // 50 SKY
          rewardSymbol: 'SKY'
        }
      ],
      isLoading: false
    }),
    usePrices: () => ({ data: { SKY: { price: '2' } }, isLoading: false, error: null })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakePositionRowBanner } from './StakePositionRowBanner';

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
    index: 0,
    skyLocked: 100n * 10n ** 18n,
    usdsDebt: 50n * 10n ** 18n,
    barks: [],
    lastMutationTimestamp: undefined,
    ...overrides
  };
}

describe('StakePositionRowBanner', () => {
  beforeEach(() => {
    h.vault = undefined;
    h.vaultLoading = false;
  });
  afterEach(cleanup);

  it('renders nothing while the vault is loading', () => {
    h.vaultLoading = true;
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <StakePositionRowBanner position={makePosition()} onRemediate={vi.fn()} onClaim={vi.fn()} />
      </I18nProvider>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for a healthy position', () => {
    h.vault = { debtValue: 50n * 10n ** 18n, liquidationProximityPercentage: 10 };
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <StakePositionRowBanner position={makePosition()} onRemediate={vi.fn()} onClaim={vi.fn()} />
      </I18nProvider>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the warning banner with the computed drop percent and fires onRemediate', () => {
    h.vault = {
      debtValue: 50n * 10n ** 18n,
      liquidationProximityPercentage: 65,
      liquidationPrice: 1n * 10n ** 18n
    };
    const onRemediate = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <StakePositionRowBanner position={makePosition()} onRemediate={onRemediate} onClaim={vi.fn()} />
      </I18nProvider>
    );

    expect(screen.getByTestId('stake-position-warning-banner')).toBeTruthy();
    expect(screen.getByText(/dropped to 35%/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('stake-warning-stake-cta'));
    expect(onRemediate).toHaveBeenCalledWith('stake');

    fireEvent.click(screen.getByTestId('stake-warning-repay-cta'));
    expect(onRemediate).toHaveBeenCalledWith('repay');
  });

  it('renders the liquidated banner in preference to the warning banner, with refund + rewards', () => {
    h.vault = {
      debtValue: 50n * 10n ** 18n,
      liquidationProximityPercentage: 90,
      collateralAmount: 12n * 10n ** 18n
    };
    const onClaim = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <StakePositionRowBanner
          position={makePosition({ barks: [makeBark()] })}
          onRemediate={vi.fn()}
          onClaim={onClaim}
        />
      </I18nProvider>
    );

    expect(screen.getByTestId('stake-position-liquidated-banner')).toBeTruthy();
    expect(screen.queryByTestId('stake-position-warning-banner')).toBeNull();
    expect(screen.getByText(/Your 12 SKY refund/)).toBeTruthy(); // refund amount
    expect(screen.getByText(/\$100\.00/)).toBeTruthy(); // 50 SKY claimable * $2

    fireEvent.click(screen.getByTestId('stake-liquidated-claim-cta'));
    expect(onClaim).toHaveBeenCalled();
  });

  it('stops the click from bubbling to a parent row handler', () => {
    h.vault = {
      debtValue: 50n * 10n ** 18n,
      liquidationProximityPercentage: 65,
      liquidationPrice: 1n * 10n ** 18n
    };
    const parentClick = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <div onClick={parentClick}>
          <StakePositionRowBanner position={makePosition()} onRemediate={vi.fn()} onClaim={vi.fn()} />
        </div>
      </I18nProvider>
    );

    fireEvent.click(screen.getByTestId('stake-position-warning-banner'));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
