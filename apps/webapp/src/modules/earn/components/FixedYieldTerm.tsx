import { Trans } from '@lingui/react/macro';

/**
 * The "how long you're fixing for" sentence on the fixed-yield surfaces. The
 * day count is floored (`remainingDaysToMaturity`), so the last stretch before
 * expiry lands on 0 — stated as "less than a day" rather than "0 days", and
 * deliberately not "today": the count floors against a UTC-anchored expiry, so
 * a calendar-day claim would be wrong for viewers west of UTC. One day gets its
 * own sentence so the plural never reads "1 days".
 */
export function FixedYieldTerm({ rate, days }: { rate: string; days?: number }) {
  if (days === undefined) return null;
  if (days === 0) return <Trans>This market matures in less than a day.</Trans>;
  if (days === 1) return <Trans>Fix your yield at {rate} APY for one more day.</Trans>;
  return (
    <Trans>
      Fix your yield at {rate} APY for the next {days} days.
    </Trans>
  );
}
