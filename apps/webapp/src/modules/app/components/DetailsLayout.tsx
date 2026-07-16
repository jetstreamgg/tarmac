import React from 'react';
import { motion } from 'motion/react';
import { ConvertIntent, Intent } from '@/lib/enums';
import { easeOutExpo } from '@/modules/ui/animation/timingFunctions';
import { cardAnimations } from '@/modules/ui/animation/presets';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import { ConnectCard } from '@/modules/layout/components/ConnectCard';
import { FooterLinks } from '@/modules/layout/components/FooterLinks';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { BP, useBreakpointIndex } from '@/hooks';

type DetailsLayoutProps = {
  /** Module the details belong to, for the connect-card gating and copy. */
  intent: Intent;
  /** Active convert submodule, when the module is Convert. */
  convertOption?: ConvertIntent;
  /**
   * Identity of the details content: changing it remounts the content and
   * replays the enter animation (submodule/detail switches within a module).
   */
  contentKey?: string;
  children: React.ReactNode;
};

/**
 * Chrome of the details pane for per-route pane pairs: the `details-pane`
 * panel, the connect card for disconnected users, and the footer links on
 * mobile. The content plays the card enter animation when the route content
 * mounts.
 */
export function DetailsLayout({ intent, convertOption, contentKey, children }: DetailsLayoutProps) {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { bpi } = useBreakpointIndex();

  const showConnectCard =
    intent !== Intent.BALANCES_INTENT &&
    !isConnectedAndAcceptedTerms &&
    !(intent === Intent.CONVERT_INTENT && convertOption === ConvertIntent.PSM_INTENT);

  return (
    // The remaining padding in the right is added by the scrollbar
    // `details-pane` class is kept as a hook for the pane-visibility e2e locators
    <motion.div
      className="scrollbar-thin-always details-pane bg-panel flex w-full flex-col gap-4 p-3 md:overflow-auto md:rounded-3xl md:p-6 md:pr-3.5 xl:p-8 xl:pr-[22px]"
      layout
      key="details-pane"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ layout: { duration: 0 }, opacity: { duration: 0.5, ease: easeOutExpo } }}
    >
      {showConnectCard && <ConnectCard intent={intent} convertOption={convertOption} />}
      <motion.div
        key={contentKey}
        variants={cardAnimations}
        initial={AnimationLabels.initial}
        animate={AnimationLabels.animate}
      >
        {children}
      </motion.div>
      {bpi < BP.md && <FooterLinks />}
    </motion.div>
  );
}
