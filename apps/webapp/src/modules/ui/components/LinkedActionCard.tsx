import { Card, CardContent } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { Heading } from '@/modules/layout/components/Typography';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { IntentMapping, QueryParams, intentTxt } from '@/lib/constants';
import { useRetainedQueryParams } from '../hooks/useRetainedQueryParams';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { VStack } from '@/modules/layout/components/VStack';
import { RewardsRate, SavingsRate, AdvancedRate } from './HighlightRate';
import { Logo, LogoName } from './HighlightLogo';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { useEffect, useState } from 'react';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

const secondaryTagline: Record<string, string> = {
  [IntentMapping.SAVINGS_INTENT]: 'to get the Sky Savings Rate',
  [IntentMapping.REWARDS_INTENT]: 'to get rewards',
  [IntentMapping.EXPERT_INTENT]: 'to access Expert modules'
};

const expertModuleTagline: Record<string, string> = {
  stusds: 'to access stUSDS',
  morpho: 'to access Morpho vault'
};

export const LinkedActionCard = ({
  intent,
  primaryToken,
  secondaryToken,
  buttonText,
  balance,
  url,
  la
}: {
  intent: string;
  primaryToken: string;
  secondaryToken: string;
  buttonText: string;
  balance: string;
  url: string;
  la: string;
  isLoading?: boolean;
  error?: Error | null;
}) => {
  const urlWithRetainedParams = useRetainedQueryParams(url);
  const { i18n } = useLingui();
  const { linkedActionConfig, updateLinkedActionConfig } = useConfigContext();
  const navigate = useNavigate();
  const [isLastStep, setIsLastStep] = useState<boolean>();
  const chainId = useChainId();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  // Extract reward contract address and advanced module
  const urlObj = new URL(urlWithRetainedParams, window.location.origin);
  const rewardContractAddress = urlObj.searchParams.get(QueryParams.Reward);
  const expertModule = urlObj.searchParams.get(QueryParams.ExpertModule);
  const selectedRewardContract = rewardContracts.find(
    contract => contract.contractAddress?.toLowerCase() === rewardContractAddress?.toLowerCase()
  );

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault();
    updateLinkedActionConfig({
      step: LinkedActionSteps.CURRENT_FUTURE
    });
    const modifiedUrl = `${urlWithRetainedParams}${urlWithRetainedParams.includes('widget=trade') ? `&${QueryParams.Timestamp}=${new Date().getTime()}` : ''}`;
    navigate(modifiedUrl);
  };

  // Run once to prevent logo from switching briefly during unmount
  useEffect(() => {
    setIsLastStep(linkedActionConfig?.initialAction === la);
  }, []);

  return (
    <Card variant="spotlight" className="relative w-full overflow-hidden xl:flex-1">
      {<Logo logoName={(isLastStep ? intent : la) as LogoName} />}
      <CardContent className="relative z-10 h-full">
        <VStack className="h-full justify-between gap-4">
          <Heading>
            <Trans>
              {intent && primaryToken && `${capitalizeFirstLetter(i18n._(intentTxt[intent]))} your `}
              <span className="text-textEmphasis">{`${formatNumber(parseInt(balance))} ${primaryToken} `}</span>
              {' to '}
              <span className="text-textEmphasis">{`${secondaryToken} `}</span>
              {expertModule && expertModuleTagline[expertModule]
                ? expertModuleTagline[expertModule]
                : secondaryTagline[la]}
            </Trans>
          </Heading>
          <VStack className="space-between gap-4">
            {la === IntentMapping.REWARDS_INTENT ? (
              <RewardsRate token={secondaryToken} currentRewardContract={selectedRewardContract} />
            ) : la === IntentMapping.EXPERT_INTENT ? (
              <AdvancedRate expertModule={expertModule || undefined} />
            ) : (
              <SavingsRate />
            )}
            <Link to={urlWithRetainedParams} onClick={handleClick} className="w-fit">
              <Button
                variant="light"
                className="h-auto min-h-10 w-fit max-w-full px-5 text-balance whitespace-normal"
              >
                {buttonText}
              </Button>
            </Link>
          </VStack>
        </VStack>
      </CardContent>
    </Card>
  );
};
