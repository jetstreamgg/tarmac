import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/widgets/components/ui/tooltip';
import { useClipboard } from '@/widgets/shared/hooks/useClipboard';
import { Text } from './Typography';
import { Copy } from '@/widgets/shared/components/icons/Icons';
import { motion } from 'motion/react';
import { iconAnimations } from '@/widgets/shared/animation/presets';
import { AnimationLabels } from '@/widgets/shared/animation/constants';

export function CopyToClipboard({ text, iconClassName }: { text: string; iconClassName?: string }) {
  const { hasCopied, onCopy } = useClipboard(text);

  return (
    <Tooltip open={hasCopied}>
      <TooltipTrigger asChild>
        <motion.div
          data-testid="copy-to-clipboard"
          whileTap={{ scale: 0.8 }}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
          exit={AnimationLabels.exit}
          variants={iconAnimations}
        >
          <Copy
            onClick={onCopy}
            className={cn('hover:text-textEmphasis cursor-pointer transition-colors', iconClassName)}
          />
        </motion.div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent>
          <Text>Copied</Text>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
