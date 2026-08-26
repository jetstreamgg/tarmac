import { motion, type Transition } from 'motion/react';
import { cn } from '@/lib/cn';
import { IllustrationSkyLogomark } from '@/modules/icons/IllustrationSkyLogomark';

/**
 * The held spin of the App Loader (Figma "App Loader", 1875:6834): two full
 * turns per cycle at the comp's angular speed (-640deg over 1.6s), so the loop
 * reset lands on the same orientation and the spin reads as continuous for as
 * long as the wait takes.
 */
export const SPIN_ANIMATE = { rotate: -720 };
export const SPIN_TRANSITION: Transition = { rotate: { duration: 1.8, ease: 'linear', repeat: Infinity } };

/**
 * The loader glyph on its own, for covers that wait on a check rather than on
 * the app's first data load — the connect-time compliance checks
 * (ConnectChecksCover). No exit pop: that cover hands off to a modal, so it
 * cross-fades out instead of collapsing, which also means this can be a plain
 * looping element rather than the App Loader's one-element-throughout timeline.
 *
 * The spin is kept under `prefers-reduced-motion`, unlike the App Loader cover
 * (which simply never plays): here it is the only progress affordance on
 * screen, and a frozen wedge reads as a stalled image rather than as "busy".
 */
export function SkyLogomarkSpinner({ className }: { className?: string }) {
  return (
    <motion.div animate={SPIN_ANIMATE} transition={SPIN_TRANSITION}>
      <IllustrationSkyLogomark className={cn('size-16', className)} />
    </motion.div>
  );
}
