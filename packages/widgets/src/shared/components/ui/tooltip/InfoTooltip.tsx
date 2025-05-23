import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '../../../../components/ui/tooltip';
import { Text } from '@widgets/shared/components/ui/Typography';

export function InfoTooltip({
  content,
  contentClassname,
  iconClassName
}: {
  content: string | React.ReactNode;
  contentClassname?: string;
  iconClassName?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Info size={13} className={iconClassName} />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent className={`max-w-[400px] ${contentClassname}`} arrowPadding={10}>
          <div className="scrollbar-thin max-h-[calc(var(--radix-tooltip-content-available-height)-64px)] overflow-y-auto">
            {typeof content === 'string' ? <Text>{content}</Text> : content}
          </div>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
