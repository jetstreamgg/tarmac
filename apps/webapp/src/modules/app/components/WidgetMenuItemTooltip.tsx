import React from 'react';
import { Intent } from '@/lib/enums';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipPortal } from '@/components/ui/tooltip';
import { getChainIcon, isMainnetId } from '@jetstreamgg/sky-utils';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChains } from 'wagmi';
import { isMultichain } from '@/lib/widget-network-map';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { QueryParams, mapIntentToQueryParam } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { WidgetSubItem } from '@/modules/app/types/Widgets';

interface WidgetMenuItemTooltipProps {
  description?: string;
  widgetIntent: Intent;
  currentChainId?: number;
  label: string;
  isMobile: boolean;
  disabled?: boolean;
  isCurrentWidget?: boolean;
  subItems?: WidgetSubItem[];
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
  subItems,
  children
}: WidgetMenuItemTooltipProps) {
  const chains = useChains();
  const [, setSearchParams] = useSearchParams();
  const { setIsSwitchingNetwork } = useNetworkSwitch();

  const getMainnetChainId = (supportedChainIds: number[]) =>
    supportedChainIds.find(isMainnetId) || supportedChainIds[0];

  const handleSubItemClick = (subItem: WidgetSubItem) => {
    if (!currentChainId) return;

    const supportedChainIds = getSupportedChainIds(currentChainId);

    // Use subItem's intent if specified, otherwise fall back to parent widget's intent
    const targetIntent = subItem.intent ?? widgetIntent;
    // For multichain intents, use current network; for mainnet-only, use mainnet
    const targetChainId = isMultichain(targetIntent) ? currentChainId : getMainnetChainId(supportedChainIds);

    const targetChain = chains.find(c => c.id === targetChainId);
    if (!targetChain) return;

    setIsSwitchingNetwork(currentChainId !== targetChainId);
    setSearchParams(prevParams => {
      const searchParams = deleteSearchParams(prevParams);
      searchParams.set(QueryParams.Network, normalizeUrlParam(targetChain.name));
      searchParams.set(QueryParams.Widget, mapIntentToQueryParam(widgetIntent));
      Object.entries(subItem.params).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
      return searchParams;
    });
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
      const mainnetId = getMainnetChainId(supportedChainIds);

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
            {subItems && subItems.length > 0 && (
              <>
                <p className="mt-2 text-xs text-gray-400">Quick access:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {subItems.map(subItem => (
                    <button
                      key={subItem.label}
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubItemClick(subItem);
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs transition-colors hover:bg-white/20"
                    >
                      {subItem.icon}
                      {subItem.label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
