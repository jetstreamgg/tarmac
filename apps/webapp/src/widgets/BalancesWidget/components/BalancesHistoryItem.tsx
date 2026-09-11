import { formatUnits } from 'viem';
import { formatDistanceToNowStrict } from 'date-fns';
import { getEtherscanLink, getCowExplorerLink, getChainIcon, formatUsd } from '@/utils';
import { TokenIcon } from '@/widgets/shared/components/ui/token/TokenIcon';
import {
  ModuleEnum,
  TransactionTypeEnum,
  CombinedHistoryItem,
  useRewardContractTokens,
  usePrices,
  StUsdsProviderType
} from '@/hooks';
import { getTitle } from '../lib/getTitle';
import { getAmount, getRawAmount } from '../lib/getAmount';
import { getToken } from '../lib/getToken';
import { getHistoryRightText } from '../lib/getHistoryRightText';
import { Skeleton } from '@/components/ui/skeleton';
import { IconboxAction } from '@/components/ui/iconbox';
import { TransactionActionIcon } from '@/components/product/TransactionActionIcon';
import { isPositive } from '@/modules/portfolio/helpers/transactionRow';

interface BalancesHistoryItemProps {
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  /** Absolute date, kept for the accessible title; the visible line is relative. */
  formattedDate: string;
  chainId?: number;
  savingsToken?: string;
  tradeFromToken?: string;
  rewardContract?: `0x${string}`;
  item: CombinedHistoryItem;
}

/**
 * One wallet-drawer Activity row (Figma 2829:133281, hover 2829:133574): the
 * action iconbox, the title over a relative time, and the token amount over
 * its USD value. The card is a link to the explorer; at rest it has no
 * surface, on hover it takes the bg-secondary tint and a pointer.
 */
export const BalancesHistoryItem: React.FC<BalancesHistoryItemProps> = ({
  transactionHash,
  module,
  type,
  formattedDate,
  chainId,
  savingsToken,
  tradeFromToken,
  rewardContract,
  item
}) => {
  const { data: rewardContractTokens, isLoading: isLoadingRewardContractTokens } =
    useRewardContractTokens(rewardContract);
  const { data: prices } = usePrices();

  const isHistoryRightTextLoading =
    [TransactionTypeEnum.STAKE_REWARD, TransactionTypeEnum.REWARD].includes(type) &&
    isLoadingRewardContractTokens;

  const isCowSwapTrade = type === TransactionTypeEnum.TRADE && 'cowOrderStatus' in item;

  const href = isCowSwapTrade
    ? getCowExplorerLink(chainId || 1, transactionHash)
    : getEtherscanLink(chainId || 1, transactionHash, 'tx');

  const provider = 'provider' in item ? (item.provider as StUsdsProviderType | undefined) : undefined;
  const isCurveProvider = provider === StUsdsProviderType.CURVE;
  const rewardToken = rewardContractTokens?.rewardsToken.symbol;

  // Delegate / reward selections and position opens carry an address or
  // nothing instead of an amount; those keep the legacy right text as-is.
  const amount = getAmount({ item, type, chainId: chainId || 1 });
  const tokenSymbol = getToken({ item, type, tradeFromToken, savingsToken, rewardToken });
  const hasAmount = !!amount && !!tokenSymbol;
  const raw = hasAmount ? getRawAmount({ item, type, chainId: chainId || 1 }) : undefined;
  const price = raw ? prices?.[tokenSymbol]?.price : undefined;
  const usdValue = raw && price ? Number(formatUnits(raw.value, raw.decimals)) * Number(price) : undefined;

  const timestamp = 'blockTimestamp' in item ? item.blockTimestamp : undefined;
  const relativeTime = timestamp ? formatDistanceToNowStrict(timestamp, { addSuffix: true }) : formattedDate;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={formattedDate}
      className="hover:bg-bgSecondary flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl p-4 transition-colors"
      data-testid="wallet-activity-item"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <IconboxAction>
            <TransactionActionIcon module={module} positive={isPositive(type)} />
          </IconboxAction>
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4">
            {getChainIcon(chainId || 1, 'h-full w-full')}
          </span>
          {isCurveProvider && (
            <img
              src="/history-icons/curve-badge.svg"
              alt=""
              className="absolute -top-0.5 -right-0.5 size-4"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-fgPrimary font-circle truncate text-base leading-[18px] font-medium tracking-[-0.32px]">
            {getTitle({ type, module })}
          </span>
          <span className="text-fgSecondary font-graphik text-xs leading-[18px]">{relativeTime}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {isHistoryRightTextLoading ? (
          <Skeleton className="h-[22px] w-20" />
        ) : hasAmount ? (
          <>
            <span className="text-fgPrimary font-circle flex items-center gap-1 text-lg leading-[22px] font-medium tracking-[-0.36px]">
              <TokenIcon token={{ symbol: tokenSymbol }} className="size-4" width={16} noChain />
              {amount}
            </span>
            {usdValue !== undefined && (
              <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
                {formatUsd(usdValue)}
              </span>
            )}
          </>
        ) : (
          // Delegate/reward selections read as an address: quieter, body font.
          <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
            {getHistoryRightText({
              item,
              type,
              tradeFromToken,
              savingsToken,
              rewardToken,
              chainId: chainId || 1
            })}
          </span>
        )}
      </div>
    </a>
  );
};
