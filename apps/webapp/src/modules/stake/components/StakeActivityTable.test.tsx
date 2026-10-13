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
    useChainId: () => 1,
    useAccount: () => ({ isConnected: true })
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

// Position 1 (index 0) carries debt at Medium risk; position 2 is staking-only.
vi.mock('../hooks/useStakeRowVault', async () => {
  const { RiskLevel } = await import('@/hooks');
  return {
    useStakeRowVault: (position: { index: number }) => ({
      data: position.index === 0 ? { riskLevel: RiskLevel.MEDIUM } : undefined,
      isLoading: false,
      error: null
    })
  };
});

import { StakeActivityTable, toStakeActivityItems } from './StakeActivityTable';
import { lsSkyUsdsRewardAddress } from '@/hooks';

const URN_0 = '0x1111111111111111111111111111111111111111' as const;
const URN_1 = '0x3333333333333333333333333333333333333333' as const;
const POSITIONS = [
  { index: 0, urnAddress: URN_0, skyLocked: 1n, usdsDebt: 1n, barks: [], lastMutationTimestamp: undefined },
  { index: 1, urnAddress: URN_1, skyLocked: 1n, usdsDebt: 0n, barks: [], lastMutationTimestamp: undefined }
];

const renderTable = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeActivityTable positions={POSITIONS} />
    </I18nProvider>
  );

describe('toStakeActivityItems', () => {
  it('gives each event of a batched transaction its own row under the same hash', () => {
    const items = toStakeActivityItems(HISTORY, { chainId: 1, positions: POSITIONS });

    expect(items.map(item => [item.transactionHash, item.action])).toEqual([
      ['0xaaa1', 'stake'],
      ['0xaaa1', 'borrow'],
      ['0xbbb2', 'stake'],
      ['0xccc3', 'repay'],
      ['0xccc3', 'unstake'],
      ['0xddd4', 'claim']
    ]);
    expect(items[0]).toMatchObject({ urnIndex: 0, amount: 700000n * 10n ** 18n, token: 'SKY' });
    expect(items[1]).toMatchObject({ urnIndex: 0, amount: 30000n * 10n ** 18n, token: 'USDS' });
    expect(new Set(items.map(item => item.id)).size).toBe(items.length);
  });

  it('keeps the newest-first order whatever order the events arrive in', () => {
    const items = toStakeActivityItems([...HISTORY].reverse(), { chainId: 1 });
    expect(items.map(item => item.action)).toEqual(['stake', 'borrow', 'stake', 'repay', 'unstake', 'claim']);
  });

  it('names the claim token from the farm', () => {
    const [claim] = toStakeActivityItems(
      [{ ...HISTORY[6], rewardContract: lsSkyUsdsRewardAddress[1].toLowerCase() }],
      { chainId: 1 }
    );
    expect(claim.token).toBe('USDS');

    const [unknown] = toStakeActivityItems([HISTORY[6]], { chainId: 1 });
    expect(unknown.token).toBeUndefined();
  });

  it('keeps delegate and reward changes without an amount', () => {
    const items = toStakeActivityItems(
      [
        {
          type: TransactionTypeEnum.STAKE_SELECT_DELEGATE,
          transactionHash: '0xeee5',
          blockTimestamp: new Date('2026-07-03T10:00:00Z'),
          urnIndex: 1
        },
        {
          type: TransactionTypeEnum.STAKE_SELECT_REWARD,
          transactionHash: '0xeee5',
          blockTimestamp: new Date('2026-07-03T10:00:00Z'),
          urnIndex: 1
        }
      ],
      { chainId: 1 }
    );
    expect(items.map(item => [item.action, item.amount])).toEqual([
      ['selectDelegate', undefined],
      ['selectReward', undefined]
    ]);
  });

  it('finds the position of a liquidation through its urn address', () => {
    const kick = {
      type: TransactionTypeEnum.UNSTAKE_KICK,
      amount: 5n * 10n ** 18n,
      urnAddress: URN_1.toUpperCase().replace('0X', '0x'),
      transactionHash: '0xfff6',
      blockTimestamp: new Date('2026-07-02T10:00:00Z')
    };
    expect(toStakeActivityItems([kick], { chainId: 1, positions: POSITIONS })[0]).toMatchObject({
      action: 'liquidated',
      urnIndex: 1,
      token: 'SKY'
    });
    expect(toStakeActivityItems([kick], { chainId: 1 })[0].urnIndex).toBeUndefined();
  });
});

describe('StakeActivityTable', () => {
  afterEach(cleanup);

  it('renders one row per event with a position column and a single amount column', () => {
    renderTable();

    expect(screen.getByTestId('stake-activity-table')).toBeTruthy();
    expect(screen.getByText('Position ID')).toBeTruthy();
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.queryByText('Stake/unstake')).toBeNull();
    expect(screen.queryByText('Stake & Borrow')).toBeNull();
    expect(screen.getAllByText('Stake').length).toBe(2);
    expect(screen.getByText('Borrow')).toBeTruthy();
    expect(screen.getByText('Unstake')).toBeTruthy();
    expect(screen.getByText('Repay')).toBeTruthy();
    expect(screen.getByText('Claim rewards')).toBeTruthy();
    expect(screen.getAllByText('Position 1').length).toBe(4);
    expect(screen.getAllByText('Completed').length).toBe(6);
    // Both rows of the batched open share the hash link.
    expect(screen.getAllByText('0xaaa1...aaa1').length).toBe(2);
  });

  it('splits the header widths in the comp proportions so the hash column keeps its right gutter', () => {
    renderTable();

    const widths = screen.getAllByRole('columnheader').map(th => `${parseFloat(th.style.width).toFixed(2)}%`);
    expect(widths).toEqual(['24.27%', '19.54%', '19.54%', '19.54%', '17.11%']);
  });

  it('filters rows to a single position', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('stake-activity-filter'));
    fireEvent.click(screen.getByTestId('stake-activity-filter-1'));

    expect(screen.queryByText('Borrow')).toBeNull();
    expect(screen.getAllByText('Stake').length).toBe(1);
    expect(screen.getByText('Claim rewards')).toBeTruthy();
  });

  it('tints each position token like the positions list: by risk, staking-only in info', () => {
    renderTable();
    const tokens = screen.getAllByTestId(/^stake-activity-position-/);
    const borderOf = (index: number) =>
      tokens
        .filter(token => token.dataset.testid === `stake-activity-position-${index}`)
        .map(t => t.className);
    expect(borderOf(0).length).toBeGreaterThan(0);
    for (const className of borderOf(0)) expect(className).toContain('border-statusWarningBorder');
    for (const className of borderOf(1)) expect(className).toContain('border-statusInfoBorder');
  });
});
