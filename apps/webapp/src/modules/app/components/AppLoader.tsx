import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useConnection, useConnectionEffect } from 'wagmi';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { motion, type Transition } from 'motion/react';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import {
  hasAnyPortfolioDecision,
  readPortfolioDecision,
  writePortfolioDecision
} from '@/lib/portfolioDecisionCache';
import { useEarnMarketplace } from '@/hooks';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useStablecoinBalances } from '@/modules/portfolio/hooks/useStablecoinBalances';
import { useGeoVisibleRows } from '@/modules/portfolio/hooks/useGeoVisibleRows';
import { useGeoConfig } from '@/modules/geo-config';
import { portfolioCallout, SIGNIFICANT_BALANCE_USD } from '@/modules/portfolio/helpers/portfolioCallout';
import { IllustrationSkyLogomark } from '@/modules/icons/IllustrationSkyLogomark';

/**
 * First-visit app loader (Figma "App Loader", 1875:6834): the Sky logomark
 * spins over the bare page background while the app's first data load runs,
 * then the chrome and page content fade in. The entry-gate play is once per
 * browser (a persistent played flag — no address is known yet at that point);
 * the manual-connect play is once per wallet: the address's cached decision
 * gates it, so every new address gets covered while its own data fetches, and
 * a routine reconnect paints instantly from the cache instead.
 *
 * On a manual first connect the cover doubles as the landing sorter (Routing
 * & IA #3 / APP-295): the portfolio queries run behind it, the settled
 * outcome is cached, and — when the user sits on a home surface (/portfolio
 * or /earn) — the reveal lands them on the right one. Deeper pages are never
 * redirected: a connect that is part of a product flow must stay put.
 *
 * Ship/no-ship is still a team decision — this constant is the toggle.
 */
const APP_LOADER_ENABLED = true;

const PLAYED_KEY = 'appLoader:v1:played';

/**
 * The held cover runs at least this long (lets the spin read as intentional
 * and outlives the balances query's enable-flip frame, so a settle is never
 * computed from a not-yet-started fetch), and at most the cap (a wedged query
 * must not hold the app hostage — release without sorting instead).
 */
const MIN_HOLD_MS = 1200;
const HOLD_CAP_MS = 8000;

/**
 * Failsafe bound on the cover's exit animation: `onAnimationComplete` is the
 * only organic way out of `cover`, and the overlay sits outside every
 * ErrorBoundary. If motion never fires it — a crash in the subtree, a dropped
 * animation, a background tab freezing the rAF-driven timeline — the reveal is
 * forced after this long instead of leaving the app blank with no way out.
 * Comfortably past the longest timeline it guards (the 1.6s entry one-shot).
 */
const COVER_WATCHDOG_MS = 2500;

/**
 * - `off`    — never triggered this page load; the layout renders untouched.
 * - `cover`  — chrome + content hidden, the logomark timeline playing.
 * - `reveal` — overlay gone; chrome and content run their entrance and rest.
 */
export type AppLoaderPhase = 'off' | 'cover' | 'reveal';

/**
 * - `timed` — the entry-gate play: a fixed one-shot of the Figma timeline.
 * - `held`  — the manual-connect play: the spin loops until the landing
 *             decision settles (or the cap), then the exit pop releases it.
 */
export type AppLoaderCoverMode = 'timed' | 'held';

/** Only these surfaces get sorted; anywhere else the user stays put. */
const sortableSurface = (pathname: string): string | null =>
  pathname === ROUTES.PORTFOLIO || pathname === ROUTES.EARN ? pathname : null;

const landingFor = (outcome: 'none' | 'allocate' | 'simulate') =>
  outcome === 'none' ? ROUTES.PORTFOLIO : ROUTES.EARN;

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

type SortJob = {
  address: string;
  /** The home surface the user connected from, or null (visual cover only). */
  surface: string | null;
};

export function useAppLoader(): {
  phase: AppLoaderPhase;
  coverMode: AppLoaderCoverMode;
  released: boolean;
  /** False when the cover exited under an open transaction modal (APP-515). */
  revealAnimated: boolean;
  endCover: () => void;
} {
  const { status, address } = useConnection();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { isModalOpen: txModalOpen } = useTransaction();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();

  const [phase, setPhase] = useState<AppLoaderPhase>(() => (entryGate(status) ? 'cover' : 'off'));
  const [coverMode, setCoverMode] = useState<AppLoaderCoverMode>('timed');
  const [released, setReleased] = useState(false);
  const [holdElapsed, setHoldElapsed] = useState(false);
  // A manual (never auto-reconnect) connect waiting for terms acceptance.
  const [pendingConnect, setPendingConnect] = useState<string | null>(null);
  const [sort, setSort] = useState<SortJob | null>(null);
  // A cached-decision connect resolves its landing instantly, no cover needed.
  // Wrapped in an object: each connect must re-fire the navigation effect even
  // when the target string repeats (disconnect → reconnect from the same
  // surface), and a bare string would be identity-equal and never re-run it.
  const [instantTarget, setInstantTarget] = useState<{ to: string } | null>(null);
  const sortDoneRef = useRef(false);

  // These queries are shared with the Portfolio/Earn pages (react-query
  // dedupes by key), so mounting them here is the approved app-level
  // prefetch: by the time either page mounts, the data is warm or in flight.
  // The gate is the positions-only flag: the landing decision reads nothing
  // but `row.position`, and the full `isLoading` waits on rate/chart history
  // from external APIs that can outlive the hold cap.
  const { rows, isPositionsLoading: marketLoading, isPositionsError: marketError } = useEarnMarketplace();
  const visibleRows = useGeoVisibleRows(rows);
  const {
    balances,
    isLoading: balancesLoading,
    isError: balancesError,
    isFetched: balancesFetched
  } = useStablecoinBalances();
  const { isLoading: geoLoading } = useGeoConfig();
  const decisionLoading = marketLoading || balancesLoading || geoLoading;
  const decisionError = marketError || balancesError;
  const depositedUsd = visibleRows.reduce((acc, row) => acc + (row.position?.totalUsd ?? 0), 0);
  const idleUsd = balances.reduce((acc, balance) => acc + balance.amountUsd, 0);

  // The address whose fetch cycle has been observed loading. Guards the
  // background writer below against the enable-flip frame: when a connect
  // lands, the address is set one render before the address-keyed queries
  // start fetching, so for that frame the sources read "settled" while
  // actually holding nothing — a write there would cache an empty wallet.
  const fetchSeenForRef = useRef<string | null>(null);
  useEffect(() => {
    if (address && decisionLoading) fetchSeenForRef.current = address;
  }, [address, decisionLoading]);

  // Background writer: these queries stay mounted on every route, so a settle
  // that changes the totals — first load, a position-changing tx's refetch, a
  // wiped cache — plus the first settle of every page load refreshes the
  // connected address's decision no matter where the user is. Readers freeze
  // at mount, so this never swaps a view; it only makes the next mount and
  // the next `/` landing current. Armed by an observed loading cycle for this
  // address, or by the balances query having fetched at least once under this
  // address's key (`isFetched`) — an account switched back to inside gcTime
  // resolves from warm cache without ever re-asserting isLoading, and its tx
  // refetches must still land here. Both arms are false across the
  // enable-flip frame, which is the case the guard exists for.
  useEffect(() => {
    if (!address || decisionLoading || decisionError) return;
    if (fetchSeenForRef.current !== address && !balancesFetched) return;
    writePortfolioDecision(address, {
      outcome: portfolioCallout(depositedUsd, idleUsd),
      tab: depositedUsd <= SIGNIFICANT_BALANCE_USD ? 'idle' : 'supplied'
    });
  }, [address, decisionLoading, decisionError, balancesFetched, depositedUsd, idleUsd]);

  useConnectionEffect({
    onConnect: data => {
      // Event- not state-based on purpose: wagmi's silent auto-reconnect on
      // every refresh must never read as "the user just connected".
      if (!data.isReconnected) setPendingConnect(data.address);
    }
  });

  useEffect(() => {
    if (phase === 'cover') markPlayed();
  }, [phase]);

  // Surfaces mounted outside Layout (the toast stack in App.tsx) can't wear
  // the reveal classes; they hide themselves off this document flag instead
  // (`.app-loader-cover-hidden` in globals.css). Layout effect, not passive:
  // the reveal classes hide their surfaces on the cover's very first painted
  // frame (render-computed), and the flag must land before that same paint or
  // a toast flashes over the bare cover frame and blinks off.
  useLayoutEffect(() => {
    if (phase !== 'cover') return;
    document.documentElement.setAttribute('data-app-loader-cover', '');
    return () => document.documentElement.removeAttribute('data-app-loader-cover');
  }, [phase]);

  // Consume the manual connect once terms are in, adjusted during render (not
  // in an effect) so the cover is up on the same frame. A cached decision
  // resolves the landing instantly instead; the navigation itself is a side
  // effect and runs in the effect below.
  if (pendingConnect && isConnectedAndAcceptedTerms) {
    setPendingConnect(null);
    const surface = sortableSurface(pathname);
    const hint = readPortfolioDecision(pendingConnect);
    if (hint) {
      const target = landingFor(hint.outcome);
      if (surface && target !== surface) setInstantTarget({ to: target });
    } else if (phase === 'off' && APP_LOADER_ENABLED && !prefersReducedMotion()) {
      // No cached decision for THIS address (first visit or expired TTL): the
      // held cover plays regardless of the browser-wide played flag — the
      // fetch and sort are per wallet, so the cover that masks them is too.
      setPhase('cover');
      setCoverMode('held');
      setSort({ address: pendingConnect, surface });
    }
  }

  useEffect(() => {
    if (!instantTarget) return;
    // viewTransition: false — a cached-decision connect can land while the
    // transaction modal is open, and the transition would flash the incoming
    // page above its scrim (APP-515).
    void navigate({ to: instantTarget.to, search: retainOnNavigate, replace: true, viewTransition: false });
  }, [instantTarget, navigate]);

  // The held cover's clock: minimum hold, then the safety cap.
  useEffect(() => {
    if (phase !== 'cover' || coverMode !== 'held') return;
    const minHold = setTimeout(() => setHoldElapsed(true), MIN_HOLD_MS);
    const cap = setTimeout(() => setReleased(true), HOLD_CAP_MS);
    return () => {
      clearTimeout(minHold);
      clearTimeout(cap);
    };
  }, [phase, coverMode]);

  // A reveal under the transaction modal's frosted scrim skips the entrance
  // animation (APP-515): the modal card returning is the only motion the user
  // should see — content rising behind the frost reads as a flash of the page.
  // Latched at release (not live) so closing the modal later never replays the
  // entrance; a ref because endCover fires from animation callbacks.
  const [revealAnimated, setRevealAnimated] = useState(true);
  const txModalOpenRef = useRef(txModalOpen);
  useEffect(() => {
    txModalOpenRef.current = txModalOpen;
  }, [txModalOpen]);

  const endCover = useCallback(() => {
    if (txModalOpenRef.current) setRevealAnimated(false);
    setPhase(p => (p === 'cover' ? 'reveal' : p));
  }, []);

  // Watchdog on the exiting cover (timed plays from the start; held once
  // `released` — until then the hold cap above is the bound): if the timeline
  // never reports completion, force the reveal rather than stay blank.
  useEffect(() => {
    if (phase !== 'cover' || (coverMode === 'held' && !released)) return;
    const watchdog = setTimeout(endCover, COVER_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [phase, coverMode, released, endCover]);

  // Settle the sort: cache the outcome, land the user, release the cover.
  // Runs at most once (ref-guarded); if the cap released the cover first, the
  // outcome still gets cached but nobody is yanked post-reveal.
  useEffect(() => {
    if (!sort || sortDoneRef.current || !holdElapsed || decisionLoading) return;
    sortDoneRef.current = true;
    // A failed source settles as empty data, indistinguishable from an empty
    // wallet — caching that would freeze a wrong outcome for 30 days, and
    // sorting on it could land a funded wallet on the simulate pitch. On
    // error the cover just releases, unsorted and uncached; the next connect
    // gets a fresh try. Same bail when the live address no longer matches the
    // connect that armed this job (an account switch while the terms modal
    // held it): every balance figure belongs to the new address, so writing
    // it under sort.address would cache one wallet's totals for another.
    if (!decisionError && address === sort.address) {
      const outcome = portfolioCallout(depositedUsd, idleUsd);
      writePortfolioDecision(sort.address, {
        outcome,
        tab: depositedUsd <= SIGNIFICANT_BALANCE_USD ? 'idle' : 'supplied'
      });
      if (sort.surface && !released) {
        const target = landingFor(outcome);
        // viewTransition: false — the swap happens under the cover (or the
        // transaction modal's scrim), and a view transition's snapshots paint
        // in the top layer ABOVE both, flashing the incoming page (APP-515).
        if (target !== sort.surface)
          void navigate({ to: target, search: retainOnNavigate, replace: true, viewTransition: false });
      }
    }
    setReleased(true);
  }, [sort, holdElapsed, decisionLoading, decisionError, address, depositedUsd, idleUsd, released, navigate]);

  return { phase, coverMode, released, revealAnimated, endCover };
}

/**
 * Reveal dress for the layout regions the loader hides and re-introduces:
 * hidden while covered, then a one-shot entrance off the Figma timeline —
 * `content` (1875:6837) fades in rising 30px over 300ms, `chrome` (1875:6836,
 * the navbars) just fades over 625ms; both on the house quint-out. The fill
 * keeps them hidden through the pre-animation frame — `backwards` on `content`
 * (a forwards fill there would pin a lingering identity transform on the page
 * wrapper and kill every glass card's backdrop-filter; see globals.css),
 * `both` on `chrome`, which animates opacity only.
 */
export function appLoaderRevealClasses(
  phase: AppLoaderPhase,
  region: 'content' | 'chrome',
  animated = true
): string | undefined {
  if (phase === 'off') return undefined;
  // Inert as well as invisible: opacity-0 alone keeps the hidden chrome and
  // content clickable, and the overlay deliberately lets pointer events
  // through (so a dialog opening during the cover — the terms modal mounts
  // above Layout — stays usable).
  if (phase === 'cover') return 'pointer-events-none opacity-0';
  if (!animated) return undefined;
  return region === 'content' ? 'animate-app-loader-content-reveal' : 'animate-app-loader-chrome-reveal';
}

/** The fixed one-shot of the Figma timeline (entry-gate plays). */
const TIMED_ANIMATE = { rotate: [0, -560, -640], scale: [1, 1, 1.6, 0] };
const TIMED_TRANSITION: Transition = {
  rotate: { duration: 1.6, times: [0, 0.75, 1], ease: [[0, 0, 0.3, 1], 'easeIn'] },
  scale: { duration: 1.6, times: [0, 0.63, 0.75, 1], ease: ['linear', [0, 0, 0, 1], [0.7, 0, 1, 1]] }
};

/**
 * The held spin: two full turns per cycle at the comp's angular speed
 * (-640deg over 1.6s), so the loop reset lands on the same orientation and
 * the spin reads as continuous for as long as the decision takes.
 */
const SPIN_ANIMATE = { rotate: -720 };
const SPIN_TRANSITION: Transition = { rotate: { duration: 1.8, ease: 'linear', repeat: Infinity } };

/** The held exit: the timeline's pop-to-1.6x-then-collapse tail. */
const EXIT_ANIMATE = { scale: [1, 1.6, 0] };
const EXIT_TRANSITION: Transition = {
  scale: {
    duration: 0.6,
    times: [0, 0.35, 1],
    ease: [
      [0, 0, 0, 1],
      [0.7, 0, 1, 1]
    ]
  }
};

/**
 * The covered stage: just the 64px logomark centered on the (already bare —
 * everything else is opacity-0) page background. `timed` plays the Figma
 * one-shot; `held` loops the spin until `released`, then pops out — one
 * element throughout, so the exit starts from the live rotation.
 */
export function AppLoaderOverlay({
  phase,
  mode,
  released,
  onCoverEnd
}: {
  phase: AppLoaderPhase;
  mode: AppLoaderCoverMode;
  released: boolean;
  onCoverEnd: () => void;
}) {
  if (phase !== 'cover') return null;
  const timed = mode === 'timed';
  return (
    <div
      className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center"
      data-testid="app-loader"
      aria-hidden
    >
      <motion.div
        animate={timed ? TIMED_ANIMATE : released ? EXIT_ANIMATE : SPIN_ANIMATE}
        transition={timed ? TIMED_TRANSITION : released ? EXIT_TRANSITION : SPIN_TRANSITION}
        onAnimationComplete={timed || released ? onCoverEnd : undefined}
      >
        <IllustrationSkyLogomark className="size-16" />
      </motion.div>
    </div>
  );
}

export const APP_LOADER_PLAYED_KEY = PLAYED_KEY;
