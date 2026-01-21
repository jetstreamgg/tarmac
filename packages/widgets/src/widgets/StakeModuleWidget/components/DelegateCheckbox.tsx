import { useId, useContext, useEffect } from 'react';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { cn } from '@widgets/lib/utils';
import { useStakeUrnSelectedVoteDelegate, ZERO_ADDRESS } from '@jetstreamgg/sky-hooks';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeFlow } from '../lib/constants';

interface DelegateCheckboxProps {
  isVisible?: boolean;
}

export const DelegateCheckbox = ({ isVisible = true }: DelegateCheckboxProps) => {
  const delegateCheckboxId = useId();
  const { activeUrn, wantsToDelegate, setWantsToDelegate } = useContext(StakeModuleWidgetContext);
  const { widgetState } = useContext(WidgetContext);

  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  // Determine if existing position has delegation
  const hasExistingDelegate = urnSelectedVoteDelegate && urnSelectedVoteDelegate !== ZERO_ADDRESS;

  // Reset wantsToDelegate when activeUrn changes
  useEffect(() => {
    if (activeUrn?.urnAddress) {
      setWantsToDelegate(undefined);
    }
  }, [activeUrn?.urnAddress, setWantsToDelegate]);

  // Update wantsToDelegate based on flow and delegate data
  useEffect(() => {
    // Only set initial state if wantsToDelegate is undefined
    if (wantsToDelegate === undefined) {
      // For open flow, default to false
      if (widgetState.flow === StakeFlow.OPEN) {
        setWantsToDelegate(false);
        return;
      }

      // For manage flow, wait for delegate data to load
      if (hasExistingDelegate !== undefined) {
        setWantsToDelegate(hasExistingDelegate);
      }
    }
    // Don't set a default value while data is loading
  }, [hasExistingDelegate, widgetState.flow, wantsToDelegate, setWantsToDelegate]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex items-center px-3 pt-1">
      <Checkbox
        id={delegateCheckboxId}
        checked={wantsToDelegate}
        onCheckedChange={checked => setWantsToDelegate(checked === true)}
        disabled={!!hasExistingDelegate}
      />
      <label
        htmlFor={delegateCheckboxId}
        className={cn('ml-2', hasExistingDelegate ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        <Text variant="medium" className={cn(hasExistingDelegate ? 'text-textSecondary' : 'text-white')}>
          {hasExistingDelegate ? (
            <Trans>You are delegating voting power for this position</Trans>
          ) : (
            <Trans>Do you want to delegate voting power?</Trans>
          )}
        </Text>
      </label>
    </div>
  );
};
