import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Toggle } from './ui/toggle';
import { Zap } from '@/modules/icons/Zap';
import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';

export function BatchTransactionsToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  const handleToggle = (checked: boolean) => {
    setBatchEnabled(checked);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Toggle
            variant="singleSwitcherBright"
            className="hidden h-10 w-10 rounded-xl p-0 md:flex"
            pressed={batchEnabled}
            onPressedChange={handleToggle}
            aria-label="Toggle bundled transactions"
          >
            <Zap width={28} height={28} />
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">{t`Bundled transactions ${batchEnabled ? 'enabled' : 'disabled'}`}</Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
