import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '@widgets/components/ui/tooltip';
import { ArrowLeftRight } from '@widgets/shared/components/icons/ArrowLeftRight';
import { Text } from '@widgets/shared/components/ui/Typography';

export const SwitchAccountButton = ({ onSwitchAccountClick }: { onSwitchAccountClick: () => void }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onSwitchAccountClick}>
          <ArrowLeftRight width={16} height={16} />
        </button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent>
          <Text>Switch account</Text>
          <TooltipArrow />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
};
