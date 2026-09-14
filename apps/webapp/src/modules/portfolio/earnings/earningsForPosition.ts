import { isMainnetId } from '@/utils/isMainnetId';
import type {
  EarningsCoverage,
  EarningsFigure,
  EarningsSourceId,
  Maybe,
  MissingSourceDetail,
  PendleSplit,
  ProtocolEarnings,
  TokenAmount,
  WalletEarnings
} from './types';

/** Per-position slice of WalletEarnings for the "Already earned" stat and hover-focus. */
export type PositionEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
  missingFromTotal: MissingSourceDetail[];
  missingFromMonth: MissingSourceDetail[];
  pendleSplit?: PendleSplit;
  /** A contributor's coverage caveat (savings is mainnet-only — finding #3). */
  coverage?: EarningsCoverage;
};

const tokensOf = (figure: EarningsFigure): TokenAmount[] =>
  figure.byToken ?? (figure.native ? [figure.native] : []);

/** Sums ok contributor figures; merges token amounts by symbol (first-seen order). */
function mergeFigures(
  contributors: { id: EarningsSourceId; label?: string; figure: Maybe<EarningsFigure> }[]
): {
  figure: Maybe<EarningsFigure>;
  missing: MissingSourceDetail[];
} {
  const missing = contributors.flatMap(c =>
    c.figure.status === 'notAvailable'
      ? [{ id: c.id, reason: c.figure.reason, ...(c.label ? { label: c.label } : {}) }]
      : []
  );
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
 * Rows with no earnings source (reward/staking rows) return null → the UI
 * renders a dash.
 */
export function earningsForPosition(earnings: WalletEarnings, rowId: string): PositionEarnings | null {
  const contributors = earnings.protocols.filter(p => p.rowIds.includes(rowId));
  if (contributors.length === 0) return null;

  const pick = (select: (p: ProtocolEarnings) => Maybe<EarningsFigure>) =>
    mergeFigures(contributors.map(p => ({ id: p.id, label: p.label, figure: select(p) })));

  const total = pick(p => p.totalEarned);
  const month = pick(p => p.earnedThisMonth);
  const pendleSplit = contributors.find(p => p.pendleSplit)?.pendleSplit;
  const coverage = contributors.find(p => p.coverage)?.coverage;

  return {
    totalEarned: total.figure,
    earnedThisMonth: month.figure,
    missingFromTotal: total.missing,
    missingFromMonth: month.missing,
    ...(pendleSplit ? { pendleSplit } : {}),
    ...(coverage ? { coverage } : {})
  };
}

/**
 * The earnings slice for one supplied position. Every source behind
 * `useWalletEarnings` is read against mainnet, so a product's L2 leg (sUSDS on
 * Base, say — one position per chain since APP-547) has no figure of its own:
 * it returns null and renders a dash rather than repeating the mainnet leg's.
 */
export function earningsForSuppliedPosition(
  earnings: WalletEarnings,
  position: { rowId: string; chainId: number }
): PositionEarnings | null {
  return isMainnetId(position.chainId) ? earningsForPosition(earnings, position.rowId) : null;
}
