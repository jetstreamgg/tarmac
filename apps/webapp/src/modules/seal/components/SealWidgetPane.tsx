import {
  SealModuleWidget,
  TxStatus,
  WidgetStateChangeParams,
  SealFlow,
  SealAction
} from '@jetstreamgg/widgets';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { Intent } from '@/lib/enums';
import { useEffect } from 'react';
import { useChatContext } from '@/modules/chat/context/ChatContext';

import { Error } from '@/modules/layout/components/Error';
export function SealWidgetPane(sharedProps: SharedProps) {
  let termsLink: any[] = [];
  try {
    termsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
  } catch (error) {
    console.error('Error parsing terms link: ', error);
  }

  const {
    userConfig,
    updateUserConfig,
    linkedActionConfig,
    updateLinkedActionConfig,
    exitLinkedActionMode,
    selectedSealUrnIndex,
    setSelectedSealUrnIndex
  } = useConfigContext();
  // TODO: Implemet `useSealHistory` hook
  const refreshSealHistory = () => {};
  // const { mutate: refreshSealHistory } = useSealHistory();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShouldDisableActionButtons } = useChatContext();

  const onSealUrnChange = (urn?: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined }) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.SEAL_INTENT]) {
      return;
    }

    setSearchParams(params => {
      if (urn?.urnAddress && urn?.urnIndex !== undefined) {
        params.set(QueryParams.Widget, IntentMapping[Intent.SEAL_INTENT]);
        params.set(QueryParams.UrnIndex, urn.urnIndex.toString());
      } else {
        params.delete(QueryParams.UrnIndex);
      }
      return params;
    });
    setSelectedSealUrnIndex(urn?.urnIndex !== undefined ? Number(urn.urnIndex) : undefined);
  };

  // Reset detail pane urn index when widget is mounted
  const urnIndexParam = searchParams.get(QueryParams.UrnIndex);
  useEffect(() => {
    setSelectedSealUrnIndex(
      urnIndexParam ? (isNaN(Number(urnIndexParam)) ? undefined : Number(urnIndexParam)) : undefined
    );

    // Reset when unmounting
    return () => {
      setSelectedSealUrnIndex(undefined);
    };
  }, [urnIndexParam]);

  const onSealWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    displayToken,
    sealTab,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.SEAL_INTENT]) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Set flow search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, widgetState.flow);
        return prev;
      });
    }

    // Set flow search param based on widgetState.flow
    if (sealTab) {
      setSearchParams(prev => {
        prev.set(QueryParams.SealTab, sealTab === SealAction.FREE ? 'free' : 'lock');
        return prev;
      });
    } else if (sealTab === '') {
      setSearchParams(prev => {
        prev.delete(QueryParams.SealTab);
        return prev;
      });
    }

    // Update amount in URL if provided and not zero
    if (originAmount && originAmount !== '0') {
      setSearchParams(prev => {
        prev.set(QueryParams.InputAmount, originAmount);
        return prev;
      });
    } else if (originAmount === '') {
      setSearchParams(prev => {
        prev.delete(QueryParams.InputAmount);
        return prev;
      });
    }

    // Return early so we don't trigger the linked action code below
    if (displayToken && displayToken !== userConfig?.sealToken) {
      return updateUserConfig({ ...userConfig, sealToken: displayToken?.symbol });
    }

    // After a successful linked action open flow, set the final step to "success"
    if (
      widgetState.flow === SealFlow.OPEN &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.COMPLETED_CURRENT
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.COMPLETED_SUCCESS });
    }

    // Reset the linked action state and URL params after clicking "finish"
    if (txStatus === TxStatus.IDLE && linkedActionConfig.step === LinkedActionSteps.COMPLETED_SUCCESS) {
      exitLinkedActionMode();
      setSearchParams(prevParams => {
        const params = deleteSearchParams(prevParams);
        return params;
      });
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [SealFlow.OPEN, SealFlow.MANAGE].includes(widgetState.flow)
    ) {
      setTimeout(() => {
        refreshSealHistory();
      }, REFRESH_DELAY);
    }
  };

  const hasTermsLink = Array.isArray(termsLink) && termsLink.length > 0;
  if (!hasTermsLink) {
    console.error('No terms link found');
    return <Error />;
  }

  const sealTab = searchParams.get(QueryParams.SealTab) === 'free' ? SealAction.FREE : SealAction.LOCK;
  const flow = searchParams.get(QueryParams.Flow) === 'open' ? SealFlow.OPEN : undefined;

  return (
    <SealModuleWidget
      {...sharedProps}
      onSealUrnChange={onSealUrnChange}
      onWidgetStateChange={onSealWidgetStateChange}
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        urnIndex: selectedSealUrnIndex,
        sealTab,
        flow
      }}
      termsLink={Array.isArray(termsLink) && termsLink.length > 0 ? termsLink[0] : undefined}
      mkrSkyUpgradeUrl="https://upgrademkrtosky.sky.money"
    />
  );
}
