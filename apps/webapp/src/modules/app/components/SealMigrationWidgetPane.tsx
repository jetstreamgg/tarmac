import React, { useEffect, useState } from 'react';
import { Seal } from '../../icons';
import { Intent } from '@/lib/enums';
import { Trans } from '@lingui/react/macro';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { ArrowLeft } from 'lucide-react';
import { HStack } from '@/modules/layout/components/HStack';
import { Link, useSearchParams } from 'react-router-dom';
import { SealAction, SealFlow, SealModuleWidget, TxStatus, WidgetStateChangeParams } from '@/widgets';
import { useSealCurrentIndex } from '@/hooks';
import { isL2ChainId } from '@/utils';
import { useConnection, useChainId, useSwitchChain } from 'wagmi';

import { IntentMapping } from '@/lib/constants';
import { QueryParams } from '@/lib/constants';
import { DetailsSwitcher } from '@/components/DetailsSwitcher';
import { CustomConnectButton } from '@/modules/layout/components/CustomConnectButton';
import { getTermsLinkConfig, reportTermsLinkConfigErrorOnce } from '@/modules/config/termsLink';
import { WidgetContent, WidgetItem } from '../types/Widgets';

type WidgetPaneProps = {
  children?: React.ReactNode;
};

export const SealMigrationWidgetPane = ({ children }: WidgetPaneProps) => {
  const { data: currentUrnIndex } = useSealCurrentIndex();
  const { setSelectedSealUrnIndex } = useConfigContext();
  const [shouldHideLink, setShouldHideLink] = useState(false);
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);
  const [searchParams, setSearchParams] = useSearchParams();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useConnection();

  const rightHeaderComponent = <DetailsSwitcher />;

  const onSealWidgetStateChange = ({ widgetState, txStatus }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.SEAL_INTENT]) {
      return;
    }

    const shouldHide =
      txStatus !== TxStatus.IDLE ||
      (widgetState.action === SealAction.MULTICALL &&
        currentUrnIndex !== undefined &&
        currentUrnIndex > 0n &&
        (widgetState.flow === SealFlow.OPEN || widgetState.flow === SealFlow.MANAGE));

    setShouldHideLink(shouldHide);
  };

  const onSealUrnChange = (urn?: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined }) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.SEAL_INTENT]) {
      return;
    }

    setSearchParams(params => {
      if (urn?.urnAddress && urn?.urnIndex !== undefined) {
        params.set(QueryParams.Widget, IntentMapping[Intent.SEAL_INTENT]);
        params.set(QueryParams.UrnIndex, urn.urnIndex.toString());
      } else {
        params.delete(QueryParams.UrnIndex);
      }
      return params;
    });
    setSelectedSealUrnIndex(urn?.urnIndex !== undefined ? Number(urn.urnIndex) : undefined);
  };

  // Reset detail pane urn index when widget is mounted
  useEffect(() => {
    const urnIndexParam = searchParams.get(QueryParams.UrnIndex);
    setSelectedSealUrnIndex(
      urnIndexParam ? (isNaN(Number(urnIndexParam)) ? undefined : Number(urnIndexParam)) : undefined
    );

    // Reset when unmounting
    return () => {
      setSelectedSealUrnIndex(undefined);
    };
  }, []);

  const { primaryTermsLink } = getTermsLinkConfig();

  useEffect(() => {
    reportTermsLinkConfigErrorOnce({
      module: 'widgets',
      flow: 'seal-migration',
      action: 'parse-terms-link',
      type: 'config_error'
    });
  }, []);

  const sharedProps = {
    rightHeaderComponent,
    onSealUrnChange
  };

  // If the user is on a L2, switch to mainnet
  useEffect(() => {
    if (isL2 && isConnected) {
      switchChain({ chainId: 1 });
    }
  }, [isConnected, isL2]);

  const widgetItems: WidgetItem[] = [
    [
      Intent.SEAL_INTENT,
      'Seal',
      Seal,
      withErrorBoundary(
        <>
          <Link to="/" className={`text-textSecondary ${shouldHideLink ? 'invisible' : 'visible'}`}>
            <HStack className="mb-3 space-x-2">
              <ArrowLeft className="self-center" />
              <Heading tag="h3" variant="small" className="text-textSecondary">
                <Trans>Exit Seal Engine</Trans>
              </Heading>
            </HStack>
          </Link>
          {!isConnected ? (
            <div className="text-center">
              <Heading variant="large">
                <Trans>Seal Engine</Trans>
              </Heading>
              <Text className="text-text mt-8">
                <Trans>
                  The Seal Engine is deprecated. Please close your positions and open new positions in the
                  Staking Engine.
                </Trans>
              </Text>
              <Text className="text-text mt-8 mb-8">
                <Trans>
                  Please connect your wallet to Ethereum Mainnet to start the migration of your positions.
                </Trans>
              </Text>
              <CustomConnectButton />
            </div>
          ) : currentUrnIndex === 0n ? (
            <div className="mt-10 text-center">
              <Heading variant="large">
                <Trans>Seal Engine is deprecated</Trans>
              </Heading>
              <Text className="text-text mt-8">
                <Trans>
                  Creation of new positions has been disabled. Management of existing positions remains
                  available.
                </Trans>
              </Text>
              <Text className="text-text mt-8">
                <Trans>You don&apos;t have any open positions.</Trans>
              </Text>
            </div>
          ) : (
            <SealModuleWidget
              {...sharedProps}
              onWidgetStateChange={onSealWidgetStateChange}
              termsLink={primaryTermsLink}
              mkrSkyUpgradeUrl="https://upgrademkrtosky.skyeco.com"
            />
          )}
        </>
      ),
      false
    ]
  ];

  // Create a single group for seal migration
  const widgetContent: WidgetContent = [
    {
      id: 'seal-migration',
      items: widgetItems
    }
  ];

  return (
    <WidgetNavigation hideTabs widgetContent={widgetContent} intent={Intent.SEAL_INTENT}>
      {children}
    </WidgetNavigation>
  );
};
