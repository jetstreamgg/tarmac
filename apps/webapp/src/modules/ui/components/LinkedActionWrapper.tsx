import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { linkedActionMetadata } from '@/lib/constants';
import { ArrowStepIndicator } from './ArrowStepIndicator';

export const LinkedActionWrapper = () => {
  const { linkedActionConfig } = useConfigContext();

  if (!linkedActionConfig.showLinkedAction) return null;

  const firstStepText = linkedActionConfig.initialAction
    ? linkedActionMetadata[linkedActionConfig.initialAction]?.text
    : '';

  const firstStepIcon = linkedActionConfig.initialAction
    ? linkedActionMetadata[linkedActionConfig.initialAction]?.icon
    : null;

  const secondStepText = linkedActionConfig.linkedAction
    ? linkedActionMetadata[linkedActionConfig.linkedAction]?.text
    : '';
  const secondStepIcon = linkedActionConfig.linkedAction
    ? linkedActionMetadata[linkedActionConfig.linkedAction]?.icon
    : null;

  return (
    <div className="m-6 mb-0 flex w-full justify-between pr-6 md:mx-3 md:mt-0">
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
