import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { useRouteIntent } from '@/lib/router';
import { requiresMainnet } from '@/lib/widget-network-map';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { Loader2 } from 'lucide-react';

export function NetworkSwitcher() {
  const intent = useRouteIntent();
  const { isSwitchingNetwork } = useNetworkSwitch();

  // Check if current intent requires mainnet - if so, always disable the switcher
  // since these modules only work on mainnet
  const isMainnetOnly = requiresMainnet(intent);

  // Show loading state when switching network
  if (isSwitchingNetwork) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="from-primary-start/100 to-primary-end/100 hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 flex items-center justify-center rounded-xl border border-transparent bg-radial-(--gradient-position) px-[9px] py-2 bg-blend-overlay hover:border-transparent hover:bg-white/10 focus:border-transparent focus:bg-white/15">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent arrowPadding={10}>
            <Text variant="small">{t`Switching network...`}</Text>
            <TooltipArrow width={12} height={8} />
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    );
  }

  // For mainnet-only modules, always show disabled state with explanation
  // This prevents users from switching away from mainnet when on mainnet-only modules
  if (isMainnetOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-not-allowed opacity-50">
            <ChainModal
              variant="widget"
              showLabel={false}
              showDropdownIcon={false}
              dataTestId="chain-modal-trigger-widget"
              disabled={true}
            />
          </div>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent arrowPadding={10}>
            <Text variant="small">{t`This module is only available on Ethereum mainnet`}</Text>
            <TooltipArrow width={12} height={8} />
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    );
  }

  // For multichain modules, show normal network switcher
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ChainModal
            variant="widget"
            showLabel={false}
            showDropdownIcon={false}
            dataTestId="chain-modal-trigger-widget"
          />
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">{t`Switch network`}</Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
