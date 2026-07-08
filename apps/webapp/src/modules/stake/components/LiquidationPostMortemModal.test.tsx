import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StakeUrnBark, StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

const URN_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const SKY_REWARD_CONTRACT = '0x2222222222222222222222222222222222222222' as const;
const SPK_REWARD_CONTRACT = '0x3333333333333333333333333333333333333333' as const;
const DELEGATE = '0x5555555555555555555555555555555555555555' as const;

const h = vi.hoisted(() => ({
  positions: undefined as unknown[] | undefined,
  vault: undefined as Record<string, unknown> | undefined,
  vaultLoading: false,
  rewardContracts: [
    { contractAddress: '0x2222222222222222222222222222222222222222' },
    { contractAddress: '0x3333333333333333333333333333333333333333' }
  ] as { contractAddress: `0x${string}` }[],
  toClaim: [] as { contractAddress: `0x${string}`; claimBalance: bigint; rewardSymbol: string }[],
  claimableLoading: false,
  prices: { SKY: { price: '2' }, SPK: { price: '0.5' } } as Record<string, { price: string }>,
  skyPriceString: '2' as string | undefined,
  launchMock: vi.fn(),
  launchParams: undefined as Record<string, unknown> | undefined,
  prepared: true,
  isLoading: false,
  invalidateMock: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: h.invalidateMock }) };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnAddress: () => ({ data: URN_ADDRESS, isLoading: false }),
    useVault: () => ({ data: h.vault, isLoading: h.vaultLoading, error: null }),
    useStakeUrnSelectedVoteDelegate: () => ({ data: DELEGATE, isLoading: false }),
    useStakeRewardContracts: () => ({ data: h.rewardContracts, isLoading: false }),
    useRewardContractsToClaim: () => ({ data: h.toClaim, isLoading: h.claimableLoading }),
    usePrices: () => ({ data: h.prices, isLoading: false, error: null }),
    useSkyPrice: () => ({ priceString: h.skyPriceString, data: undefined, isLoading: false, error: null })
  };
});

vi.mock('../hooks/useStakeUserPositions', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeUserPositions')>();
  return {
    ...actual,
    useStakeUserPositions: () => ({ data: h.positions, isLoading: false, error: null, mutate: vi.fn() })
  };
});

vi.mock('../hooks/useStakeManageLaunch', () => ({
  useStakeManageLaunch: (params: Record<string, unknown>) => {
    h.launchParams = params;
    return {
      launch: h.launchMock,
      execute: vi.fn(),
      steps: [],
      calldata: [],
      hasDelegateChange: false,
      urnSelectedVoteDelegate: undefined,
      shouldUseBatch: false,
      prepared: h.prepared,
      isLoading: h.isLoading,
      error: null
    };
  }
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { LiquidationPostMortemModal } from './LiquidationPostMortemModal';

function makeBark(overrides: Partial<StakeUrnBark> = {}): StakeUrnBark {
  return {
    id: '1-ilk-1',
    ilk: '0x4c534556322d534b592d41',
    clip: '0x71eb8943c6b4426b315745c6001ae824e6dc7fb2',
    clipperId: '1',
    ink: 40n * 10n ** 18n,
    art: 20n * 10n ** 18n,
    due: 22n * 10n ** 18n,
    blockTimestamp: 1_700_000_000,
    transactionHash: '0xf90d3823abc',
    ...overrides
  };
}

function makePosition(overrides: Partial<StakeUserPosition> = {}): StakeUserPosition {
  return {
    index: 0,
    skyLocked: 0n,
    usdsDebt: 0n,
    barks: [makeBark()],
    lastMutationTimestamp: undefined,
    ...overrides
  };
}

function renderModal(urnIndex = 0) {
  const onClose = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <LiquidationPostMortemModal urnIndex={urnIndex} onClose={onClose} />
    </I18nProvider>
  );
  return { onClose };
}

describe('LiquidationPostMortemModal', () => {
  beforeEach(() => {
    h.positions = [makePosition()];
    h.vault = { collateralAmount: 12n * 10n ** 18n };
    h.vaultLoading = false;
    h.toClaim = [];
    h.claimableLoading = false;
    h.prices = { SKY: { price: '2' }, SPK: { price: '0.5' } };
    h.skyPriceString = '2';
    h.launchMock.mockClear();
    h.launchParams = undefined;
    h.prepared = true;
    h.isLoading = false;
    h.invalidateMock.mockClear();
  });
  afterEach(cleanup);

  it('renders the shell, chip and refunded-SKY hero', () => {
    renderModal();

    expect(screen.getByTestId('stake-postmortem-modal')).toBeTruthy();
    expect(screen.getByTestId('stake-postmortem-liquidated-chip').textContent).toBe('Liquidated');
    expect(screen.getByTestId('stake-postmortem-refunded-sky').textContent).toContain('12');
    expect(screen.getByTestId('stake-postmortem-refunded-sky').textContent).toContain('$24.00');
  });

  it('renders NO_VALUE gaps for the ungated stats and the static Released delegate stat', () => {
    renderModal();

    expect(screen.getByText('SKY sold').nextSibling?.textContent).toBe('–');
    expect(screen.getByText('Debt repaid').nextSibling?.textContent).toBe('–');
    expect(screen.getByText('Liquidation penalty (13%)').nextSibling?.textContent).toBe('–');
    expect(screen.getByText('Delegated votes').nextSibling?.textContent).toBe('Released');
  });

  it('derives Collateral before liquidation from the last bark ink', () => {
    renderModal();
    expect(screen.getByText('Collateral before liquidation').nextSibling?.textContent).toBe('40 SKY');
  });

  it('renders the liquidated-on heading in UTC and the explorer link', () => {
    renderModal();

    expect(screen.getByTestId('stake-postmortem-liquidated-on').textContent).toBe(
      'Liquidated on Nov 14, 22:13 UTC'
    );
    const link = screen.getByTestId('stake-postmortem-explorer-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://etherscan.io/tx/0xf90d3823abc');
  });

  it('omits the explorer row and shows a skeleton heading while positions are still loading', () => {
    h.positions = undefined;
    renderModal();

    expect(screen.queryByTestId('stake-postmortem-explorer-link')).toBeNull();
    expect(screen.getByTestId('stake-postmortem-modal')).toBeTruthy();
  });

  it('renders the single-reward claimable hero (amount + USD sub)', () => {
    h.toClaim = [
      { contractAddress: SKY_REWARD_CONTRACT, claimBalance: 10n * 10n ** 18n, rewardSymbol: 'SKY' }
    ];
    renderModal();

    const hero = screen.getByTestId('stake-postmortem-claimable-rewards');
    expect(hero.textContent).toContain('10');
    expect(hero.textContent).toContain('$20.00');
  });

  it('renders the multi-reward claimable hero (USD total + symbol list)', () => {
    h.toClaim = [
      { contractAddress: SKY_REWARD_CONTRACT, claimBalance: 10n * 10n ** 18n, rewardSymbol: 'SKY' },
      { contractAddress: SPK_REWARD_CONTRACT, claimBalance: 4n * 10n ** 18n, rewardSymbol: 'SPK' }
    ];
    renderModal();

    const hero = screen.getByTestId('stake-postmortem-claimable-rewards');
    // 10 SKY * $2 + 4 SPK * $0.5 = $22.00
    expect(hero.textContent).toContain('$22.00');
    expect(hero.textContent).toContain('(SKY, SPK)');
  });

  it('renders NO_VALUE when nothing is claimable', () => {
    h.toClaim = [];
    renderModal();

    expect(screen.getByTestId('stake-postmortem-claimable-rewards').textContent).toContain('–');
  });

  it('excludes zero-balance reward contracts from the recovery claim legs', () => {
    h.toClaim = [
      { contractAddress: SKY_REWARD_CONTRACT, claimBalance: 10n * 10n ** 18n, rewardSymbol: 'SKY' },
      { contractAddress: SPK_REWARD_CONTRACT, claimBalance: 0n, rewardSymbol: 'SPK' }
    ];
    renderModal();

    expect(h.launchParams?.rewardContractsToClaim).toEqual([SKY_REWARD_CONTRACT]);
    expect(h.launchParams?.claimSymbols).toEqual(['SKY']);
  });

  it('passes the withdraw amount and the urn current delegate through to the recovery launch', () => {
    h.vault = { collateralAmount: 12n * 10n ** 18n };
    renderModal();

    expect(h.launchParams?.skyToFree).toBe(12n * 10n ** 18n);
    expect(h.launchParams?.selectedDelegate).toBe(DELEGATE);
  });

  it('enables the recovery launch when there is a refund or a claimable, and calls launch on click', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('stake-postmortem-claim-cta'));
    expect(h.launchMock).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA when there is nothing to recover', () => {
    h.vault = { collateralAmount: 0n };
    h.toClaim = [];
    renderModal();

    expect((screen.getByTestId('stake-postmortem-claim-cta') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables the CTA while the recovery engine is not prepared or is loading', () => {
    h.prepared = false;
    renderModal();
    expect((screen.getByTestId('stake-postmortem-claim-cta') as HTMLButtonElement).disabled).toBe(true);
  });

  it('invalidates the shared stake query keys on a successful recovery', () => {
    renderModal();

    const onSuccess = h.launchParams?.onSuccess as (() => void) | undefined;
    expect(onSuccess).toBeTypeOf('function');
    onSuccess!();

    const invalidated = h.invalidateMock.mock.calls.map(call => call[0].queryKey[0]);
    expect(invalidated).toEqual(
      expect.arrayContaining(['stake-user-positions', 'stake-history', 'readContract'])
    );
  });

  it('wires the × close button to onClose', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByTestId('stake-postmortem-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
