import { useState } from 'react';
import { getEtherscanLink, formatAddress, getCowExplorerLink, getExplorerName } from '@jetstreamgg/sky-utils';
import { Card } from '@widgets/components/ui/card';
import { LinkExternal } from '@widgets/shared/components/icons/LinkExternal';
import { Text } from '@widgets/shared/components/ui/Typography';
import { getPositive } from '../lib/getPositive';
import {
  ModuleEnum,
  TransactionTypeEnum,
  CombinedHistoryItem,
  useRewardContractTokens,
  StUsdsProviderType
} from '@jetstreamgg/sky-hooks';
import { getHistoryIconSource } from '../lib/getHistoryIconSource';
import { getTitle } from '../lib/getTitle';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { getHistoryRightText } from '../lib/getHistoryRightText';
import { Avatar, AvatarImage } from '@widgets/components/ui/avatar';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { useChainImage } from '@widgets/shared/hooks/useChainImage';

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
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
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
  item,
  onExternalLinkClicked
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
  const iconSrc = getHistoryIconSource({ type, module });
  const chainImageSrc = useChainImage(chainId || 1);
  const curveBadgeSrc = 'history-icons/curve-badge.svg';

  return (
    <ExternalLink
      href={href}
      showIcon={false}
      className="w-full"
      wrapperClassName="w-full justify-stretch"
      onExternalLinkClicked={onExternalLinkClicked}
    >
      <Card
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        variant="history"
        className="w-full"
      >
        <div className="flex items-center">
          <div className="mr-3">
            <Avatar className="relative">
              <div className="bg-textSecondary/25 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full">
                <AvatarImage src={iconSrc} alt={getTitle({ type, module })} className="h-4 w-4" />
              </div>
              {chainImageSrc && (
                <Avatar className="absolute right-0 bottom-0.5 h-[40%] w-[40%]">
                  <AvatarImage src={chainImageSrc} alt="chain-icon" className="h-full w-full" />
                </Avatar>
              )}
              {isCurveProvider && (
                <Avatar className="absolute top-0 right-0 h-[40%] w-[40%]">
                  <AvatarImage src={curveBadgeSrc} alt="curve-badge" className="h-full w-full" />
                </Avatar>
              )}
            </Avatar>
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
