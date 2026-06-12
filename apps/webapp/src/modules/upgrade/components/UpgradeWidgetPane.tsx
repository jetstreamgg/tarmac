import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteConvertIntent, useRouteIntent } from '@/lib/navigation';

import { TOKENS, useUpgradeHistory } from '@/hooks';
import {
  TxStatus,
  UpgradeAction,
  UpgradeWidget,
  WidgetStateChangeParams,
  UpgradeFlow,
  upgradeTokens
} from '@/widgets';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useEffect, useState } from 'react';
import { ConvertIntent, Intent } from '@/lib/enums';

export function UpgradeWidgetPane() {
  const subgraphUrl = useSubgraphUrl();
  const { mutate: refreshUpgradeHistory } = useUpgradeHistory({ subgraphUrl });

  const [searchParams, setSearchParams] = useAppSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as UpgradeFlow | undefined;
  const [currentToken, setCurrentToken] = useState<string | undefined>();

  // Get source_token from URL params
  const sourceToken = searchParams.get(QueryParams.SourceToken)?.toUpperCase();

  const intent = useRouteIntent();
  const convertIntent = useRouteConvertIntent();
  const navigate = useNavigate();
  const isConvertContext = intent === Intent.CONVERT_INTENT;

  const handleBackToConvert = () => {
    void navigate({ to: '/convert', search: keepSearch });
  };

  // Set initial currentToken from sourceToken
  useEffect(() => {
    if (sourceToken && !currentToken) {
      setCurrentToken(sourceToken);
    }
  }, []);

  // Update URL when token changes
  useEffect(() => {
    if (currentToken && currentToken !== sourceToken) {
      setSearchParams(
        prevParams => {
          const params = new URLSearchParams(prevParams);
          params.set(QueryParams.SourceToken, currentToken);
          return params;
        },
        { replace: true }
      );
    }
  }, [currentToken, sourceToken, setSearchParams]);

  const onUpgradeWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    const isUpgradeContext =
      intent === Intent.CONVERT_INTENT && convertIntent === ConvertIntent.UPGRADE_INTENT;

    if (!isUpgradeContext) {
      return;
    }

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, flow);
          return prev;
        },
        { replace: true }
      );
    }

    if (originToken) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.SourceToken, originToken);
          return prev;
        },
        { replace: true }
      );
    } else if (originToken === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.SourceToken);
          return prev;
        },
        { replace: true }
      );
    }

    // Update currentToken if originToken changes and is different from the sourceToken param
    if (originToken && originToken !== currentToken && originToken !== sourceToken) {
      setCurrentToken(originToken);
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [UpgradeAction.UPGRADE, UpgradeAction.REVERT].includes(widgetState.action as UpgradeAction)
    ) {
      setTimeout(() => {
        refreshUpgradeHistory();
      }, REFRESH_DELAY);
    }
  };

  const upgradeOptions = [TOKENS.dai, TOKENS.mkr];

  return (
    <UpgradeWidget
      externalWidgetState={{
        flow,
        initialUpgradeToken: (sourceToken && Object.values(upgradeTokens).includes(sourceToken)
          ? sourceToken
          : undefined) as keyof typeof upgradeTokens | undefined
      }}
      onWidgetStateChange={onUpgradeWidgetStateChange}
      upgradeOptions={upgradeOptions}
      onBackToConvert={isConvertContext ? handleBackToConvert : undefined}
    />
  );
}
