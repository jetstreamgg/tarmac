import { useState } from 'react';
import { getEtherscanLink, formatAddress, getCowExplorerLink, getExplorerName } from '@jetstreamgg/sky-utils';
import { Card } from '@widgets/components/ui/card';
import { LinkExternal } from '@widgets/shared/components/icons/LinkExternal';
import { Text } from '@widgets/shared/components/ui/Typography';
import { getPositive } from '../lib/getPositive';
import { ModuleEnum, TransactionTypeEnum, CombinedHistoryItem } from '@jetstreamgg/sky-hooks';
import { getHistoryIconSource } from '../lib/getHistoryIconSource';
import { getTitle } from '../lib/getTitle';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { getHistoryRightText } from '../lib/getHistoryRightText';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { Avatar, AvatarImage } from '@widgets/components/ui/avatar';

interface BalancesHistoryItemProps {
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  formattedDate: string;
  chainId?: number;
  savingsToken?: string;
  tradeFromToken?: string;
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
  item,
  onExternalLinkClicked
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const href =
    type === TransactionTypeEnum.TRADE && !isL2ChainId(chainId || 1)
      ? getCowExplorerLink(chainId || 1, transactionHash)
      : getEtherscanLink(chainId || 1, transactionHash, 'tx');

  const explorerName = getExplorerName(chainId || 1, false);
  const positive = getPositive({ type });
  const iconSrc = getHistoryIconSource({ type, module, chainId: chainId || 1 });
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
            <Avatar className="bg-transparent">
              <AvatarImage src={iconSrc} alt={getTitle({ type, module })} />
            </Avatar>
          </div>
          <div className="flex w-full items-center justify-between">
            <div>
              <Text>{getTitle({ type, module })}</Text>
              {isHovered ? (
                <div className="text-textEmphasis flex items-center">
                  <Text variant="small" className="mr-[7px]">
                    View on
                    {module === ModuleEnum.TRADE && !isL2ChainId(chainId || 1)
                      ? ' Cow Explorer'
                      : ` ${explorerName}`}
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
              <Text className={positive ? 'text-bullish' : ''}>
                <span>{positive ? '+' : positive === false ? '-' : ''}</span>
                <span className="ml-[2px]">
                  {getHistoryRightText({ item, type, tradeFromToken, savingsToken, chainId: chainId || 1 })}
                </span>
              </Text>
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
