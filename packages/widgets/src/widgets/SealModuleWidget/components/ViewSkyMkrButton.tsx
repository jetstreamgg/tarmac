import { Button } from '@widgets/components/ui/button';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Token } from '@jetstreamgg/sky-hooks';
import { ArrowLeftRight } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
  TooltipPortal
} from '@widgets/components/ui/tooltip';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';

export const ViewSkyMkrButton = ({ onClick, displayToken }: { onClick: () => void; displayToken: Token }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="primary"
          className="h-full px-3 text-xs"
          onClick={onClick}
          data-testid="view-sky-mkr-button"
        >
          <TokenIcon className="h-4 w-4" token={displayToken} width={16} />{' '}
          <ArrowLeftRight size={14} className="ml-1" />
        </Button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">
            {displayToken.symbol === 'MKR' ? t`Show SKY values` : t`Show MKR values`}
          </Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
};
