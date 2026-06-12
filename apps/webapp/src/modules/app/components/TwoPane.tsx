import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/utils';
import { Text } from '@/modules/layout/components/Typography';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { cardAnimations } from '@/modules/ui/animation/presets';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import { paneContentClasses, useShellChrome } from '../context/ShellChromeContext';

type TwoPaneProps = {
  /** Widget pane content for the matched route. */
  widget: React.ReactNode;
  /** Details pane content for the matched route. */
  details: React.ReactNode;
};

/**
 * Two-pane content of a module route: the widget pane rendered inside the
 * navigation column, and the details pane — inline below the widget on
 * mobile, portaled next to the navigation column on md+ (the shell provides
 * the slot). Plays the card enter animation when the route content mounts.
 */
export function TwoPane({ widget, details }: TwoPaneProps) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const { isSwitchingNetwork } = useNetworkSwitch();
  const { paneStyle, detailsSlot } = useShellChrome();

  if (isSwitchingNetwork) {
    return (
      <div
        className={cn(paneContentClasses, 'flex flex-1 flex-col items-center justify-center')}
        style={paneStyle}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-textSecondary h-8 w-8 animate-spin" />
          <Text variant="medium" className="text-textSecondary">
            <Trans>Switching network...</Trans>
          </Text>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Single element on purpose: the legacy TabsContent merged its classes
          into the motion.div via asChild, and the height chain (flex-1 within
          the navigation column) depends on it. */}
      <motion.div
        variants={cardAnimations}
        initial={AnimationLabels.initial}
        animate={AnimationLabels.animate}
        style={paneStyle}
        className={cn(
          paneContentClasses,
          'flex flex-col',
          'flex-1 overflow-y-auto md:pr-0 lg:overflow-hidden',
          isMobile ? 'scroll-mt-[87px]' : 'scroll-mt-[0px]'
        )}
      >
        {widget}
      </motion.div>
      {bpi === BP.sm && details}
      {bpi > BP.sm && detailsSlot && createPortal(details, detailsSlot)}
    </>
  );
}
