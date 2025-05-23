import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClipboard } from '../hooks/useClipboard';
import { Text } from '@/modules/layout/components/Typography';
import { Copy } from '@/modules/icons';
import { Trans } from '@lingui/react/macro';

export function CopyToClipboard({ text }: { text: string }) {
  const { hasCopied, onCopy } = useClipboard(text);

  return (
    <Tooltip open={hasCopied}>
      <TooltipTrigger asChild>
        <Copy onClick={onCopy} boxSize={13} />
      </TooltipTrigger>
      <TooltipContent>
        <Text variant="small">
          <Trans>Copied</Trans>
        </Text>
      </TooltipContent>
    </Tooltip>
  );
}
