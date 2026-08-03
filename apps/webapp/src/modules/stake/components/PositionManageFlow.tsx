import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';
import { isLiquidatedStakePosition, useStakeUserPositions } from '../hooks/useStakeUserPositions';
import { PositionDetailsModal, StakeManageAction } from './PositionDetailsModal';
import { LiquidationPostMortemModal } from './LiquidationPostMortemModal';
import { ManagePositionTakeover } from './ManagePositionTakeover';
import { StakeClaimModal } from './StakeClaimModal';
import { OpenPositionTakeover } from './OpenPositionTakeover';

/** Menu action → sheet pre-toggle mapping (UX B.3 deep links). */
export function manageActionInit(action: StakeManageAction): StakeManageFlowInit {
  switch (action) {
    case 'stake':
      return { stakeCard: 'stake' };
    case 'withdraw':
      return { stakeCard: 'withdraw' };
    case 'borrow':
      return { borrowCard: 'borrow' };
    case 'repay':
      return { borrowCard: 'repay' };
    case 'delegate':
      return { delegateCard: true };
  }
}

/**
 * Legacy `stake_tab` deep-link mapping (M2): the widget's `lock`/`free` values
 * select its Stake&Borrow / Unstake&Repay tab pair — here they open the sheet
 * directly with the equivalent card pair pre-toggled.
 */
export function stakeTabInit(stakeTab: string | null): StakeManageFlowInit | null {
  if (stakeTab === 'lock') return { stakeCard: 'stake', borrowCard: 'borrow' };
  if (stakeTab === 'free') return { stakeCard: 'withdraw', borrowCard: 'repay' };
  return null;
}

function parseUrnIndex(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

type ManageView =
  | { name: 'details' }
  | { name: 'sheet'; init: StakeManageFlowInit }
  | { name: 'claim' }
  | { name: 'reopen'; borrowExpanded: boolean };

/**
 * The manage-flow controller, mounted on `flow=manage&urn_index=N` (M1):
 * details modal first; menu rows/CTAs swap to the "Manage a position" sheet
 * with cards pre-toggled; the Claim row swaps to the claim-rewards modal (F6),
 * whose × returns to the details modal; an inactive urn's Reopen CTA swaps to
 * the open-position takeover in reopen mode (F6/C17), borrow-expanded when the
 * urn ever had debt — the urn context rides the already-staged `urn_index`.
 * Back returns to the modal; × clears the flow params. A `stake_tab` param
 * (legacy deep-link contract) opens the sheet directly, and so does
 * `initialSheetInit` (a caller-staged pre-toggle, e.g. a remediation CTA
 * clicked before this flow was even mounted) — it takes priority over both.
 */
export function PositionManageFlow({
  initialSheetInit,
  onInitialSheetInitConsumed
}: {
  initialSheetInit?: StakeManageFlowInit;
  onInitialSheetInitConsumed?: () => void;
} = {}) {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const urnIndex = parseUrnIndex(searchParams.get(QueryParams.UrnIndex));

  const [view, setView] = useState<ManageView>(() => {
    if (initialSheetInit) return { name: 'sheet', init: initialSheetInit };
    const init = stakeTabInit(searchParams.get(QueryParams.StakeTab));
    return init ? { name: 'sheet', init } : { name: 'details' };
  });

  // The lazy useState initializer above already captured initialSheetInit into
  // `view` — this only tells the parent its pending state is now redundant.
  useEffect(() => {
    if (initialSheetInit) onInitialSheetInitConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    setSearchParams(
      params => {
        params.delete(QueryParams.Flow);
        params.delete(QueryParams.UrnIndex);
        params.delete(QueryParams.StakeTab);
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const onAction = useCallback(
    (action: StakeManageAction) => setView({ name: 'sheet', init: manageActionInit(action) }),
    []
  );
  const onClaim = useCallback(() => setView({ name: 'claim' }), []);
  const onReopen = useCallback((borrowExpanded: boolean) => setView({ name: 'reopen', borrowExpanded }), []);
  const onBack = useCallback(() => setView({ name: 'details' }), []);

  const { data: positions } = useStakeUserPositions();
  const position = urnIndex !== null ? positions?.find(p => p.index === urnIndex) : undefined;

  // The views are resolved into one element and handed to a single
  // AnimatePresence below, rather than returned early from here.
  //
  // Closing deletes the urn_index param, which makes this component return
  // nothing while it is still mounted — so an AnimatePresence around it in the
  // parent is no help: it preserves this element, this element re-renders
  // against the new params, and the takeover is gone before it can animate.
  // The boundary has to sit here, where the child element itself is what gets
  // preserved, with its props frozen at the moment it left.
  const resolveView = () => {
    if (urnIndex === null) return null;

    // Liquidated urns always land on the post-mortem, BEFORE the view dispatch:
    // a `stake_tab` deep link or a caller-staged `initialSheetInit` mounts the
    // flow directly in 'sheet', which must not open a manage sheet on a barked
    // urn. A successful recovery frees the SKY, so the position's next mutation
    // timestamp overtakes the bark and `isLiquidatedStakePosition` flips to
    // false on its own — this then falls through to the ordinary views without
    // any extra transition here.
    if (position && isLiquidatedStakePosition(position)) {
      return <LiquidationPostMortemModal key="postmortem" urnIndex={urnIndex} onClose={close} />;
    }

    if (view.name === 'claim') {
      return <StakeClaimModal key="claim" urnIndex={urnIndex} onClose={onBack} />;
    }

    if (view.name === 'reopen') {
      return (
        <OpenPositionTakeover
          key="reopen"
          reopen={{ urnIndex, borrowExpanded: view.borrowExpanded, onBack, onClose: close }}
        />
      );
    }

    if (view.name === 'details') {
      return (
        <PositionDetailsModal
          key="details"
          urnIndex={urnIndex}
          onClose={close}
          onAction={onAction}
          onClaim={onClaim}
          onReopen={onReopen}
        />
      );
    }

    return (
      <ManagePositionTakeover
        key="manage"
        urnIndex={urnIndex}
        init={view.init}
        onBack={onBack}
        onClose={close}
      />
    );
  };

  return <AnimatePresence>{resolveView()}</AnimatePresence>;
}
