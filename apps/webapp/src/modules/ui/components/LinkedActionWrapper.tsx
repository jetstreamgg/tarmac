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
    <div className="mb-1 mt-4 flex w-full justify-between px-4 md:mb-0 md:mt-2 md:pl-1.5 md:pr-2.5 lg:mt-0 lg:pl-3 lg:pr-1.5">
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
