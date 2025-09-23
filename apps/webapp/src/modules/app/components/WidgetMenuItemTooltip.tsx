import React from 'react';
import { Intent } from '@/lib/enums';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipPortal } from '@/components/ui/tooltip';
import { getChainIcon } from '@jetstreamgg/sky-utils';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChains } from 'wagmi';
import { isMultichain } from '@/lib/widget-network-map';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { QueryParams, mapIntentToQueryParam } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';

interface WidgetMenuItemTooltipProps {
  description?: string;
  widgetIntent: Intent;
  currentChainId?: number;
  label: string;
  isMobile: boolean;
  disabled?: boolean;
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
  children
}: WidgetMenuItemTooltipProps) {
  const chains = useChains();
  const [, setSearchParams] = useSearchParams();
  const { setIsSwitchingNetwork } = useNetworkSwitch();

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

        return (
          <button
            key={chainId}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleNetworkSwitch(chainId);
            }}
            className="flex items-center justify-center rounded-full p-1 transition-all hover:bg-white/10"
            title={`Go to ${label} on ${chain.name}`}
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

      return (
        <button
          key={mainnetId}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            handleNetworkSwitch(mainnetId);
          }}
          className="flex items-center justify-center rounded-full p-1 transition-all hover:bg-white/10"
          title={`Go to ${label} on ${chain.name}`}
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
          </TooltipContent>
        </TooltipPortal>
      )}
    </Tooltip>
  );
}
