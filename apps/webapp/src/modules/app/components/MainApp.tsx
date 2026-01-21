import { useEffect } from 'react';
import { WidgetPane } from './WidgetPane';
import { DetailsPane } from './DetailsPane';
import { AppContainer } from './AppContainer';
import { useSearchParams } from 'react-router-dom';
import { CHATBOT_ENABLED, QueryParams, mapQueryParamToIntent } from '@/lib/constants';

import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { validateLinkedActionSearchParams, validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { useConnection, useConnectionEffect, useChainId, useChains, useSwitchChain } from 'wagmi';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useSendMessage } from '@/modules/chat/hooks/useSendMessage';
import { ChatWithTerms } from '@/modules/chat/components/ChatWithTerms';
import { useWalletTermsAssociation } from '@/modules/chat/hooks/useWalletTermsAssociation';
import { useChatNotification } from '../hooks/useChatNotification';
import { FloatingChatPane } from './FloatingChatPane';
import { FloatingChatButton } from './FloatingChatButton';
import { useSafeAppNotification } from '../hooks/useSafeAppNotification';
import { useGovernanceMigrationToast } from '../hooks/useGovernanceMigrationToast';
import { useNotificationQueue } from '../hooks/useNotificationQueue';
import { usePageLoadNotifications } from '../hooks/usePageLoadNotifications';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useFloatingChat } from '@/modules/chat/hooks/useFloatingChat';
import { useChatScrollBehavior } from '@/modules/chat/hooks/useChatScrollBehavior';

export function MainApp() {
  const {
    linkedActionConfig,
    updateLinkedActionConfig,
    setSelectedRewardContract,
    setSelectedExpertOption,
    expertRiskDisclaimerShown
  } = useConfigContext();
  const { isAuthorized } = useConnectedContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bpi } = useBreakpointIndex();
  const { shouldShowFloating } = useFloatingChat();

  const intent = mapQueryParamToIntent(searchParams.get(QueryParams.Widget));

  const chainId = useChainId();
  const chains = useChains();

  const { connector } = useConnection();
  useConnectionEffect({
    // Once the user connects their wallet, check if the network param is set and switch chains if necessary
    onConnect() {
      const parsedChainId = chains.find(
        chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network || '')
      )?.id;
      if (parsedChainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  });

  const { setIsSwitchingNetwork } = useNetworkSwitch();

  const { switchChain } = useSwitchChain({
    mutation: {
      onSuccess: () => {
        // Clear switching state when network switch succeeds
        setIsSwitchingNetwork(false);
      },
      onError: err => {
        // Clear switching state when network switch fails
        setIsSwitchingNetwork(false);

        // If the user rejects the network switch request, update the network query param to the current chain
        if (err.name === 'UserRejectedRequestError') {
          const chainName = chains.find(c => c.id === chainId)?.name;
          if (chainName) {
            const normalizedChainName = normalizeUrlParam(chainName);
            const currentNetwork = searchParams.get(QueryParams.Network);
            // Only update if the network actually changed
            if (currentNetwork !== normalizedChainName) {
              setSearchParams(params => {
                params.set(QueryParams.Network, normalizedChainName);
                return params;
              });
            }
          }
        }
      }
    }
  });

  const { sendMessage } = useSendMessage();

  const widgetParam = searchParams.get(QueryParams.Widget);
  const detailsParam = !(searchParams.get(QueryParams.Details) === 'false');
  const rewardContract = searchParams.get(QueryParams.Reward) || undefined;
  const expertModule = searchParams.get(QueryParams.ExpertModule) || undefined;
  const sourceToken = searchParams.get(QueryParams.SourceToken) || undefined;
  const targetToken = searchParams.get(QueryParams.TargetToken) || undefined;
  const linkedAction = searchParams.get(QueryParams.LinkedAction) || undefined;
  const inputAmount = searchParams.get(QueryParams.InputAmount) || undefined;
  const timestamp = searchParams.get(QueryParams.Timestamp) || undefined;
  const network = searchParams.get(QueryParams.Network) || undefined;
  // Chat is now opt-in on all screen sizes (no longer auto-shown on 3xl+)
  const chatParam = CHATBOT_ENABLED && searchParams.get(QueryParams.Chat) === 'true';

  // On desktop (3xl+), chat is floating; on mobile, it's inline
  const showInlineChat = chatParam && !shouldShowFloating;

  const inlineChatScrollBehavior = useChatScrollBehavior(showInlineChat);

  const newChainId = network
    ? (chains.find(chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network))?.id ?? chainId)
    : chainId;

  const rewardContracts = useAvailableTokenRewardContracts(newChainId);

  // step is initialized as 0 and will evaluate to false, setting the first step to 1
  const step = linkedAction ? linkedActionConfig.step || 1 : 0;

  // Page Load Notifications - Only one notification shows per page load
  // Get configurations for all page load notifications
  const notificationConfigs = usePageLoadNotifications();

  // Use the notification queue to determine which notification to show
  const { shouldShowNotification } = useNotificationQueue(notificationConfigs);

  // Notification Priority System (only one notification per page load):
  // 1. Governance Migration (for connected wallets with MKR ≥ 0.05)
  // 2. Chat Notification (lowest priority)

  // Display notifications based on queue priority
  useGovernanceMigrationToast(isAuthorized && shouldShowNotification('governance-migration'));
  useChatNotification(isAuthorized && shouldShowNotification('chat'));

  // If the user is connected to a Safe Wallet using WalletConnect, notify they can use the Safe App
  useSafeAppNotification();

  // Associate wallet address with chatbot terms acceptance (if CHATBOT_ENABLED)
  useWalletTermsAssociation();

  // Run validation on search params whenever search params change
  useEffect(() => {
    setSearchParams(
      params => {
        // Runs initial validation for globally allowed params
        const validatedParams = validateSearchParams(
          params,
          rewardContracts,
          widgetParam || '',
          setSelectedRewardContract,
          newChainId,
          chains,
          setSelectedExpertOption,
          expertRiskDisclaimerShown
        );
        // Runs second validation for linked-action-specific criteria
        const validatedLinkedActionParams = validateLinkedActionSearchParams(validatedParams);
        return validatedLinkedActionParams;
      },
      { replace: true }
    );
  }, [
    searchParams,
    rewardContracts,
    setSelectedRewardContract,
    widgetParam,
    setSelectedExpertOption,
    expertRiskDisclaimerShown
  ]);

  useEffect(() => {
    // If there's no network param, default to the current chain
    if (!network) {
      const chainName = chains.find(c => c.id === chainId)?.name;
      if (chainName) {
        const normalizedChainName = normalizeUrlParam(chainName);
        // Only set if not already present (double-check in case of race condition)
        if (!searchParams.get(QueryParams.Network)) {
          setSearchParams(params => {
            params.set(QueryParams.Network, normalizedChainName);
            return params;
          });
        }
      }
    } else {
      // If the network param doesn't match the current chain, switch chains
      const parsedChainId = chains.find(
        chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network)
      )?.id;
      if (parsedChainId && parsedChainId !== chainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  }, [network]);

  useEffect(() => {
    // If the user changes the network in their wallet, update the `network` query param
    const handleChainChange = ({ chainId: newChainId }: { chainId?: number | undefined }) => {
      const newChainName = chains.find(c => c.id === newChainId)?.name;
      if (newChainName) {
        const normalizedNewChainName = normalizeUrlParam(newChainName);
        const currentNetwork = searchParams.get(QueryParams.Network);
        // Only update if the network actually changed
        if (currentNetwork !== normalizedNewChainName) {
          setSearchParams(params => {
            params.set(QueryParams.Network, normalizedNewChainName);
            return params;
          });
        }
      }
    };

    const emitter = connector?.emitter;
    emitter?.on('change', handleChainChange);

    // Cleanup function to remove the listener
    return () => {
      emitter?.off('change', handleChainChange);
    };
  }, [chains, connector, setSearchParams]);

  useEffect(() => {
    updateLinkedActionConfig({
      sourceToken,
      targetToken,
      // Only update the initialAction value if we are on the first widget
      initialAction:
        step < LinkedActionSteps.COMPLETED_CURRENT ? widgetParam : linkedActionConfig.initialAction,
      linkedAction,
      inputAmount,
      rewardContract,
      expertModule,
      step,
      showLinkedAction: !!linkedAction,
      timestamp
    });
  }, [
    sourceToken,
    targetToken,
    linkedAction,
    inputAmount,
    rewardContract,
    expertModule,
    step,
    widgetParam,
    linkedActionConfig.initialAction
  ]);

  return (
    <>
      <AppContainer>
        {/* Widget pane - hide on mobile when inline chat is shown */}
        {(bpi > BP.sm || !showInlineChat) && (
          <WidgetPane key={`widget-pane-${bpi}`} intent={intent}>
            {bpi === BP.sm && detailsParam && <DetailsPane intent={intent} />}
          </WidgetPane>
        )}
        {/* Details pane - hide on mobile when inline chat is shown */}
        {(bpi >= BP.xl || (bpi > BP.sm && !showInlineChat)) && detailsParam && (
          <DetailsPane intent={intent} />
        )}
        {/* Inline chat - only on mobile */}
        {showInlineChat && (
          <ChatWithTerms sendMessage={sendMessage} scrollBehavior={inlineChatScrollBehavior} />
        )}
      </AppContainer>

      {/* Floating chat - only on desktop (3xl+) */}
      {shouldShowFloating && <FloatingChatPane sendMessage={sendMessage} />}

      {/* Floating chat button - shows when chat is closed on desktop */}
      <FloatingChatButton />
    </>
  );
}
