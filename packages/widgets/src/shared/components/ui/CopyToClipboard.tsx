import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '@widgets/components/ui/tooltip';
import { useClipboard } from '@widgets/shared/hooks/useClipboard';
import { Text } from './Typography';
import { Copy } from '@widgets/shared/components/icons/Icons';
import { motion } from 'framer-motion';
import { iconAnimations } from '@widgets/shared/animation/presets';
import { AnimationLabels } from '@widgets/shared/animation/constants';

export function CopyToClipboard({ text }: { text: string }) {
  const { hasCopied, onCopy } = useClipboard(text);

  return (
    <Tooltip open={hasCopied}>
      <TooltipTrigger asChild>
        <motion.div
          whileTap={{ scale: 0.8 }}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
          exit={AnimationLabels.exit}
          variants={iconAnimations}
        >
          <Copy onClick={onCopy} className="hover:text-textEmphasis cursor-pointer transition-colors" />
        </motion.div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent>
          <Text>Copied</Text>
          <TooltipArrow />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
