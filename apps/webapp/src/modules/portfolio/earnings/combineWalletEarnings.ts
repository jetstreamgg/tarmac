import type { CombinedEarnings, EarningsFigure, EarningsSourceId, Maybe, ProtocolEarnings } from './types';

/**
 * Folds per-protocol figures into the combined footer stats: Σ over ok
 * figures only, with notAvailable sources listed per window so the UI can
 * flag partial data (and render a dash instead of $0 when everything is
 * missing). Ignores isLoading — the aggregator hook surfaces loading state.
 */
export function combineWalletEarnings(protocols: ProtocolEarnings[]): CombinedEarnings {
  const fold = (pick: (p: ProtocolEarnings) => Maybe<EarningsFigure>) => {
    let usd = 0;
    const missing: EarningsSourceId[] = [];
    for (const protocol of protocols) {
      const figure = pick(protocol);
      if (figure.status === 'ok') usd += figure.value.usd;
      else missing.push(protocol.id);
    }
    return { usd, missing };
  };

  const total = fold(p => p.totalEarned);
  const month = fold(p => p.earnedThisMonth);

  return {
    totalEarnedUsd: total.usd,
    earnedThisMonthUsd: month.usd,
    missingFromTotal: total.missing,
    missingFromMonth: month.missing
  };
}
