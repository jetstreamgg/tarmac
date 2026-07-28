import { t } from '@lingui/core/macro';
import {
  CombinedHistoryItem,
  ModuleEnum,
  PENDLE_MARKETS,
  TransactionTypeEnum,
  getTokenDecimals
} from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, getCowExplorerLink, getEtherscanLink } from '@/utils';

/**
 * Flat, display-ready row for the Portfolio Transactions table (D8/APP-391),
 * normalized from the `CombinedHistoryItem` discriminated union returned by
 * `useAllNetworksCombinedHistory`. The union-narrowing here is a faithful port
 * of the wallet activity modal's `getTitle` / `getAmount` / `getToken` and its
 * CoW-vs-Etherscan link branch (`widgets/BalancesWidget/lib` +
 * `BalancesHistoryItem`); it is re-implemented in the module layer on purpose
 * so this feature doesn't couple to the widget tree that is being retired.
 * Keep the two in sync until the widget history is removed.
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
  /** Symbol driving the TokenIcon; differs from `symbol` when that isn't a
      real token (Pendle rows carry the market *name*, which has no icon). */
  iconSymbol: string;
  /** Formatted token amount (compact, absolute); empty for admin/no-value events. */
  amount: string;
  /** `$`-prefixed USD, present only for $1-pegged tokens. */
  usd?: string;
  status: PortfolioTxStatus;
  /** Deposit-style (true) vs withdraw-style (false) — drives the action icon only. */
  positive?: boolean;
  /** Explorer link: the CoW explorer for CoW orders (whose `txHash` is an order UID), Etherscan otherwise. */
  explorerHref: string;
}

// The history items carry a `Token` shaped slightly differently from the one
// `getTokenDecimals` expects (a second Token type in the codebase); bridge them
// the same way the widget helpers do.
type TokenArg = Parameters<typeof getTokenDecimals>[0];

// True $1-pegged tokens whose formatted amount doubles as its USD value. sUSDS /
// sUSDT are yield-bearing shares worth more than $1, so they are excluded (a
// Pendle row carries `underlyingSymbol: 'sUSDS'`, which must not read as $1).
const STABLES = new Set(['USDS', 'USDC', 'USDT', 'DAI', 'USDL']);

// Administrative events (open position, pick a delegate/reward) record no value
// movement, so they carry no amount — mirrors getAmount's select-guard.
const NO_VALUE_TYPES = new Set<TransactionTypeEnum>([
  TransactionTypeEnum.OPEN,
  TransactionTypeEnum.STAKE_OPEN,
  TransactionTypeEnum.SELECT_DELEGATE,
  TransactionTypeEnum.SELECT_REWARD,
  TransactionTypeEnum.STAKE_SELECT_DELEGATE,
  TransactionTypeEnum.STAKE_SELECT_REWARD
]);

const absBigInt = (v: bigint): bigint => (v < 0n ? -v : v);

// Pendle rows display the market name as `symbol` ("Fixed Yield"), which is
// not a token — resolve the market's underlying (sUSDS) for the icon, the
// same token the /earn/fixed product page uses (APP-426 item 6).
const PENDLE_UNDERLYING_BY_MARKET: Record<string, string> = Object.fromEntries(
  PENDLE_MARKETS.map(m => [m.marketAddress.toLowerCase(), m.underlyingSymbol])
);

function iconSymbol(item: CombinedHistoryItem, symbol: string): string {
  if (item.module === ModuleEnum.PENDLE && 'marketAddress' in item && item.marketAddress) {
    return PENDLE_UNDERLYING_BY_MARKET[String(item.marketAddress).toLowerCase()] ?? symbol;
  }
  return symbol;
}

function actionLabel(item: CombinedHistoryItem): string {
  const { type, module } = item;
  switch (type) {
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.MKR_TO_SKY:
      return t`Upgrade`;
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.USDS_TO_DAI:
      return t`Revert`;
    case TransactionTypeEnum.TRADE:
      return t`Trade`;
    case TransactionTypeEnum.SUPPLY:
      if (module === ModuleEnum.REWARDS) return t`Rewards Supply`;
      if (module === ModuleEnum.SAVINGS) return t`Savings Supply`;
      if (module === ModuleEnum.STUSDS) return t`stUSDS Supply`;
      if (module === ModuleEnum.MORPHO || module === ModuleEnum.SUSDT) return t`Vault Supply`;
      return t`Supply`;
    case TransactionTypeEnum.WITHDRAW:
      if (module === ModuleEnum.REWARDS) return t`Rewards Withdraw`;
      if (module === ModuleEnum.SAVINGS) return t`Savings Withdraw`;
      if (module === ModuleEnum.STUSDS) return t`stUSDS Withdraw`;
      if (module === ModuleEnum.MORPHO || module === ModuleEnum.SUSDT) return t`Vault Withdraw`;
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
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
      return t`Select delegate`;
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return t`Select reward`;
    case TransactionTypeEnum.UNSTAKE_KICK:
      return t`Liquidation`;
    case TransactionTypeEnum.PENDLE_BUY:
      return t`Fixed Yield Buy`;
    case TransactionTypeEnum.PENDLE_SELL:
      return t`Fixed Yield Sell`;
    case TransactionTypeEnum.PENDLE_REDEEM:
      return t`Fixed Yield Redeem`;
    default:
      // Same fallback as getTitle: humanize the enum value.
      return capitalizeFirstLetter((type || module).toLowerCase().replace('_', ' '));
  }
}

/** `${chainId}-${lowercased contract address}` → reward token symbol. */
export type RewardTokenLookup = Record<string, string>;

function tokenSymbol(item: CombinedHistoryItem, rewardTokenByContract?: RewardTokenLookup): string {
  // Reward claims are paid in the contract's reward token (SPK / GROVE / …),
  // but the history item only carries the contract address — resolve it, like
  // the legacy BalancesHistoryItem did via useRewardContractTokens. Its
  // fallback (the original SKY-paying contract) is kept for unknown contracts.
  if (
    item.type === TransactionTypeEnum.REWARD &&
    'rewardContractAddress' in item &&
    item.rewardContractAddress
  ) {
    const chainId = 'chainId' in item ? item.chainId : 1;
    return rewardTokenByContract?.[`${chainId}-${String(item.rewardContractAddress).toLowerCase()}`] ?? 'SKY';
  }
  if ('token' in item && item.token) return item.token.symbol;
  if ('fromToken' in item && item.fromToken) return item.fromToken.symbol;
  if ('underlyingSymbol' in item && item.underlyingSymbol) return item.underlyingSymbol;
  switch (item.type) {
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.UNSTAKE:
    case TransactionTypeEnum.UNSTAKE_KICK:
      return 'SKY';
    default:
      return 'USDS';
  }
}

function amountString(item: CombinedHistoryItem, chainId: number): string {
  if (NO_VALUE_TYPES.has(item.type)) return '';
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

// Deposit-style (true) vs withdraw-style (false); undefined = no direction. Drives
// only the action icon (in/out), not the amount color.
function isPositive(type: TransactionTypeEnum): boolean | undefined {
  switch (type) {
    case TransactionTypeEnum.STAKE_OPEN:
    case TransactionTypeEnum.UNSTAKE_KICK:
    case TransactionTypeEnum.OPEN:
    case TransactionTypeEnum.SELECT_DELEGATE:
    case TransactionTypeEnum.SELECT_REWARD:
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
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

export function toPortfolioTxRow(
  item: CombinedHistoryItem,
  index: number,
  rewardTokenByContract?: RewardTokenLookup
): PortfolioTxRow {
  // ParsedTradeRecord omits chainId in its *type*, but every runtime producer
  // (cowswap / psm / hybrid) attaches it, so `'chainId' in item` reads it; the
  // `: 1` is only a defensive default.
  const chainId = 'chainId' in item ? item.chainId : 1;
  const symbol = tokenSymbol(item, rewardTokenByContract);
  const amount = amountString(item, chainId);
  // CoW orders store an order UID in `transactionHash`, which resolves on the
  // CoW explorer, not Etherscan (mirrors BalancesHistoryItem).
  const explorerHref =
    'cowOrderStatus' in item
      ? getCowExplorerLink(chainId, item.transactionHash)
      : getEtherscanLink(chainId, item.transactionHash, 'tx');
  return {
    id: `${item.transactionHash}-${item.module}-${item.type}-${index}`,
    txHash: item.transactionHash,
    timestamp: item.blockTimestamp,
    module: item.module,
    type: item.type,
    chainId,
    action: actionLabel(item),
    symbol,
    iconSymbol: iconSymbol(item, symbol),
    amount,
    usd: amount && STABLES.has(symbol.toUpperCase()) ? `$${amount}` : undefined,
    status: txStatus(item),
    positive: isPositive(item.type),
    explorerHref
  };
}
