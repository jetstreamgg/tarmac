import { Layout } from '@/modules/layout/components/Layout';
import { SealWidgetPane } from '@/modules/seal/components/SealWidgetPane';
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

export function SealEngine() {
  const { i18n } = useLingui();
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

  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent: <></>,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode
  };

  // TODO: Work the layout
  return (
    <Layout>
      <div className="h-full w-[500px] rounded-lg bg-black/50 py-6 pl-6 pr-4">
        {isL2 ? (
          <div className="text-center">
            <Heading>Connect to Mainnet</Heading>
            <Text className="text-text mt-4">
              This module is not available on L2s. Please connect to mainnet to use it.
            </Text>
            <div className="mt- flex justify-center gap-3">
              <ChainModal dataTestId="chain-modal-trigger-header" showLabel={!isMobile} variant="widget" />
            </div>
          </div>
        ) : (
          <SealWidgetPane {...sharedProps} />
        )}
      </div>
    </Layout>
  );
}
