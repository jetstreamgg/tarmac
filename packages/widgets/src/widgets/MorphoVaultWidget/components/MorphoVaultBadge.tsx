import { Trans } from '@lingui/react/macro';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '@widgets/components/ui/tooltip';
import { cn } from '@widgets/lib/utils';
import { Morpho as MorphoIcon } from '@widgets/shared/components/icons/Morpho';
import { Text } from '@widgets/shared/components/ui/Typography';

export const MorphoVaultBadge = ({ className }: { className?: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <MorphoIcon className={cn('h-4.5 w-4.5 rounded-sm', className)} />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent arrowPadding={10} className="max-w-[260px]">
        <Text variant="small">
          <Trans>Vault powered by Morpho</Trans>
        </Text>
        <TooltipArrow width={12} height={8} />
      </TooltipContent>
    </TooltipPortal>
  </Tooltip>
);
