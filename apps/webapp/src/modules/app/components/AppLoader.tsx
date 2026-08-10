import { useCallback, useEffect, useState } from 'react';
import { useConnection } from 'wagmi';
import { motion } from 'motion/react';
import { hasAnyPortfolioDecision, readPortfolioDecision } from '@/lib/portfolioDecisionCache';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { IllustrationSkyLogomark } from '@/modules/icons/IllustrationSkyLogomark';

/**
 * First-visit app loader (Figma "App Loader", 1875:6834): the Sky logomark
 * spins and pops over the bare page background while the app's first data
 * load runs, then the chrome and page content fade in. One-shot — the Figma
 * loop becomes a single ~2.2s timeline, and a played flag plus the cached
 * portfolio decision keep it to a wallet's genuine first visit, never a
 * routine refresh (which paints instantly from the cache instead).
 *
 * Ship/no-ship is still a team decision — this constant is the toggle.
 */
const APP_LOADER_ENABLED = true;

const PLAYED_KEY = 'appLoader:v1:played';

/**
 * - `off`    — never triggered this page load; the layout renders untouched.
 * - `cover`  — chrome + content hidden, the logomark timeline playing.
 * - `reveal` — overlay gone; chrome and content run their entrance and rest.
 */
export type AppLoaderPhase = 'off' | 'cover' | 'reveal';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const hasPlayed = () => {
  try {
    return localStorage.getItem(PLAYED_KEY) !== null;
  } catch {
    return true; // unreadable storage: assume played rather than risk repeats
  }
};

const markPlayed = () => {
  try {
    localStorage.setItem(PLAYED_KEY, String(Date.now()));
  } catch {
    // ignore storage write failures (private mode, quota)
  }
};

/**
 * Whether to start covered on this page load, decided synchronously at first
 * render so the cover is up from the very first paint. wagmi hasn't resolved
 * an address yet at that point ('reconnecting' = a persisted connection is
 * being restored), so the cache check is browser-wide, not per-address.
 */
const entryGate = (status: string) =>
  APP_LOADER_ENABLED &&
  status === 'reconnecting' &&
  !hasPlayed() &&
  !hasAnyPortfolioDecision() &&
  !prefersReducedMotion();

/**
 * Owns the loader phase for the shell. Two ways in, both "first visit" shaped:
 * the entry gate above (refresh while a first-visit wallet reconnects), and a
 * mid-session first connect — the predicate `connected + terms accepted + no
 * cached decision`, deliberately state- not event-based so wagmi's silent
 * auto-reconnect on every refresh can't retrigger it.
 */
export function useAppLoader(): { phase: AppLoaderPhase; endCover: () => void } {
  const { status, address } = useConnection();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const [phase, setPhase] = useState<AppLoaderPhase>(() => (entryGate(status) ? 'cover' : 'off'));

  useEffect(() => {
    if (phase === 'cover') markPlayed();
  }, [phase]);

  // Mid-session first connect, adjusted during render (not in an effect) so
  // the cover is up on the same frame the predicate flips true. The reads are
  // idempotent, `hasPlayed` short-circuits them away once it has run, and
  // re-entry needs no extra guard — the phase never returns to `off`.
  if (
    phase === 'off' &&
    APP_LOADER_ENABLED &&
    isConnectedAndAcceptedTerms &&
    !!address &&
    !hasPlayed() &&
    !readPortfolioDecision(address) &&
    !prefersReducedMotion()
  ) {
    setPhase('cover');
  }

  const endCover = useCallback(() => setPhase(p => (p === 'cover' ? 'reveal' : p)), []);

  return { phase, endCover };
}

/**
 * Reveal dress for the layout regions the loader hides and re-introduces:
 * hidden while covered, then a one-shot entrance off the Figma timeline —
 * `content` (1875:6837) fades in rising 30px over 300ms, `chrome` (1875:6836,
 * the navbars) just fades over 625ms; both on the house quint-out. `both`
 * fill keeps them hidden through the pre-animation frame.
 */
export function appLoaderRevealClasses(
  phase: AppLoaderPhase,
  region: 'content' | 'chrome'
): string | undefined {
  if (phase === 'off') return undefined;
  if (phase === 'cover') return 'opacity-0';
  return region === 'content' ? 'animate-app-loader-content-reveal' : 'animate-app-loader-chrome-reveal';
}

/**
 * The covered stage: just the 64px logomark centered on the (already bare —
 * everything else is opacity-0) page background. Timeline from the Figma
 * motion spec, cut at the point the icon has shrunk away instead of looping:
 * ~1.5 CCW turns easing out, a pop to 1.6x, then collapse to 0 by 1.6s.
 */
export function AppLoaderOverlay({ phase, onCoverEnd }: { phase: AppLoaderPhase; onCoverEnd: () => void }) {
  if (phase !== 'cover') return null;
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      data-testid="app-loader"
      aria-hidden
    >
      <motion.div
        animate={{ rotate: [0, -560, -640], scale: [1, 1, 1.6, 0] }}
        transition={{
          rotate: { duration: 1.6, times: [0, 0.75, 1], ease: [[0, 0, 0.3, 1], 'easeIn'] },
          scale: {
            duration: 1.6,
            times: [0, 0.63, 0.75, 1],
            ease: ['linear', [0, 0, 0, 1], [0.7, 0, 1, 1]]
          }
        }}
        onAnimationComplete={onCoverEnd}
      >
        <IllustrationSkyLogomark className="size-16" />
      </motion.div>
    </div>
  );
}

export const APP_LOADER_PLAYED_KEY = PLAYED_KEY;
