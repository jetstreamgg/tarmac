import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import {
  ExpertIntentMapping,
  VaultsIntentMapping,
  IntentMapping,
  linkedActionMetadata
} from '@/lib/constants';
import { ArrowStepIndicator } from './ArrowStepIndicator';
import { ExpertIntent, Intent, VaultsIntent } from '@/lib/enums';

export const LinkedActionWrapper = () => {
  const { linkedActionConfig } = useConfigContext();

  if (!linkedActionConfig.showLinkedAction) return null;

  const firstStepText = linkedActionConfig.initialAction
    ? linkedActionMetadata[linkedActionConfig.initialAction]?.text
    : '';

  const firstStepIcon = linkedActionConfig.initialAction
    ? linkedActionMetadata[linkedActionConfig.initialAction]?.icon
    : null;

  const isExpertLinkedAction = linkedActionConfig.linkedAction === IntentMapping[Intent.EXPERT_INTENT];
  const isVaultsLinkedAction = linkedActionConfig.linkedAction === IntentMapping[Intent.VAULTS_INTENT];

  const getModuleText = () => {
    if (linkedActionConfig.expertModule === ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]) {
      return 'stUSDS';
    }
    if (linkedActionConfig.expertModule === VaultsIntentMapping[VaultsIntent.MORPHO_VAULT_INTENT]) {
      return 'Vault';
    }
    return linkedActionMetadata[linkedActionConfig.linkedAction!]?.text || '';
  };

  const secondStepText =
    isExpertLinkedAction || isVaultsLinkedAction
      ? getModuleText()
      : linkedActionConfig.linkedAction
        ? linkedActionMetadata[linkedActionConfig.linkedAction]?.text
        : '';
  const secondStepIcon = linkedActionConfig.linkedAction
    ? linkedActionMetadata[linkedActionConfig.linkedAction]?.icon
    : null;

  return (
    <div className="mt-4 mb-1 flex w-full justify-between px-4 md:mt-2 md:mb-0 md:pr-2.5 md:pl-1.5 lg:mt-0 lg:pr-1.5 lg:pl-3">
      <ArrowStepIndicator
        text={firstStepText}
        position={0}
        stepIcon={firstStepIcon?.({ className: 'h-5 w-5' })}
        step={linkedActionConfig.step}
      />
      <ArrowStepIndicator
        text={secondStepText}
        position={1}
        stepIcon={secondStepIcon?.({ className: 'h-5 w-5' })}
        step={linkedActionConfig.step}
      />
    </div>
  );
};
