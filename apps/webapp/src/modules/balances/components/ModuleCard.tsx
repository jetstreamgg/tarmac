import { Intent } from '@/lib/enums';
import { mapIntentToQueryParam } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/utils';
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
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Logo, LogoName } from '@/modules/ui/components/HighlightLogo';

type ModuleCardProps = {
  className: string;
  title: string;
  intent: Intent;
  module: string;
  notAvailable?: boolean;
  soon?: boolean;
  subHeading: React.ReactElement;
  emphasisText?: React.ReactElement;
  logoName: LogoName;
};

export const ModuleCard = ({
  className,
  title,
  intent,
  module,
  notAvailable,
  soon,
  subHeading,
  emphasisText,
  logoName
}: ModuleCardProps) => {
  const chainId = useChainId();
  const isBase = isBaseChainId(chainId);
  const isArbitrum = isArbitrumChainId(chainId);
  const isOptimism = isOptimismChainId(chainId);
  const isUnichain = isUnichainChainId(chainId);

  const navigate = useNavigate();
  const url = useRetainedQueryParams(
    `/?widget=${mapIntentToQueryParam(intent)}${notAvailable ? '&network=ethereum' : ''}`,
    notAvailable
      ? [QueryParams.Locale, QueryParams.Details]
      : [QueryParams.Locale, QueryParams.Details, QueryParams.Network]
  );

  const l2Chains = [
    { check: isBase, name: 'Base' },
    { check: isArbitrum, name: 'Arbitrum' },
    { check: isOptimism, name: 'Optimism' },
    { check: isUnichain, name: 'Unichain' }
  ];
  const l2Chain = l2Chains.find(chain => chain.check);

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-b p-3 py-4 pb-8 lg:px-6',
        className
      )}
    >
      <CardTitle className="mb-5 text-left font-normal leading-8">
        <Heading>{t`${title}`}</Heading>
      </CardTitle>
      <CardContent className="z-10 flex grow flex-col items-start justify-between p-0">
        <div>
          {subHeading}
          <div className="mt-2">{emphasisText}</div>
        </div>
        <Button variant="light" className="mt-5" onClick={() => navigate(url)}>
          {notAvailable ? t`View on Mainnet` : t`Go to ${l2Chain?.name || ''} ${module}`}
        </Button>
      </CardContent>
      {soon && (
        <Text
          variant="small"
          className="bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 text-text 3xl:block top-6.5 absolute right-6 z-10 hidden rounded-full px-1.5 py-0 md:px-2 md:py-1"
        >
          {l2Chain ? <Trans>Soon on {l2Chain.name}</Trans> : <Trans>Coming Soon</Trans>}
        </Text>
      )}
      <Logo logoName={logoName} />
    </Card>
  );
};
