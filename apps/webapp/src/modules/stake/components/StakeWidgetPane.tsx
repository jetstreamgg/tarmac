import {
  TxStatus,
  WidgetStateChangeParams,
  StakeFlow,
  StakeModuleWidget,
  StakeAction
} from '@jetstreamgg/sky-widgets';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { Intent } from '@/lib/enums';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStakeHistory } from '@jetstreamgg/sky-hooks';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { StakeHelpModal } from './StakeHelpModal';

export function StakeWidgetPane(sharedProps: SharedProps) {
  const {
    linkedActionConfig,
    updateLinkedActionConfig,
    exitLinkedActionMode,
    selectedStakeUrnIndex,
    setSelectedStakeUrnIndex
  } = useConfigContext();
  const { mutate: refreshStakeHistory } = useStakeHistory();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShouldDisableActionButtons } = useChatContext();
  const urnIndexParam = searchParams.get(QueryParams.UrnIndex);
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Use ref to always access the latest searchParams without causing re-renders
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const onStakeUrnChange = useCallback(
    (urn?: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined }) => {
      // Use ref to access current searchParams without stale closure
      const currentWidget = searchParamsRef.current.get(QueryParams.Widget);
      const currentIsReset = searchParamsRef.current.get(QueryParams.Reset) === 'true';

      // Prevent race conditions
      if (currentWidget !== IntentMapping[Intent.STAKE_INTENT]) {
        return;
      }

      // Don't run while resetting
      if (currentIsReset) {
        return;
      }

      setSearchParams(
        params => {
          if (urn?.urnAddress && urn?.urnIndex !== undefined) {
            params.set(QueryParams.Widget, IntentMapping[Intent.STAKE_INTENT]);
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

  const onStakeWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    stakeTab,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.STAKE_INTENT]) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Set flow search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, widgetState.flow);
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

    // Update amount in URL if provided and not zero
    if (originAmount && originAmount !== '0') {
      setSearchParams(
        prev => {
          prev.set(QueryParams.InputAmount, originAmount);
          return prev;
        },
        { replace: true }
      );
    } else if (originAmount === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.InputAmount);
          return prev;
        },
        { replace: true }
      );
    }

    // After a successful linked action open flow, set the final step to "success"
    if (
      widgetState.flow === StakeFlow.OPEN &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.COMPLETED_CURRENT
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.COMPLETED_SUCCESS });
    }

    // Reset the linked action state and URL params after clicking "finish"
    if (txStatus === TxStatus.IDLE && linkedActionConfig.step === LinkedActionSteps.COMPLETED_SUCCESS) {
      exitLinkedActionMode();
      setSearchParams(
        prevParams => {
          const params = deleteSearchParams(prevParams);
          return params;
        },
        { replace: true }
      );
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [StakeFlow.OPEN, StakeFlow.MANAGE].includes(widgetState.flow)
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
        {...sharedProps}
        onStakeUrnChange={onStakeUrnChange}
        onWidgetStateChange={onStakeWidgetStateChange}
        onShowHelpModal={() => {
          setShowHelpModal(true);
        }}
        externalWidgetState={{
          amount: linkedActionConfig?.inputAmount,
          urnIndex: selectedStakeUrnIndex,
          stakeTab,
          flow
        }}
        batchEnabled={batchEnabled}
        setBatchEnabled={setBatchEnabled}
      />
      <StakeHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </>
  );
}
