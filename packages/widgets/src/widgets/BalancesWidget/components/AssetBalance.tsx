import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@widgets/shared/components/ui/Typography';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { Card } from '@widgets/components/ui/card';
import { PriceData } from '@jetstreamgg/sky-hooks';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AssetBalance = ({
  symbol,
  isLoading,
  decimals,
  formatted,
  priceData,
  value,
  chainId,
  actionForToken
}: {
  symbol: string;
  isLoading: boolean;
  decimals: number;
  formatted: string;
  value: bigint;
  priceData: PriceData | undefined;
  chainId: number;
  actionForToken?: (
    symbol: string,
    balance: string,
    tokenChainId: number
  ) => { label: string; actionUrl: string; image: string } | undefined;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const action = useMemo(
    () => actionForToken?.(symbol, formatted, chainId),
    [actionForToken, symbol, formatted, chainId]
  );
  const hasAction = !!action?.label && !!action?.actionUrl && !!action?.image;
  const shouldShowAction = isHovered && hasAction && parseFloat(formatted) !== 0;

  return (
    <motion.div
      variants={positionAnimations}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        className="flex h-[84px] items-center justify-between"
        variant={shouldShowAction ? 'statsInteractive' : 'stats'}
      >
        <>
          <Link to={action?.actionUrl || ''} hidden={!shouldShowAction} className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src={action?.image} alt={`${symbol}-suggested-action`} className="h-[60px]" />
                <Text className="flex items-center">{action?.label}</Text>
              </div>
              <div className="ml-3">
                <ArrowRight size={18} />
              </div>
            </div>
          </Link>
        </>
        <>
          <div className={`flex items-center space-x-2 ${shouldShowAction ? 'hidden' : ''}`}>
            <TokenIcon className="h-8 w-8" token={{ symbol: symbol, name: symbol }} chainId={chainId} />
            <div className="flex flex-col justify-between">
              <Text>{symbol}</Text>
              {isLoading ? (
                <Skeleton className="bg-textSecondary h-5" />
              ) : (
                <Text className="text-textSecondary text-[13px]">
                  {priceData ? `$${formatNumber(parseFloat(priceData.price), { maxDecimals: 2 })}` : '--'}
                </Text>
              )}
            </div>
          </div>
          <div className={`flex flex-col justify-between ${shouldShowAction ? 'hidden' : ''}`}>
            <Text className="text-right font-bold">{formatNumber(parseFloat(formatted))}</Text>
            {isLoading ? (
              <Skeleton className="bg-textSecondary h-5" />
            ) : (
              <Text className="text-textSecondary text-[13px]">
                {priceData
                  ? `$${formatNumber(parseFloat(formatUnits(value, decimals)) * parseFloat(priceData.price), {
                      maxDecimals: 2
                    })}`
                  : '--'}
              </Text>
            )}
          </div>
        </>
      </Card>
    </motion.div>
  );
};
