import { Layout } from '@/modules/layout/components/Layout';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useLingui } from '@lingui/react';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useNotification } from '@/modules/app/hooks/useNotification';
import { isL2ChainId } from '@jetstreamgg/utils';
import { useChainId } from 'wagmi';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { AppContainer } from '@/modules/app/components/AppContainer';
import { ArrowLeft } from 'lucide-react';
import { HStack } from '@/modules/layout/components/HStack';
import { Link } from 'react-router-dom';
import {
  SealAction,
  SealFlow,
  SealModuleWidget,
  TxStatus,
  WidgetStateChangeParams
} from '@jetstreamgg/widgets';
import { useCurrentUrnIndex } from '@jetstreamgg/hooks';
import { useState } from 'react';

export function SealEngine() {
  const { i18n } = useLingui();
  const { data: currentUrnIndex } = useCurrentUrnIndex();
  const onConnect = useCustomConnectModal();
  const addRecentTransaction = useAddRecentTransaction();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const onNotification = useNotification();
  const { onExternalLinkClicked } = useConfigContext();
  const locale = i18n.locale;
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const [shouldHideLink, setShouldHideLink] = useState(false);

  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  let termsLink: any[] = [];
  try {
    termsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
  } catch (error) {
    console.error('Error parsing terms link: ', error);
  }

  const onSealWidgetStateChange = ({ widgetState, txStatus }: WidgetStateChangeParams) => {
    const shouldHide =
      txStatus !== TxStatus.IDLE ||
      (widgetState.action === SealAction.MULTICALL &&
        currentUrnIndex !== undefined &&
        currentUrnIndex > 0n &&
        (widgetState.flow === SealFlow.OPEN || widgetState.flow === SealFlow.MANAGE));

    setShouldHideLink(shouldHide);
  };

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent: <></>,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode,
    onWidgetStateChange: onSealWidgetStateChange
  };

  return (
    <Layout>
      <AppContainer>
        <div className="h-full w-[500px] rounded-lg py-6 pl-6 pr-4">
          {!shouldHideLink && (
            <Link to="/" className="text-textSecondary">
              <HStack className="mb-3 space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  Back to Home
                </Heading>
              </HStack>
            </Link>
          )}
          {isL2 ? (
            <div className="text-center">
              <Heading variant="large">Connect to Mainnet</Heading>
              <Text className="text-text mt-8">
                This module is not available on L2s. Please connect to mainnet to use it.
              </Text>
              <div className="mt-10 flex justify-center gap-3">
                <ChainModal dataTestId="chain-modal-trigger-header" showLabel={!isMobile} variant="widget" />
              </div>
              <Text variant="captionSm" className="text-text text-textSecondary mt-2">
                Select mainnet in the chain selector
              </Text>
            </div>
          ) : currentUrnIndex === 0n ? (
            <div className="mt-10 text-center">
              <Heading variant="large">Seal Engine is deprecated</Heading>
              <Text className="text-text mt-8">
                Creation of new positions has been disabled. Management of existing positions remains
                available.
              </Text>
              <Text className="text-text mt-8">You don&apos;t have any open positions.</Text>
            </div>
          ) : (
            <SealModuleWidget
              {...sharedProps}
              onWidgetStateChange={onSealWidgetStateChange}
              termsLink={termsLink[0]}
            />
          )}
        </div>
      </AppContainer>
    </Layout>
  );
}
