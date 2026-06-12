import { TxStatus, WidgetStateChangeParams, StakeFlow, StakeModuleWidget, StakeAction } from '@/widgets';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useAppSearchParams, useRouteIntent } from '@/lib/navigation';
import { Intent } from '@/lib/enums';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStakeHistory } from '@/hooks';
import { StakeHelpModal } from './StakeHelpModal';
import { StakingSpkRewardsDisclaimer } from './StakingSpkRewardsDisclaimer';

export function StakeWidgetPane() {
  const { selectedStakeUrnIndex, setSelectedStakeUrnIndex } = useConfigContext();
  const { mutate: refreshStakeHistory } = useStakeHistory();
  const [searchParams, setSearchParams] = useAppSearchParams();
  const intent = useRouteIntent();
  const urnIndexParam = searchParams.get(QueryParams.UrnIndex);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Use a ref to always access the latest route intent without stale closures
  const intentRef = useRef(intent);
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  const onStakeUrnChange = useCallback(
    (urn?: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined }) => {
      // Prevent race conditions (ref avoids a stale closure)
      if (intentRef.current !== Intent.STAKE_INTENT) {
        return;
      }

      setSearchParams(
        params => {
          if (urn?.urnAddress && urn?.urnIndex !== undefined) {
            params.set(QueryParams.UrnIndex, urn.urnIndex.toString());
          } else {
            params.delete(QueryParams.UrnIndex);
          }
          return params;
        },
        { replace: true }
      );
      setSelectedStakeUrnIndex(urn?.urnIndex !== undefined ? Number(urn.urnIndex) : undefined);
    },
    [setSearchParams, setSelectedStakeUrnIndex]
  );

  // Reset detail pane urn index when widget is mounted
  useEffect(() => {
    setSelectedStakeUrnIndex(
      urnIndexParam ? (isNaN(Number(urnIndexParam)) ? undefined : Number(urnIndexParam)) : undefined
    );

    // Reset when unmounting
    return () => {
      setSelectedStakeUrnIndex(undefined);
    };
  }, [urnIndexParam]);

  const onStakeWidgetStateChange = ({ hash, txStatus, widgetState, stakeTab }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (intent !== Intent.STAKE_INTENT) {
      return;
    }

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, flow);
          return prev;
        },
        { replace: true }
      );
    }

    // Set flow search param based on widgetState.flow
    if (stakeTab) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.StakeTab, stakeTab === StakeAction.FREE ? 'free' : 'lock');
          return prev;
        },
        { replace: true }
      );
    } else if (stakeTab === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.StakeTab);
          return prev;
        },
        { replace: true }
      );
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [StakeFlow.OPEN, StakeFlow.MANAGE].includes(widgetState.flow as StakeFlow)
    ) {
      setTimeout(() => {
        refreshStakeHistory();
      }, REFRESH_DELAY);
    }
  };

  const stakeTabParam = searchParams.get(QueryParams.StakeTab);
  const stakeTab =
    stakeTabParam === 'free' ? StakeAction.FREE : stakeTabParam === 'lock' ? StakeAction.LOCK : undefined;
  const flowParam = searchParams.get(QueryParams.Flow);
  const flow = flowParam === 'open' ? StakeFlow.OPEN : undefined;

  return (
    <>
      <StakeModuleWidget
        disclaimer={<StakingSpkRewardsDisclaimer />}
        onStakeUrnChange={onStakeUrnChange}
        onWidgetStateChange={onStakeWidgetStateChange}
        onShowHelpModal={() => {
          setShowHelpModal(true);
        }}
        externalWidgetState={{
          urnIndex: selectedStakeUrnIndex,
          stakeTab,
          flow
        }}
      />
      <StakeHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </>
  );
}
