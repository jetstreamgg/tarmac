import type {
  EarningsFigure,
  EarningsSourceId,
  Maybe,
  PendleSplit,
  ProtocolEarnings,
  TokenAmount,
  WalletEarnings
} from './types';

/** Per-position slice of WalletEarnings for the "Already earned" stat and hover-focus. */
export type PositionEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
  missingFromTotal: EarningsSourceId[];
  missingFromMonth: EarningsSourceId[];
  pendleSplit?: PendleSplit;
};

const tokensOf = (figure: EarningsFigure): TokenAmount[] =>
  figure.byToken ?? (figure.native ? [figure.native] : []);

/** Sums ok contributor figures; merges token amounts by symbol (first-seen order). */
function mergeFigures(contributors: { id: EarningsSourceId; figure: Maybe<EarningsFigure> }[]): {
  figure: Maybe<EarningsFigure>;
  missing: EarningsSourceId[];
} {
  const missing = contributors.filter(c => c.figure.status === 'notAvailable').map(c => c.id);
  const okFigures = contributors.flatMap(c => (c.figure.status === 'ok' ? [c.figure.value] : []));

  if (okFigures.length === 0) {
    const first = contributors[0].figure;
    return {
      figure: {
        status: 'notAvailable',
        reason: first.status === 'notAvailable' ? first.reason : 'source-error'
      },
      missing
    };
  }

  const usd = okFigures.reduce((acc, f) => acc + f.usd, 0);
  const bySymbol = new Map<string, number>();
  for (const { amount, symbol } of okFigures.flatMap(tokensOf)) {
    bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + amount);
  }
  const merged = [...bySymbol.entries()].map(([symbol, amount]) => ({ amount, symbol }));

  const figure: EarningsFigure =
    merged.length === 1 ? { usd, native: merged[0] } : merged.length > 1 ? { usd, byToken: merged } : { usd };
  return { figure: { status: 'ok', value: figure }, missing };
}

/**
 * Maps a marketplace row to its earnings slice: the Flagship vault row sums
 * Morpho pnl + vault-attributed Merkl rewards; other rows have one source.
 * Rows outside APP-450 scope (other vaults, rewards, L2-only) return null →
 * the UI renders a dash.
 */
export function earningsForPosition(earnings: WalletEarnings, rowId: string): PositionEarnings | null {
  const contributors = earnings.protocols.filter(p => p.rowIds.includes(rowId));
  if (contributors.length === 0) return null;

  const pick = (select: (p: ProtocolEarnings) => Maybe<EarningsFigure>) =>
    mergeFigures(contributors.map(p => ({ id: p.id, figure: select(p) })));

  const total = pick(p => p.totalEarned);
  const month = pick(p => p.earnedThisMonth);
  const pendleSplit = contributors.find(p => p.pendleSplit)?.pendleSplit;

  return {
    totalEarned: total.figure,
    earnedThisMonth: month.figure,
    missingFromTotal: total.missing,
    missingFromMonth: month.missing,
    ...(pendleSplit ? { pendleSplit } : {})
  };
}
