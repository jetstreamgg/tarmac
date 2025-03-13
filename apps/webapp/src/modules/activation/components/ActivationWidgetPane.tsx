import {
  TxStatus,
  WidgetStateChangeParams,
  ActivationFlow,
  ActivationModuleWidget
} from '@jetstreamgg/widgets';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { Intent } from '@/lib/enums';
import { useEffect } from 'react';
import { Error } from '@/modules/layout/components/Error';

export function ActivationWidgetPane(sharedProps: SharedProps) {
  let termsLink: any[] = [];
  try {
    termsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
  } catch (error) {
    console.error('Error parsing terms link: ', error);
  }

  const {
    linkedActionConfig,
    updateLinkedActionConfig,
    exitLinkedActionMode,
    selectedActivationUrnIndex,
    setSelectedActivationUrnIndex
  } = useConfigContext();
  // TODO: Implemet `useSealHistory` hook
  const refreshActivationHistory = () => {};
  // const { mutate: refreshSealHistory } = useSealHistory();
  const [searchParams, setSearchParams] = useSearchParams();

  const onActivationUrnChange = (urn?: {
    urnAddress: `0x${string}` | undefined;
    urnIndex: bigint | undefined;
  }) => {
    setSearchParams(params => {
      if (urn?.urnAddress && urn?.urnIndex !== undefined) {
        params.set(QueryParams.Widget, IntentMapping[Intent.ACTIVATION_INTENT]);
        params.set(QueryParams.UrnIndex, urn.urnIndex.toString());
      } else {
        params.delete(QueryParams.UrnIndex);
      }
      return params;
    });
    setSelectedActivationUrnIndex(urn?.urnIndex !== undefined ? Number(urn.urnIndex) : undefined);
  };

  // Reset detail pane urn index when widget is mounted
  useEffect(() => {
    const urnIndexParam = searchParams.get(QueryParams.UrnIndex);
    setSelectedActivationUrnIndex(
      urnIndexParam ? (isNaN(Number(urnIndexParam)) ? undefined : Number(urnIndexParam)) : undefined
    );

    // Reset when unmounting
    return () => {
      setSelectedActivationUrnIndex(undefined);
    };
  }, []);

  const onActivationWidgetStateChange = ({ hash, txStatus, widgetState }: WidgetStateChangeParams) => {
    // After a successful linked action open flow, set the final step to "success"
    if (
      widgetState.flow === ActivationFlow.OPEN &&
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
      [ActivationFlow.OPEN, ActivationFlow.MANAGE].includes(widgetState.flow)
    ) {
      setTimeout(() => {
        refreshActivationHistory();
      }, REFRESH_DELAY);
    }
  };

  const hasTermsLink = Array.isArray(termsLink) && termsLink.length > 0;
  if (!hasTermsLink) {
    console.error('No terms link found');
    return <Error />;
  }

  return (
    <ActivationModuleWidget
      {...sharedProps}
      onActivationUrnChange={onActivationUrnChange}
      onWidgetStateChange={onActivationWidgetStateChange}
      externalWidgetState={{ amount: linkedActionConfig?.inputAmount, urnIndex: selectedActivationUrnIndex }}
      termsLink={Array.isArray(termsLink) && termsLink.length > 0 ? termsLink[0] : undefined}
    />
  );
}
