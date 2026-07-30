import { formatNumber } from '@/utils';

/**
 * When the protocol started operating, as claimed by the Earn hero (APP-432
 * item 3). Drives both the "since 2017" of the subtitle and the "Operating for
 * N years" badge, so the two can never disagree — change this one date and both
 * follow.
 */
export const PROTOCOL_START = new Date(Date.UTC(2017, 0, 1));

/**
 * The `2017` of "…they've been going since 2017". Pre-stringified: as a number
 * it would reach the i18n interpolation as one, and a locale that groups
 * thousands would render it "2,017".
 */
export const protocolStartYear = String(PROTOCOL_START.getUTCFullYear());

/**
 * Whole years the protocol has been operating, as of `now`. Floored — the badge
 * claims completed years, so it only ticks over on the anniversary.
 */
export function yearsOperating(now: Date = new Date()): number {
  let years = now.getUTCFullYear() - PROTOCOL_START.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < PROTOCOL_START.getUTCMonth() ||
    (now.getUTCMonth() === PROTOCOL_START.getUTCMonth() && now.getUTCDate() < PROTOCOL_START.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(years, 0);
}

/**
 * USD total in the hero badge's style (`$11.02B`). Deliberately *not*
 * `formatUsdCompact` — the earn table comps lowercase the magnitude suffix
 * (`$4.71b`), the hero badge (APP-432 item 3) uppercases it.
 */
export function formatCirculation(totalUsd: number): string {
  return `$${formatNumber(totalUsd, { compact: true, amount: totalUsd })}`;
}

/**
 * Same total at the subtitle's coarser whole-unit precision (`$11B`).
 *
 * Floored, not rounded: the subtitle sits directly under the badge, so a total
 * of 9.69B rounding *up* to "$10B" next to a badge reading "$9.69B" looks like
 * one of the two is wrong. Flooring can only ever understate, which reads as
 * deliberate coarseness. (The Figma's 11.02B → "$11B" hid this — it rounds down
 * either way.)
 */
export function formatCirculationCoarse(totalUsd: number): string {
  return `$${formatNumber(totalUsd, {
    compact: true,
    amount: totalUsd,
    maxDecimals: 0,
    roundingMode: 'floor'
  })}`;
}
