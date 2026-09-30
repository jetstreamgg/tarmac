import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';
import type { StakeUrnClaim } from '../lib/stakeClaims';

i18n.load('en', {});
i18n.activate('en');

const SKY_A = '0x5555555555555555555555555555555555555555';
const SKY_B = '0x7777777777777777777777777777777777777777';
const USDS = '0x6666666666666666666666666666666666666666';
const WAD = 10n ** 18n;

const h = vi.hoisted(() => ({
  claims: [] as StakeUrnClaim[],
  modalProps: undefined as Record<string, unknown> | undefined,
  mounts: 0,
  unmounts: 0
}));

vi.mock('wagmi', () => ({ useChainId: () => 1 }));
vi.mock('@/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks')>()),
  usePrices: () => ({ data: { SKY: { price: '0.05' }, USDS: { price: '1' } } })
}));
vi.mock('../hooks/useStakeUrnsClaims', () => ({
  useStakeUrnsClaims: () => ({ claims: h.claims, isLoading: false })
}));
vi.mock('./StakeClaimModal', () => ({
  StakeClaimModal: (props: Record<string, unknown>) => {
    h.modalProps = props;
    useEffect(() => {
      h.mounts += 1;
      return () => {
        h.unmounts += 1;
      };
    }, []);
    return <div data-testid="claim-modal-stub" />;
  }
}));

import { StakeRewardsSection } from './StakeRewardsSection';

const position = (index: number) =>
  ({ index, urnAddress: `0x${String(index).repeat(40)}` }) as unknown as StakeUserPosition;
const positions = [position(0), position(1)];

const claim = (urnIndex: bigint, contractAddress: `0x${string}`, whole: bigint, rewardSymbol: string) => ({
  urnIndex,
  contractAddress,
  claimBalance: whole * WAD,
  rewardSymbol
});

const renderSection = () => {
  const ui = () => (
    <I18nProvider i18n={i18n}>
      <StakeRewardsSection positions={positions} />
    </I18nProvider>
  );
  const { rerender } = render(ui());
  return { rerender: () => rerender(ui()) };
};

afterEach(() => {
  cleanup();
  h.modalProps = undefined;
  h.mounts = 0;
  h.unmounts = 0;
});

describe('StakeRewardsSection', () => {
  it('renders nothing with no claimable rewards', () => {
    h.claims = [];
    renderSection();
    expect(screen.queryByTestId('stake-rewards-section')).toBeNull();
  });

  it('shows one row per token and no Claim all for a single token across urns', () => {
    h.claims = [claim(0n, SKY_A, 1n, 'SKY'), claim(1n, SKY_A, 2n, 'SKY')];
    renderSection();

    expect(screen.getAllByTestId('reward-row')).toHaveLength(1);
    expect(screen.queryByTestId('stake-rewards-claim-all')).toBeNull();

    fireEvent.click(screen.getByTestId('reward-claim-button'));
    const selection = h.modalProps?.selection as { targets: unknown[]; rewardContracts: string[] };
    expect(selection.targets).toHaveLength(2);
    expect(selection.rewardContracts).toEqual([SKY_A]);
  });

  it('offers Claim all over every urn with two or more tokens', () => {
    h.claims = [claim(0n, SKY_A, 1n, 'SKY'), claim(1n, SKY_B, 2n, 'SKY'), claim(1n, USDS, 3n, 'USDS')];
    renderSection();

    expect(screen.getAllByTestId('reward-row')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('stake-rewards-claim-all'));
    const selection = h.modalProps?.selection as { targets: unknown[]; rewardContracts?: string[] };
    expect(selection.targets).toHaveLength(2);
    expect(selection.rewardContracts).toBeUndefined();
    expect(h.modalProps?.closeAfterSuccess).toBe(true);
  });

  it('a token row claims every farm paying that token', () => {
    h.claims = [claim(0n, SKY_A, 1n, 'SKY'), claim(1n, SKY_B, 2n, 'SKY'), claim(1n, USDS, 3n, 'USDS')];
    renderSection();

    fireEvent.click(screen.getAllByTestId('reward-claim-button')[0]);
    const selection = h.modalProps?.selection as { rewardContracts: string[] };
    expect(selection.rewardContracts).toEqual([SKY_A, SKY_B]);
  });

  it('keeps the claim launcher mounted while a refetch empties the rewards', () => {
    h.claims = [claim(0n, USDS, 3n, 'USDS')];
    const { rerender } = renderSection();
    fireEvent.click(screen.getByTestId('reward-claim-button'));
    expect(h.mounts).toBe(1);

    h.claims = [];
    rerender();
    expect(screen.queryByTestId('stake-rewards-section')).toBeNull();
    expect(screen.getByTestId('claim-modal-stub')).toBeTruthy();

    h.claims = [claim(0n, USDS, 3n, 'USDS')];
    rerender();
    expect(h.mounts).toBe(1);
    expect(h.unmounts).toBe(0);
  });

  it('closes the launcher even while the rewards are empty', () => {
    h.claims = [claim(0n, USDS, 3n, 'USDS')];
    const { rerender } = renderSection();
    fireEvent.click(screen.getByTestId('reward-claim-button'));

    h.claims = [];
    rerender();
    // Mounted, so its close interlock still sees the modal close.
    expect(screen.getByTestId('claim-modal-stub')).toBeTruthy();
    act(() => (h.modalProps?.onClose as () => void)());
    expect(screen.queryByTestId('claim-modal-stub')).toBeNull();

    h.claims = [claim(0n, USDS, 3n, 'USDS')];
    rerender();
    expect(screen.queryByTestId('claim-modal-stub')).toBeNull();
  });

  it('relaunches on every click so a minimized claim comes back', () => {
    h.claims = [claim(0n, USDS, 3n, 'USDS')];
    renderSection();
    fireEvent.click(screen.getByTestId('reward-claim-button'));
    fireEvent.click(screen.getByTestId('reward-claim-button'));
    expect(h.mounts).toBe(2);
    expect(h.unmounts).toBe(1);
  });
});
