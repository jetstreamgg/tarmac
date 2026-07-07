import { useCallback, useState } from 'react';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeManageFlowInit } from '../hooks/useStakeManageFlowState';
import { PositionDetailsModal, StakeManageAction } from './PositionDetailsModal';
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
 * (legacy deep-link contract) opens the sheet directly.
 */
export function PositionManageFlow() {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const urnIndex = parseUrnIndex(searchParams.get(QueryParams.UrnIndex));

  const [view, setView] = useState<ManageView>(() => {
    const init = stakeTabInit(searchParams.get(QueryParams.StakeTab));
    return init ? { name: 'sheet', init } : { name: 'details' };
  });

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
  const onReopen = useCallback(
    (borrowExpanded: boolean) => setView({ name: 'reopen', borrowExpanded }),
    []
  );
  const onBack = useCallback(() => setView({ name: 'details' }), []);

  if (urnIndex === null) return null;

  if (view.name === 'claim') {
    return <StakeClaimModal urnIndex={urnIndex} onClose={onBack} />;
  }

  if (view.name === 'reopen') {
    return (
      <OpenPositionTakeover
        reopen={{ urnIndex, borrowExpanded: view.borrowExpanded, onBack, onClose: close }}
      />
    );
  }

  return view.name === 'details' ? (
    <PositionDetailsModal
      urnIndex={urnIndex}
      onClose={close}
      onAction={onAction}
      onClaim={onClaim}
      onReopen={onReopen}
    />
  ) : (
    <ManagePositionTakeover urnIndex={urnIndex} init={view.init} onBack={onBack} onClose={close} />
  );
}
