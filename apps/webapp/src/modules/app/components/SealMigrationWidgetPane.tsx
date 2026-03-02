import React, { useEffect, useState } from 'react';
import { Seal } from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useNotification } from '../hooks/useNotification';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { ArrowLeft } from 'lucide-react';
import { HStack } from '@/modules/layout/components/HStack';
import { Link, useSearchParams } from 'react-router-dom';
import {
  SealAction,
  SealFlow,
  SealModuleWidget,
  TxStatus,
  WidgetStateChangeParams
} from '@jetstreamgg/sky-widgets';
import { useSealCurrentIndex } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useConnection, useChainId, useSwitchChain } from 'wagmi';

import { IntentMapping } from '@/lib/constants';
import { QueryParams } from '@/lib/constants';
import { DetailsSwitcher } from '@/components/DetailsSwitcher';
import { CustomConnectButton } from '@/modules/layout/components/CustomConnectButton';
import { WidgetContent, WidgetItem } from '../types/Widgets';

type WidgetPaneProps = {
  children?: React.ReactNode;
};

export const SealMigrationWidgetPane = ({ children }: WidgetPaneProps) => {
  const { i18n } = useLingui();
  const onConnect = useCustomConnectModal();
  const { data: currentUrnIndex } = useSealCurrentIndex();
  // Transaction tracking removed - was using RainbowKit
  const addRecentTransaction = () => {}; // No-op for now
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const onNotification = useNotification();
  const { onExternalLinkClicked, setSelectedSealUrnIndex } = useConfigContext();
  const [shouldHideLink, setShouldHideLink] = useState(false);
  const locale = i18n.locale;
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);
  const [searchParams, setSearchParams] = useSearchParams();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useConnection();
  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

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

  let termsLink: any[] = [];
  try {
    termsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
  } catch (error) {
    console.error('Error parsing terms link: ', error);
  }

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode,
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
              termsLink={termsLink[0]}
              mkrSkyUpgradeUrl="https://upgrademkrtosky.sky.money"
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
