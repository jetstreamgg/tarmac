import React from 'react';
import { Intent } from '@/lib/enums';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipPortal } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { getChainIcon } from '@jetstreamgg/sky-utils';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChains } from 'wagmi';
import { isMultichain } from '@/lib/widget-network-map';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { QueryParams, mapIntentToQueryParam, CHATBOT_ENABLED } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useSendMessage } from '@/modules/chat/hooks/useSendMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Chat } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';

interface WidgetMenuItemTooltipProps {
  description?: string;
  widgetIntent: Intent;
  currentChainId?: number;
  label: string;
  isMobile: boolean;
  disabled?: boolean;
  isCurrentWidget?: boolean;
  children: React.ReactNode;
}

/**
 * Tooltip component for widget menu items
 * Displays widget description and supported network icons
 * Handles network switching when clicking on network icons
 */
export function WidgetMenuItemTooltip({
  description,
  widgetIntent,
  currentChainId,
  label,
  isMobile,
  disabled = false,
  isCurrentWidget = false,
  children
}: WidgetMenuItemTooltipProps) {
  const chains = useChains();
  const [, setSearchParams] = useSearchParams();
  const { setIsSwitchingNetwork } = useNetworkSwitch();
  const { sendMessage } = useSendMessage();
  const { isLoading } = useChatContext();

  const handleAskAboutModule = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Open chat pane via URL param
    setSearchParams(prevParams => {
      prevParams.set(QueryParams.Chat, 'true');
      return prevParams;
    });

    // Send contextual message after small delay to ensure chat is open
    setTimeout(() => {
      sendMessage(t`Tell me about the ${label} module`);
    }, 100);
  };

  const handleNetworkSwitch = (chainId: number) => {
    // Navigate to widget on selected network
    const chain = chains.find(c => c.id === chainId);
    if (chain) {
      setIsSwitchingNetwork(currentChainId !== chainId);
      setSearchParams(prevParams => {
        const searchParams = deleteSearchParams(prevParams);
        searchParams.set(QueryParams.Network, normalizeUrlParam(chain.name));
        searchParams.set(QueryParams.Widget, mapIntentToQueryParam(widgetIntent));
        return searchParams;
      });
    }
  };

  const renderNetworkIcons = () => {
    if (!currentChainId || widgetIntent === Intent.BALANCES_INTENT) {
      return null;
    }

    const supportedChainIds = getSupportedChainIds(currentChainId);

    if (isMultichain(widgetIntent)) {
      // Show all supported chains for multichain widgets (excluding Balances)
      return supportedChainIds.map(chainId => {
        const chain = chains.find(c => c.id === chainId);
        if (!chain) return null;

        const isCurrentNetwork = chainId === currentChainId;
        const shouldDisable = isCurrentNetwork && isCurrentWidget;

        return (
          <button
            key={chainId}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (!shouldDisable) {
                handleNetworkSwitch(chainId);
              }
            }}
            disabled={shouldDisable}
            className={`flex items-center justify-center rounded-full p-1 transition-all ${
              shouldDisable ? 'opacity-60' : 'hover:bg-white/10'
            }`}
            title={shouldDisable ? `Already on ${label} on ${chain.name}` : `Go to ${label} on ${chain.name}`}
          >
            {getChainIcon(chainId, 'h-5 w-5')}
          </button>
        );
      });
    } else {
      // Show only Ethereum mainnet for mainnet-only widgets
      const mainnetId =
        supportedChainIds.find(id => {
          const chain = chains.find(c => c.id === id);
          return chain && (chain.name === 'Ethereum' || chain.name.includes('mainnet'));
        }) || supportedChainIds[0];

      const chain = chains.find(c => c.id === mainnetId);
      if (!chain) return null;

      const isCurrentNetwork = mainnetId === currentChainId;
      const shouldDisable = isCurrentNetwork && isCurrentWidget;

      return (
        <button
          key={mainnetId}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!shouldDisable) {
              handleNetworkSwitch(mainnetId);
            }
          }}
          disabled={shouldDisable}
          className={`flex items-center justify-center rounded-full p-1 transition-all ${
            shouldDisable ? 'opacity-50' : 'hover:bg-white/10'
          }`}
          title={shouldDisable ? `Already on ${label} on ${chain.name}` : `Go to ${label} on ${chain.name}`}
        >
          {getChainIcon(mainnetId, 'h-5 w-5')}
        </button>
      );
    }
  };

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger disabled={disabled}>{children}</TooltipTrigger>
      {description && !isMobile && (
        <TooltipPortal>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-sm">{description}</p>
            {currentChainId && widgetIntent !== Intent.BALANCES_INTENT && (
              <>
                <p className="mt-2 text-xs text-gray-400">Supported on:</p>
                <div className="mt-1 flex gap-2">{renderNetworkIcons()}</div>
              </>
            )}
            {CHATBOT_ENABLED && (
              <>
                <div className="my-2 h-px w-full bg-gray-600" />
                <Button
                  variant="link"
                  onClick={handleAskAboutModule}
                  disabled={isLoading}
                  className="h-auto w-full justify-start gap-2 rounded-md p-1.5 text-gray-300 hover:bg-white/10 hover:text-gray-300 disabled:opacity-50"
                  title={t`Ask about ${label}`}
                >
                  <Chat className="h-4 w-4" />
                  <Text tag="span" variant="captionSm">{t`Ask me about ${label}`}</Text>
                </Button>
              </>
            )}
          </TooltipContent>
        </TooltipPortal>
      )}
    </Tooltip>
  );
}
