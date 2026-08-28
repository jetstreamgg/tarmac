import { useState } from 'react';
import { getEtherscanLink, formatAddress, getCowExplorerLink, getExplorerName, getChainIcon } from '@/utils';
import { Card } from '@/widgets/components/ui/card';
import { LinkExternal } from '@/widgets/shared/components/icons/LinkExternal';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { getPositive } from '../lib/getPositive';
import {
  ModuleEnum,
  TransactionTypeEnum,
  CombinedHistoryItem,
  useRewardContractTokens,
  StUsdsProviderType
} from '@/hooks';
import { getTitle } from '../lib/getTitle';
import { ExternalLink } from '@/widgets/shared/components/ExternalLink';
import { getHistoryRightText } from '../lib/getHistoryRightText';
import { Skeleton } from '@/components/ui/skeleton';
import { IconboxAction } from '@/components/ui/iconbox';
import { TransactionActionIcon } from '@/components/product/TransactionActionIcon';
import { isPositive } from '@/modules/portfolio/helpers/transactionRow';

interface BalancesHistoryItemProps {
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  formattedDate: string;
  chainId?: number;
  savingsToken?: string;
  tradeFromToken?: string;
  rewardContract?: `0x${string}`;
  item: CombinedHistoryItem;
}

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
  const [isHovered, setIsHovered] = useState(false);
  const { data: rewardContractTokens, isLoading: isLoadingRewardContractTokens } =
    useRewardContractTokens(rewardContract);

  const isHistoryRightTextLoading =
    [TransactionTypeEnum.STAKE_REWARD, TransactionTypeEnum.REWARD].includes(type) &&
    isLoadingRewardContractTokens;

  const isCowSwapTrade = type === TransactionTypeEnum.TRADE && 'cowOrderStatus' in item;

  const href = isCowSwapTrade
    ? getCowExplorerLink(chainId || 1, transactionHash)
    : getEtherscanLink(chainId || 1, transactionHash, 'tx');

  const explorerName = getExplorerName(chainId || 1, false);
  const positive = getPositive({ type });
  const provider = 'provider' in item ? (item.provider as StUsdsProviderType | undefined) : undefined;
  const isCurveProvider = provider === StUsdsProviderType.CURVE;

  return (
    <ExternalLink href={href} showIcon={false} className="w-full" wrapperClassName="w-full justify-stretch">
      <Card
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        variant="history"
        className="w-full"
      >
        <div className="flex items-center">
          <div className="relative mr-3 shrink-0">
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
          <div className="flex w-full items-center justify-between">
            <div>
              <Text>{getTitle({ type, module })}</Text>
              {isHovered ? (
                <div className="text-textEmphasis flex items-center">
                  <Text variant="small" className="mr-[7px]">
                    View on
                    {isCowSwapTrade ? ' Cow Explorer' : ` ${explorerName}`}
                  </Text>
                  <LinkExternal boxSize={12} />
                </div>
              ) : (
                <Text variant="small" className="text-textSecondary">
                  {formatAddress(transactionHash, 6, 6)}
                </Text>
              )}
            </div>
            <div className="text-right">
              {isHistoryRightTextLoading ? (
                <Skeleton />
              ) : (
                <Text className={positive ? 'text-bullish' : ''}>
                  <span>{positive ? '+' : positive === false ? '-' : ''}</span>
                  <span className="ml-[2px]">
                    {getHistoryRightText({
                      item,
                      type,
                      tradeFromToken,
                      savingsToken,
                      rewardToken: rewardContractTokens?.rewardsToken.symbol,
                      chainId: chainId || 1
                    })}
                  </span>
                </Text>
              )}
              <Text variant="small" className="text-textSecondary">
                {formattedDate}
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </ExternalLink>
  );
};
