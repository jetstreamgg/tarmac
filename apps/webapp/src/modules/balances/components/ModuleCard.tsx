import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Intent } from '@/lib/enums';
import { mapIntentToQueryParam } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/utils';
import { HStack } from '@/modules/layout/components/HStack';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import {
  isBaseChainId,
  isArbitrumChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { QueryParams } from '@/lib/constants';

type ModuleCardProps = {
  className: string;
  title: string;
  intent: Intent;
  module: string;
  notAvailable?: boolean;
  soon?: boolean;
};

export const ModuleCard = ({ className, title, intent, module, notAvailable, soon }: ModuleCardProps) => {
  const chainId = useChainId();
  const isBase = isBaseChainId(chainId);
  const isArbitrum = isArbitrumChainId(chainId);
  const isOptimism = isOptimismChainId(chainId);
  const isUnichain = isUnichainChainId(chainId);
  const url = useRetainedQueryParams(
    `/?widget=${mapIntentToQueryParam(intent)}${notAvailable ? '&network=ethereum' : ''}`,
    notAvailable
      ? [QueryParams.Locale, QueryParams.Details]
      : [QueryParams.Locale, QueryParams.Details, QueryParams.Network]
  );

  const availableSoonChains = [
    { check: isBase, name: 'Base' },
    { check: isArbitrum, name: 'Arbitrum' },
    { check: isOptimism, name: 'Optimism' },
    { check: isUnichain, name: 'Unichain' }
  ];
  const soonChain = availableSoonChains.find(chain => chain.check);

  const content = (
    <>
      {soon && (
        <Text
          variant="small"
          className="bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-text absolute -top-3 right-2 z-10 rounded-full px-1.5 py-0 md:px-2 md:py-1"
        >
          {soonChain ? <Trans>Soon on {soonChain.name}</Trans> : <Trans>Coming Soon</Trans>}
        </Text>
      )}
      <Card className={cn('relative flex h-full flex-col justify-between bg-[length:100%_100%]', className)}>
        <CardTitle className="mb-7 text-left font-normal leading-8">{t`${title}`}</CardTitle>
        <CardContent className="relative p-0 pb-2">
          <HStack className="items-center justify-between">
            <Heading variant="extraSmall" className="text-left">
              {notAvailable
                ? t`View on Mainnet`
                : t`Go to ${isBase ? 'Base' : isArbitrum ? 'Arbitrum' : ''} ${module}`}
            </Heading>
            <ArrowRight />
          </HStack>
        </CardContent>
      </Card>
    </>
  );

  return (
    <Link to={url} className="relative flex flex-1 basis-full flex-col xl:basis-[20%]">
      {content}
    </Link>
  );
};
