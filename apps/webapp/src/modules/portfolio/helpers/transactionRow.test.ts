import { describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { ModuleEnum, TransactionTypeEnum, type CombinedHistoryItem } from '@/hooks';
import { getCowExplorerLink, getEtherscanLink } from '@/utils';
import { toPortfolioTxRow } from './transactionRow';

i18n.load('en', {});
i18n.activate('en');

// Real history tokens carry `decimals`; the number form short-circuits the
// per-chain lookup in getTokenDecimals.
const base = { blockTimestamp: new Date(0), transactionHash: '0xabc' };
const asItem = (o: object) => o as unknown as CombinedHistoryItem;

describe('toPortfolioTxRow', () => {
  it('normalizes a savings supply (stablecoin → USD present, positive)', () => {
    const row = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.SAVINGS,
        type: TransactionTypeEnum.SUPPLY,
        chainId: 1,
        assets: 1000000000n * 10n ** 12n, // 1,000,000 at 18dp
        token: { symbol: 'USDS', decimals: 18 }
      }),
      0
    );
    expect(row.action).toBe('Savings Supply');
    expect(row.symbol).toBe('USDS');
    expect(row.chainId).toBe(1);
    expect(row.status).toBe('completed');
    expect(row.positive).toBe(true);
    expect(row.usd).toBe(`$${row.amount}`); // stablecoin: USD mirrors the amount
  });

  it('normalizes a withdraw as negative and keeps USD for stables', () => {
    const row = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.MORPHO,
        type: TransactionTypeEnum.WITHDRAW,
        chainId: 8453,
        assets: -5n * 10n ** 18n,
        token: { symbol: 'USDC', decimals: 18 }
      }),
      0
    );
    expect(row.action).toBe('Vault Withdraw');
    expect(row.positive).toBe(false);
    expect(row.chainId).toBe(8453);
    expect(row.usd).toBeDefined();
  });

  it('reads chainId from trade rows and links CoW orders to the CoW explorer', () => {
    const r = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.TRADE,
        type: TransactionTypeEnum.TRADE,
        chainId: 8453, // trade producers attach chainId at runtime (type omits it)
        transactionHash: '0xorderuid',
        fromAmount: 10n * 10n ** 18n,
        fromToken: { symbol: 'USDS', decimals: 18 },
        cowOrderStatus: 'Open' // formatOrderStatus string, not the enum
      }),
      0
    );
    expect(r.action).toBe('Trade');
    expect(r.chainId).toBe(8453);
    expect(r.status).toBe('pending');
    // CoW txHash is an order UID → CoW explorer, not Etherscan.
    expect(r.explorerHref).toBe(getCowExplorerLink(8453, '0xorderuid'));
  });

  it('marks a fulfilled trade completed and a cancelled/expired trade failed', () => {
    const mk = (s: string) =>
      toPortfolioTxRow(
        asItem({
          ...base,
          module: ModuleEnum.TRADE,
          type: TransactionTypeEnum.TRADE,
          fromAmount: 1n,
          fromToken: { symbol: 'USDS', decimals: 18 },
          cowOrderStatus: s
        }),
        0
      ).status;
    expect(mk('Fulfilled')).toBe('completed');
    expect(mk('Cancelled')).toBe('failed');
    expect(mk('Expired')).toBe('failed');
  });

  it('handles a token-less upgrade row (SKY, no USD column)', () => {
    const row = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.UPGRADE,
        type: TransactionTypeEnum.MKR_TO_SKY,
        chainId: 1,
        skyAmt: 24000n * 10n ** 18n
      }),
      0
    );
    expect(row.action).toBe('Upgrade');
    expect(row.symbol).toBe('SKY');
    expect(row.usd).toBeUndefined(); // SKY is not a $1-pegged stablecoin
    expect(row.positive).toBe(true);
  });

  it('labels pendle rows and reads the underlying symbol', () => {
    const row = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.PENDLE,
        type: TransactionTypeEnum.PENDLE_BUY,
        chainId: 1,
        assets: 100n * 10n ** 18n,
        underlyingSymbol: 'USDS',
        underlyingDecimals: 18
      }),
      0
    );
    expect(row.action).toBe('Fixed Yield Buy');
    expect(row.symbol).toBe('USDS');
    expect(row.positive).toBe(true);
  });

  it('excludes yield-bearing sUSDS from the USD column', () => {
    const r = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.PENDLE,
        type: TransactionTypeEnum.PENDLE_BUY,
        chainId: 1,
        assets: 100n * 10n ** 18n,
        underlyingSymbol: 'sUSDS',
        underlyingDecimals: 18
      }),
      0
    );
    expect(r.symbol).toBe('sUSDS');
    expect(r.usd).toBeUndefined(); // sUSDS is worth >$1, not a stablecoin
  });

  it('labels a stake select-delegate row and carries no amount', () => {
    const r = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.STAKE,
        type: TransactionTypeEnum.STAKE_SELECT_DELEGATE,
        chainId: 1
      }),
      0
    );
    expect(r.action).toBe('Select delegate');
    expect(r.amount).toBe('');
  });

  it('uses SKY as the unit for a liquidation (UNSTAKE_KICK)', () => {
    const r = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.STAKE,
        type: TransactionTypeEnum.UNSTAKE_KICK,
        chainId: 1,
        amount: 5n * 10n ** 18n
      }),
      0
    );
    expect(r.action).toBe('Liquidation');
    expect(r.symbol).toBe('SKY');
  });

  it('links non-CoW rows to the block explorer', () => {
    const r = toPortfolioTxRow(
      asItem({
        ...base,
        module: ModuleEnum.SAVINGS,
        type: TransactionTypeEnum.SUPPLY,
        chainId: 1,
        assets: 1n,
        token: { symbol: 'USDS', decimals: 18 }
      }),
      0
    );
    expect(r.explorerHref).toBe(getEtherscanLink(1, r.txHash, 'tx'));
  });

  it('builds a stable id from hash + module + type + index', () => {
    const item = asItem({
      ...base,
      module: ModuleEnum.SAVINGS,
      type: TransactionTypeEnum.SUPPLY,
      chainId: 1,
      assets: 1n,
      token: { symbol: 'USDS', decimals: 18 }
    });
    expect(toPortfolioTxRow(item, 3).id).toBe('0xabc-SAVINGS-SUPPLY-3');
  });
});
