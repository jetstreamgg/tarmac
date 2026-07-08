import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionTypeEnum } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

const HISTORY = [
  // One multicall: open + lock + draw => "Stake & Borrow".
  {
    type: TransactionTypeEnum.STAKE_OPEN,
    transactionHash: '0xaaa1',
    blockTimestamp: new Date('2026-07-07T10:00:00Z'),
    urnIndex: 0
  },
  {
    type: TransactionTypeEnum.STAKE,
    amount: 700000n * 10n ** 18n,
    transactionHash: '0xaaa1',
    blockTimestamp: new Date('2026-07-07T10:00:00Z'),
    urnIndex: 0
  },
  {
    type: TransactionTypeEnum.STAKE_BORROW,
    amount: 30000n * 10n ** 18n,
    transactionHash: '0xaaa1',
    blockTimestamp: new Date('2026-07-07T10:00:00Z'),
    urnIndex: 0
  },
  // Lock-only tx => "Stake".
  {
    type: TransactionTypeEnum.STAKE,
    amount: 15500n * 10n ** 18n,
    transactionHash: '0xbbb2',
    blockTimestamp: new Date('2026-07-06T10:00:00Z'),
    urnIndex: 1
  },
  // Free + wipe in one tx => "Unstake & Repay".
  {
    type: TransactionTypeEnum.UNSTAKE,
    amount: 700000n * 10n ** 18n,
    transactionHash: '0xccc3',
    blockTimestamp: new Date('2026-07-05T10:00:00Z'),
    urnIndex: 0
  },
  {
    type: TransactionTypeEnum.STAKE_REPAY,
    amount: 30000n * 10n ** 18n,
    transactionHash: '0xccc3',
    blockTimestamp: new Date('2026-07-05T10:00:00Z'),
    urnIndex: 0
  },
  // Claim-only tx => "Claim rewards".
  {
    type: TransactionTypeEnum.STAKE_REWARD,
    amount: 10n * 10n ** 18n,
    rewardContract: '0x2222222222222222222222222222222222222222',
    transactionHash: '0xddd4',
    blockTimestamp: new Date('2026-07-04T10:00:00Z'),
    urnIndex: 1
  }
];

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistory: () => ({ data: HISTORY, isLoading: false, error: null }),
    useSkyPrice: () => ({ data: 10n ** 18n, priceString: '1', isLoading: false, error: null })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakeActivityTable, groupStakeActivity } from './StakeActivityTable';

const renderTable = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeActivityTable
        positions={[
          { index: 0, skyLocked: 1n, usdsDebt: 1n, barks: [], lastMutationTimestamp: undefined },
          { index: 1, skyLocked: 1n, usdsDebt: 0n, barks: [], lastMutationTimestamp: undefined }
        ]}
      />
    </I18nProvider>
  );

describe('groupStakeActivity', () => {
  it('groups events by transaction hash and derives the combined verbs', () => {
    const groups = groupStakeActivity(HISTORY);

    expect(groups.map(group => group.verb)).toEqual(['stakeBorrow', 'stake', 'unstakeRepay', 'claim']);
    expect(groups[0]).toMatchObject({
      transactionHash: '0xaaa1',
      urnIndex: 0,
      skyAmount: 700000n * 10n ** 18n,
      usdsAmount: 30000n * 10n ** 18n
    });
    expect(groups[2]).toMatchObject({
      verb: 'unstakeRepay',
      skyAmount: 700000n * 10n ** 18n,
      usdsAmount: 30000n * 10n ** 18n
    });
  });

  it('derives single-sided verbs', () => {
    const borrowOnly = groupStakeActivity([
      {
        type: TransactionTypeEnum.STAKE_BORROW,
        amount: 5888n * 10n ** 18n,
        transactionHash: '0xeee5',
        blockTimestamp: new Date('2026-07-03T10:00:00Z'),
        urnIndex: 0
      }
    ]);
    expect(borrowOnly[0].verb).toBe('borrow');

    const repayOnly = groupStakeActivity([
      {
        type: TransactionTypeEnum.STAKE_REPAY,
        amount: 30000n * 10n ** 18n,
        transactionHash: '0xfff6',
        blockTimestamp: new Date('2026-07-02T10:00:00Z'),
        urnIndex: 2
      }
    ]);
    expect(repayOnly[0].verb).toBe('repay');
  });

  it('sorts groups newest-first and keeps the group timestamp', () => {
    const groups = groupStakeActivity([...HISTORY].reverse());
    expect(groups.map(group => group.transactionHash)).toEqual(['0xaaa1', '0xbbb2', '0xccc3', '0xddd4']);
  });
});

describe('StakeActivityTable', () => {
  afterEach(cleanup);

  it('renders grouped verbs with per-position sublines', () => {
    renderTable();

    expect(screen.getByTestId('stake-activity-table')).toBeTruthy();
    expect(screen.getByText('Stake & Borrow')).toBeTruthy();
    expect(screen.getByText('Stake')).toBeTruthy();
    expect(screen.getByText('Unstake & Repay')).toBeTruthy();
    expect(screen.getByText('Claim rewards')).toBeTruthy();
    // Confirmed-only rows: every status pill reads Completed.
    expect(screen.getAllByText('Completed').length).toBe(4);
  });

  it('filters rows to a single position', () => {
    renderTable();

    // The native select fallback isn't used — drive the Radix select via keyboard-free
    // testid selection: open the trigger and click the Position 2 item.
    fireEvent.click(screen.getByTestId('stake-activity-filter'));
    fireEvent.click(screen.getByTestId('stake-activity-filter-1'));

    expect(screen.queryByText('Stake & Borrow')).toBeNull();
    expect(screen.getByText('Stake')).toBeTruthy();
    expect(screen.getByText('Claim rewards')).toBeTruthy();
  });
});
