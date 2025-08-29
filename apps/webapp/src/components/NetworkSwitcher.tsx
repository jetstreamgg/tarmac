import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { requiresMainnet } from '@/lib/widget-network-map';

export function NetworkSwitcher() {
  const { userConfig } = useConfigContext();
  const { intent } = userConfig;

  // Check if current intent requires mainnet - if so, always disable the switcher
  // since these modules only work on mainnet
  const isMainnetOnly = requiresMainnet(intent);

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
