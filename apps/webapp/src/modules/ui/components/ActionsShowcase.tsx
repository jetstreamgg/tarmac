import { Intent } from '@/lib/enums';
import { HStack } from '@/modules/layout/components/HStack';
import { LinkedAction, useUserSuggestedActions } from '../hooks/useUserSuggestedActions';
import { LoadingActionCard } from './LoadingActionCard';
import { LinkedActionCard } from './LinkedActionCard';
import { filterActionsByIntent } from '@/lib/utils';
import { RewardContract } from '@jetstreamgg/sky-hooks';

export function ActionsShowcase({
  widget,
  currentRewardContract,
  currentExpertModule
}: {
  widget: string;
  currentRewardContract?: RewardContract;
  currentExpertModule?: string;
}) {
  // TODO: update loading/error cards to reflect the new layout
  const { data, isLoading, error } = useUserSuggestedActions(currentRewardContract, currentExpertModule);

  // we can create an algorithm to sort the actions by relevance
  // for now, just sorting by weight
  // but in future, may want to consider the module the action is related to and create a mix
  const linkedActions = filterActionsByIntent(data?.linkedActions || [], widget);
  const filteredActions = linkedActions.sort((a, b) => b.weight - a.weight).slice(0, 6);
  if (isLoading) {
    return (
      <HStack gap={0} className="w-full flex-col gap-4 overflow-auto xl:flex-row">
        {Array.from({ length: 2 }).map((_, i) => (
          <LoadingActionCard key={i} />
        ))}
      </HStack>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 overflow-auto xl:flex-row">
      {/* Take the top two ranked actions */}
      {filteredActions.slice(0, 2).map(action => {
        return (
          <LinkedActionCard
            primaryToken={action.primaryToken}
            secondaryToken={action.secondaryToken}
            balance={action.balance}
            buttonText={action.title}
            key={`${(action as LinkedAction).stepOne}-${(action as LinkedAction).stepTwo}`}
            url={action.url}
            intent={action.intent as Intent}
            la={(action as LinkedAction).la}
            isLoading={isLoading}
            error={error}
          />
        );
      })}
    </div>
  );
}
