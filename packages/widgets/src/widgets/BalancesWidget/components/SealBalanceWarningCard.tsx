import { Card, CardContent, CardFooter } from '@widgets/components/ui/card';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { ArrowRight } from 'lucide-react';

export const SealBalanceWarningCard = ({
  url,
  isLoading,
  sealBalance,
  sealValue
}: {
  url?: string;
  isLoading?: boolean;
  sealBalance?: bigint;
  sealValue?: number;
}): React.ReactElement => {
  const isLargeAmount = sealValue && sealValue > 1000000;

  return (
    <Link to={url ?? ''}>
      <Card className="group/warning-seal-card bg-red-400/10 p-4 bg-blend-overlay hover:bg-red-400/25 lg:p-5">
        <div className="flex items-start gap-2">
          <TokenIcon className="h-8 w-8" token={{ symbol: 'MKR', name: 'MKR' }} chainId={1} />{' '}
          <div className="grow">
            <CardContent className="flex flex-col items-start">
              <div className="flex w-full justify-between">
                <Text>
                  <Trans>MKR supplied to the Seal Engine</Trans>
                </Text>
                {isLoading ? (
                  <Skeleton className="w-32" />
                ) : (
                  <VStack gap={0} className="text-right">
                    <Text>{`${sealBalance ? formatBigInt(sealBalance) : '0'}`}</Text>
                  </VStack>
                )}
              </div>
              <div className="flex w-full justify-between">
                <HStack className="items-center" gap={1}>
                  <Warning boxSize={14} viewBox="0 0 16 16" />
                  <Text variant="captionSm" className="text-error">
                    <Trans>The Seal Engine is deprecated</Trans>
                  </Text>
                </HStack>
                {isLoading ? (
                  <Skeleton className="w-32" />
                ) : (
                  <VStack gap={0} className="text-right">
                    {sealValue !== undefined ? (
                      <Text variant="small" className="text-textSecondary">
                        $
                        {formatNumber(sealValue, {
                          maxDecimals: isLargeAmount ? 0 : 2
                        })}
                      </Text>
                    ) : undefined}
                  </VStack>
                )}
              </div>
            </CardContent>
          </div>
        </div>
        {url && (
          <CardFooter>
            <div className="flex w-full justify-start pt-4">
              <div className="flex grow items-center gap-2">
                <Text variant="captionSm">
                  <Trans>Close your position(s)</Trans>
                </Text>
                <div className="mt-1 h-4 w-4">
                  <ArrowRight
                    size={16}
                    className="opacity-0 transition-opacity group-hover/warning-seal-card:opacity-100"
                  />
                </div>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
};
