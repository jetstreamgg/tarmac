import { t } from '@lingui/core/macro';
import { CombinedHistoryItem, ModuleEnum, TransactionTypeEnum, getTokenDecimals } from '@/hooks';
import { formatBigInt } from '@/utils';

// The history items carry a `Token` shaped slightly differently from the one
// `getTokenDecimals` expects (a second Token type in the codebase); bridge them
// the same way the widget helpers do.
type TokenArg = Parameters<typeof getTokenDecimals>[0];

/**
 * Flat, display-ready row for the Portfolio Transactions table (D8/APP-391),
 * normalized from the `CombinedHistoryItem` discriminated union returned by
 * `useAllNetworksCombinedHistory`. The union-narrowing here mirrors the wallet
 * activity modal's `getTitle`/`getAmount`/`getToken`/`getPositive`
 * (`widgets/BalancesWidget/lib`); it is re-implemented in the module layer on
 * purpose so this feature doesn't couple to the widget tree that is being
 * retired. Keep the two in sync until the widget history is removed.
 */
export type PortfolioTxStatus = 'pending' | 'completed' | 'failed';

export interface PortfolioTxRow {
  /** Stable key — a tx hash can carry several events, so compose it. */
  id: string;
  txHash: string;
  timestamp: Date;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  chainId: number;
  /** Translated action label, e.g. "Savings Supply". */
  action: string;
  /** Token symbol for the amount/product cells. */
  symbol: string;
  /** Formatted token amount (compact, absolute). */
  amount: string;
  /** `$`-prefixed USD, present only for $1-pegged tokens. */
  usd?: string;
  status: PortfolioTxStatus;
  /** Amount sign for the bullish/bearish treatment; undefined = no sign. */
  positive?: boolean;
}

// $1-pegged tokens whose formatted amount doubles as its USD value, matching
// the per-product tables (e.g. VaultTransactionsTable: `usd: '$' + amount`).
const STABLES = new Set(['USDS', 'SUSDS', 'USDC', 'USDT', 'SUSDT', 'DAI', 'USDL']);

const absBigInt = (v: bigint): bigint => (v < 0n ? -v : v);

function actionLabel(item: CombinedHistoryItem): string {
  switch (item.type) {
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.MKR_TO_SKY:
      return t`Upgrade`;
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.USDS_TO_DAI:
      return t`Revert`;
    case TransactionTypeEnum.TRADE:
      return t`Trade`;
    case TransactionTypeEnum.SUPPLY:
      if (item.module === ModuleEnum.REWARDS) return t`Rewards Supply`;
      if (item.module === ModuleEnum.SAVINGS) return t`Savings Supply`;
      if (item.module === ModuleEnum.STUSDS) return t`stUSDS Supply`;
      if (item.module === ModuleEnum.MORPHO || item.module === ModuleEnum.SUSDT) return t`Vault Supply`;
      return t`Supply`;
    case TransactionTypeEnum.WITHDRAW:
      if (item.module === ModuleEnum.REWARDS) return t`Rewards Withdraw`;
      if (item.module === ModuleEnum.SAVINGS) return t`Savings Withdraw`;
      if (item.module === ModuleEnum.STUSDS) return t`stUSDS Withdraw`;
      if (item.module === ModuleEnum.MORPHO || item.module === ModuleEnum.SUSDT) return t`Vault Withdraw`;
      return t`Withdraw`;
    case TransactionTypeEnum.REWARD:
    case TransactionTypeEnum.STAKE_REWARD:
      return t`Claim rewards`;
    case TransactionTypeEnum.STAKE:
      return t`Stake`;
    case TransactionTypeEnum.UNSTAKE:
      return t`Unstake`;
    case TransactionTypeEnum.STAKE_OPEN:
      return t`Open position`;
    case TransactionTypeEnum.STAKE_BORROW:
      return t`Borrow`;
    case TransactionTypeEnum.STAKE_REPAY:
      return t`Repay`;
    case TransactionTypeEnum.UNSTAKE_KICK:
      return t`Liquidation`;
    case TransactionTypeEnum.PENDLE_BUY:
      return t`Fixed Yield Buy`;
    case TransactionTypeEnum.PENDLE_SELL:
      return t`Fixed Yield Sell`;
    case TransactionTypeEnum.PENDLE_REDEEM:
      return t`Fixed Yield Redeem`;
    default:
      return t`Transaction`;
  }
}

function tokenSymbol(item: CombinedHistoryItem): string {
  if ('token' in item && item.token) return item.token.symbol;
  if ('fromToken' in item && item.fromToken) return item.fromToken.symbol;
  if ('underlyingSymbol' in item && item.underlyingSymbol) return item.underlyingSymbol;
  switch (item.type) {
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.UNSTAKE:
      return 'SKY';
    default:
      return 'USDS';
  }
}

function amountString(item: CombinedHistoryItem, chainId: number): string {
  switch (item.module) {
    case ModuleEnum.TRADE:
      return formatBigInt(absBigInt('fromAmount' in item ? item.fromAmount : 0n), {
        compact: true,
        unit: getTokenDecimals(('fromToken' in item ? item.fromToken : undefined) as TokenArg, chainId)
      });
    case ModuleEnum.UPGRADE:
      if (item.type === TransactionTypeEnum.MKR_TO_SKY || item.type === TransactionTypeEnum.SKY_TO_MKR) {
        return formatBigInt(absBigInt('skyAmt' in item ? item.skyAmt : 0n), { compact: true });
      }
      return formatBigInt(absBigInt('wad' in item ? item.wad : 0n), { compact: true });
    case ModuleEnum.REWARDS:
    case ModuleEnum.STAKE:
      return formatBigInt(absBigInt('amount' in item ? item.amount : 0n), { compact: true });
    case ModuleEnum.SAVINGS:
    case ModuleEnum.STUSDS:
    case ModuleEnum.MORPHO:
    case ModuleEnum.SUSDT:
      return formatBigInt(absBigInt('assets' in item ? item.assets : 0n), {
        compact: true,
        unit: getTokenDecimals(('token' in item ? item.token : undefined) as TokenArg, chainId)
      });
    case ModuleEnum.PENDLE:
      return formatBigInt(absBigInt('assets' in item ? item.assets : 0n), {
        compact: true,
        unit: 'underlyingDecimals' in item ? item.underlyingDecimals : 18
      });
    default:
      return '';
  }
}

// Sign for the amount's bullish (+) / bearish (−) treatment; undefined = no sign
// (e.g. open-position / select-delegate rows that carry no value).
function isPositive(type: TransactionTypeEnum): boolean | undefined {
  switch (type) {
    case TransactionTypeEnum.STAKE_OPEN:
    case TransactionTypeEnum.UNSTAKE_KICK:
      return undefined;
    case TransactionTypeEnum.SUPPLY:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.REWARD:
    case TransactionTypeEnum.STAKE_REWARD:
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.STAKE_REPAY:
    case TransactionTypeEnum.PENDLE_BUY:
      return true;
    default:
      return false;
  }
}

// Only CoW trades carry a lifecycle status; every other row is an indexed,
// confirmed subgraph transaction. `cowOrderStatus` holds the *formatted* string
// from `formatOrderStatus` (Fulfilled / Open / Signature Pending / Cancelled /
// Expired) — not the OrderStatus enum, despite the field's declared type.
function txStatus(item: CombinedHistoryItem): PortfolioTxStatus {
  if (!('cowOrderStatus' in item)) return 'completed';
  switch (String(item.cowOrderStatus)) {
    case 'Cancelled':
    case 'Expired':
      return 'failed';
    case 'Open':
    case 'Signature Pending':
      return 'pending';
    default:
      // 'Fulfilled' + any settled/unknown historical order.
      return 'completed';
  }
}

export function toPortfolioTxRow(item: CombinedHistoryItem, index: number): PortfolioTxRow {
  // Trade rows (ParsedTradeRecord) don't carry chainId; CoW trades are mainnet.
  const chainId = 'chainId' in item ? item.chainId : 1;
  const symbol = tokenSymbol(item);
  const amount = amountString(item, chainId);
  return {
    id: `${item.transactionHash}-${item.module}-${item.type}-${index}`,
    txHash: item.transactionHash,
    timestamp: item.blockTimestamp,
    module: item.module,
    type: item.type,
    chainId,
    action: actionLabel(item),
    symbol,
    amount,
    usd: amount && STABLES.has(symbol.toUpperCase()) ? `$${amount}` : undefined,
    status: txStatus(item),
    positive: isPositive(item.type)
  };
}
