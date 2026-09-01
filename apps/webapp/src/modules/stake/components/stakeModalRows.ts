/**
 * Pure cell builders for the SKY Staking confirm modal's detail grid.
 *
 * The Figma comps (486:33412 open, 1104:6429 / 1104:20198 / 1104:21216 manage)
 * only draw the stake and borrow amount heroes; every other staged leg —
 * withdraw, repay, the reward-farm switch, the delegate switch — was left to
 * stack as further full-width From→To blocks, which is what made the modal so
 * tall. The heroes stay (they are the Figma contract); everything else moves
 * into the same two-column `ModalSummaryGrid` the Savings / vault / stUSDS /
 * rewards reviews already use, so the position's numbers read as a grid rather
 * than a column of headings.
 *
 * The cell set is genuinely dynamic here — the borrow cells only exist on a
 * position with debt, the reward/delegate cells only when one is in play — so
 * this builder emits an ORDERED CELL LIST and lets `pairCells` chunk it into
 * rows. Optional cells come in even-sized groups so a collapse never re-pairs
 * unrelated labels.
 */

import { RiskLevel } from '@/hooks';
import {
  networkCell,
  networkFeeCell,
  pairCells,
  rateCell,
  singleOrDelta,
  type CellTone,
  type ModalGridCell
} from '@/components/product/ModalGridCells';

/** One labelled grid cell — the shared modal-grid cell model. */
export type StakeModalCell = ModalGridCell;

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type StakeModalGridRow = StakeModalCell[];

/** One side of the Reward cell: the farm's reward-token symbol (icon) and its display label. */
export type StakeRewardSide = { symbol?: string; label: string };

/** One side of the Delegate cell: display name + the address seeding its identicon. */
export type StakeDelegateSide = { label: string; address?: string };

/** Risk tint on the Risk level cell — the RiskPill palette, as a plain value tone. */
const RISK_TONE: Record<RiskLevel, CellTone> = {
  [RiskLevel.LOW]: 'success',
  [RiskLevel.MEDIUM]: 'warning',
  [RiskLevel.HIGH]: 'error',
  [RiskLevel.LIQUIDATION]: 'error'
};

export const riskTone = (level: RiskLevel | undefined): CellTone | undefined =>
  level ? RISK_TONE[level] : undefined;

/** Display strings for the stake confirm grid. Every figure arrives formatted. */
export type StakeConfirmRowInput = {
  /**
   * False on the open flow, where there is no "before" — every position cell
   * collapses to the value the transaction leaves behind.
   */
  hasPosition: boolean;
  /** Staked SKY before / after the staged legs, formatted (e.g. "1,000.00 SKY"). */
  stakedBefore: string;
  stakedAfter: string;
  /**
   * Annual staking rewards on the position, in USD. The BA Labs rate is a value
   * APR, so the projection is a SKY-equivalent VALUE, not a count of any one
   * token — and a farm switch changes which token it is actually paid in.
   */
  estRewardsBefore: string;
  estRewardsAfter: string;
  /**
   * The staking-reward rate behind the position, formatted (e.g. "5.69%").
   * These differ when a farm switch is staged — the rate the rewards accrue at
   * afterwards is the STAGED farm's, and `estRewardsAfter` must be projected at
   * it, or the review promises a figure the position will never earn.
   */
  rewardRateBefore: string;
  rewardRateAfter: string;
  /** A farm-rate read is in flight — the rate + est-rewards cells hold a skeleton. */
  rateLoading?: boolean;
  /**
   * Borrow leg. Omit on a position with no debt and no borrow staged — the
   * Borrowed / Borrow rate / Risk level / Liquidation price cells then collapse
   * together (an even group, so the pairing stays aligned).
   */
  borrow?: {
    borrowedBefore: string;
    borrowedAfter: string;
    /** Annualized stability fee, formatted. */
    borrowRate: string;
    riskBefore: RiskLevel | undefined;
    riskAfter: RiskLevel | undefined;
    riskLabelBefore: string;
    riskLabelAfter: string;
    liquidationBefore: string;
    liquidationAfter: string;
  };
  /**
   * Reward-farm + delegate selections. Present when either is staged or
   * changing; the untouched one renders its CURRENT value so the pair stays
   * even — and so the review still names the farm the rewards accrue to.
   */
  selections?: {
    rewardBefore: StakeRewardSide;
    rewardAfter: StakeRewardSide;
    rewardChanged: boolean;
    delegateBefore: StakeDelegateSide;
    delegateAfter: StakeDelegateSide;
    delegateChanged: boolean;
  };
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** Network fee, formatted — replaced by the live estimate in `toGridCells`. */
  networkFee: string;
};

/**
 * Ordered cells for the stake confirm grid, chunked into rows of two:
 *
 * ```
 * [ Staked      | Est. 1Y yield     ]
 * [ Borrowed    | Borrow rate       ]  ← debt only
 * [ Risk level  | Liquidation price ]  ← debt only
 * [ Reward      | Delegate          ]  ← when either is in play
 * [ Reward rate | Network           ]  ← deltas on a farm switch
 * [ Network fee                     ]
 * ```
 *
 * A cell whose two sides differ renders the before→after arrow; on the open
 * flow (`hasPosition: false`) every cell collapses to its single value.
 */
export function buildStakeConfirmRows(input: StakeConfirmRowInput): StakeModalGridRow[] {
  const { borrow, selections } = input;
  /**
   * A cell's two sides. Deltas are drawn only where the value actually moves,
   * so an unchanged leg riding along in a mixed bundle reads as a fact, not as
   * a no-op arrow. With no position behind the transaction (the open flow)
   * there is no "before" to arrow from, so the cell states the value the
   * transaction leaves behind.
   */
  const cell = (
    base: Parameters<typeof singleOrDelta>[0],
    before: string,
    after: string,
    moved?: boolean
  ) => {
    if (input.hasPosition) return singleOrDelta(base, before, after, moved ?? before !== after);
    // A single cell has only one side, and `CellValue` reads its glyph and tone
    // from the BEFORE-side hints — so the after-side ones are promoted here
    // rather than silently dropped (a cell reading "USDS" beside the SKY icon).
    const { afterToken, afterAvatar, afterTone, ...rest } = base;
    return {
      ...rest,
      token: afterToken ?? base.token,
      avatar: afterAvatar ?? base.avatar,
      tone: afterTone ?? base.tone,
      kind: 'single',
      value: after
    } as StakeModalCell;
  };

  const cells: StakeModalCell[] = [
    cell({ label: 'Staked', token: 'SKY' }, input.stakedBefore, input.stakedAfter),
    // No token icon: the figure is a USD value, and across a farm switch there
    // is no single token it is paid in.
    cell(
      { label: 'Est. 1Y yield (at current rate)', loading: input.rateLoading },
      input.estRewardsBefore,
      input.estRewardsAfter
    )
  ];

  if (borrow) {
    cells.push(
      cell({ label: 'Borrowed', token: 'USDS' }, borrow.borrowedBefore, borrow.borrowedAfter),
      rateCell('Borrow rate', borrow.borrowRate, undefined, 'sbr'),
      cell(
        { label: 'Risk level', tone: riskTone(borrow.riskBefore), afterTone: riskTone(borrow.riskAfter) },
        borrow.riskLabelBefore,
        borrow.riskLabelAfter
      ),
      cell({ label: 'Liquidation price' }, borrow.liquidationBefore, borrow.liquidationAfter)
    );
  }

  if (selections) {
    const { rewardBefore, rewardAfter, delegateBefore, delegateAfter } = selections;
    cells.push(
      cell(
        { label: 'Reward', token: rewardBefore.symbol, afterToken: rewardAfter.symbol },
        rewardBefore.label,
        rewardAfter.label,
        selections.rewardChanged
      ),
      cell(
        { label: 'Delegate', avatar: delegateBefore.address, afterAvatar: delegateAfter.address },
        delegateBefore.label,
        delegateAfter.label,
        selections.delegateChanged
      )
    );
  }

  cells.push(
    cell(
      { label: 'Reward rate', rateAccent: 'savings', rateInfo: 'srr', loading: input.rateLoading },
      input.rewardRateBefore,
      input.rewardRateAfter
    ),
    networkCell(input.network),
    networkFeeCell(input.networkFee)
  );

  return pairCells(cells);
}
