import type { EarningsWindow } from './types';

/**
 * Executable specification for the monthly flows method:
 *   earned = endAssets − startAssets − Σdeposits + Σwithdrawals (in window).
 * Each scenario is a hand-derived timeline; `expectedEarned` is written from
 * the visible formula in its comment, never computed by production code.
 * Consumed by computeMorphoEarnings tests (section 3), which map these onto
 * the concrete API input shape.
 */
export type FlowScenario = {
  name: string;
  window: EarningsWindow;
  /** Balance at window start (0 when the position opens mid-window). */
  startAssets: number;
  /** Balance at window end. */
  endAssets: number;
  /** In-window flows: [timestampSec, assets]. Boundary rule: t ≥ startSec is in-window. */
  deposits: [t: number, assets: number][];
  withdrawals: [t: number, assets: number][];
  expectedEarned: number;
};

// August 2026 window (externally anchored: Aug 1 00:00Z = 1785542400; end Aug 19 12:00Z)
const AUG_1 = 1785542400;
const DAY = 86400;
const WINDOW: EarningsWindow = { startSec: AUG_1, endSec: AUG_1 + 18 * DAY + 12 * 3600 };

export const FLOW_SCENARIOS: FlowScenario[] = [
  {
    // Opened Aug 10: baseline is 0, NOT the first sample after entry.
    // earned = 1002.5 − 0 − 1000 + 0 = 2.5
    name: 'mid-month entry',
    window: WINDOW,
    startAssets: 0,
    endAssets: 1002.5,
    deposits: [[AUG_1 + 9 * DAY, 1000]],
    withdrawals: [],
    expectedEarned: 2.5
  },
  {
    // A withdrawal is not a loss. earned = 1503 − 2000 − 0 + 500 = 3
    name: 'partial exit',
    window: WINDOW,
    startAssets: 2000,
    endAssets: 1503,
    deposits: [],
    withdrawals: [[AUG_1 + 11 * DAY, 500]],
    expectedEarned: 3
  },
  {
    // Full exit (1001 out incl. 1 yield), later re-entry with 800 earning 0.4.
    // earned = 800.4 − 1000 − 800 + 1001 = 1.4 (first stint 1 + second stint 0.4)
    name: 'round-trip re-entry',
    window: WINDOW,
    startAssets: 1000,
    endAssets: 800.4,
    deposits: [[AUG_1 + 14 * DAY, 800]],
    withdrawals: [[AUG_1 + 4 * DAY, 1001]],
    expectedEarned: 1.4
  },
  {
    // Deposit at exactly startSec belongs to the window (t ≥ startSec).
    // earned = 5004 − 0 − 5000 + 0 = 4
    name: 'deposit at month boundary (in-window)',
    window: WINDOW,
    startAssets: 0,
    endAssets: 5004,
    deposits: [[AUG_1, 5000]],
    withdrawals: [],
    expectedEarned: 4
  },
  {
    // Same economics, deposited one second BEFORE the window: it lives in the
    // baseline instead of the flow sum. earned = 5004 − 5000 − 0 + 0 = 4
    name: 'deposit just before month boundary (baseline)',
    window: WINDOW,
    startAssets: 5000,
    endAssets: 5004,
    deposits: [],
    withdrawals: [],
    expectedEarned: 4
  },
  {
    // Position opened in July; August only sees the carried balance grow.
    // earned = 1206 − 1200 − 0 + 0 = 6
    name: 'cross-month timeline',
    window: WINDOW,
    startAssets: 1200,
    endAssets: 1206,
    deposits: [],
    withdrawals: [],
    expectedEarned: 6
  },
  {
    // Flows of any shape with no yield must give exactly 0, not ~0.
    // earned = 120 − 100 − 50 + 30 = 0
    name: 'zero yield is exactly zero',
    window: WINDOW,
    startAssets: 100,
    endAssets: 120,
    deposits: [[AUG_1 + 2 * DAY, 50]],
    withdrawals: [[AUG_1 + 9 * DAY, 30]],
    expectedEarned: 0
  },
  {
    // Deposit + immediate withdrawal of the same amount is a no-op.
    // earned = 100 − 100 − 500 + 500 = 0
    name: 'deposit immediately withdrawn is a no-op',
    window: WINDOW,
    startAssets: 100,
    endAssets: 100,
    deposits: [[AUG_1 + 3 * DAY, 500]],
    withdrawals: [[AUG_1 + 3 * DAY + 60, 500]],
    expectedEarned: 0
  }
];
