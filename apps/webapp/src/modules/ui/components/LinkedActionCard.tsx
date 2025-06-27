import { Card, CardContent } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { Heading } from '@/modules/layout/components/Typography';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { IntentMapping, QueryParams, intentTxt } from '@/lib/constants';
import { useRetainedQueryParams } from '../hooks/useRetainedQueryParams';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { VStack } from '@/modules/layout/components/VStack';
import { RewardsRate, SavingsRate } from './HighlightRate';
import { Logo } from './HighlightLogo';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { useEffect, useState } from 'react';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

const secondaryTagline = {
  [IntentMapping.SAVINGS_INTENT]: 'to get the Sky Savings Rate',
  [IntentMapping.REWARDS_INTENT]: 'to get rewards'
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

  // Extract reward contract address
  const urlObj = new URL(urlWithRetainedParams, window.location.origin);
  const rewardContractAddress = urlObj.searchParams.get(QueryParams.Reward);
  const selectedRewardContract = rewardContracts.find(
    contract => contract.contractAddress?.toLowerCase() === rewardContractAddress?.toLowerCase()
  );

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault();
    updateLinkedActionConfig({ step: LinkedActionSteps.CURRENT_FUTURE });
    const modifiedUrl = `${urlWithRetainedParams}${urlWithRetainedParams.includes('widget=trade') ? `&${QueryParams.Timestamp}=${new Date().getTime()}` : ''}`;
    navigate(modifiedUrl);
  };

  // Run once to prevent logo from switching briefly during unmount
  useEffect(() => {
    setIsLastStep(linkedActionConfig?.initialAction === la);
  }, []);

  return (
    <Card variant="spotlight" className="relative w-full overflow-hidden xl:flex-1">
      {<Logo logoName={isLastStep ? intent : la} />}
      <CardContent className="relative z-10">
        <VStack className="space-between gap-4">
          <Heading>
            <Trans>
              {intent && primaryToken && `${capitalizeFirstLetter(i18n._(intentTxt[intent]))} your `}
              <span className="text-textEmphasis">{`${formatNumber(parseInt(balance))} ${primaryToken} `}</span>
              {' to '}
              <span className="text-textEmphasis">{`${secondaryToken} `}</span>
              {secondaryTagline[la]}
            </Trans>
          </Heading>
          {la === IntentMapping.REWARDS_INTENT ? (
            <RewardsRate token={secondaryToken} currentRewardContract={selectedRewardContract} />
          ) : (
            <SavingsRate />
          )}
          <Link to={urlWithRetainedParams} onClick={handleClick}>
            <Button variant="light" className="w-fit px-5">
              {buttonText}
            </Button>
          </Link>
        </VStack>
      </CardContent>
    </Card>
  );
};
