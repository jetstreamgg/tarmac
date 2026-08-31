import { Trans } from '@lingui/react/macro';
import { Switch } from '@/components/ui/switch';
import { RewardList } from './StakeTakeoverRewardCard';

/**
 * Manage card · Change reward (APP-516): plain title + toggle, sharing F4's
 * farm list — the StakeManageDelegateCard recipe. The urn's current farm
 * renders pre-selected (kept visible even when deprecated, so the holder can
 * switch away); Confirm only stages a change when the selection differs — the
 * container resolves `staged ?? current`.
 */
export function StakeManageRewardCard({
  enabled,
  onEnabledChange,
  currentRewardContract,
  stagedRewardContract,
  onSelect
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  currentRewardContract: `0x${string}` | undefined;
  stagedRewardContract: `0x${string}` | undefined;
  onSelect: (rewardContract: `0x${string}`) => void;
}) {
  return (
    <section
      data-testid="stake-manage-reward-card"
      className="bg-glassSurface rounded-card flex flex-col gap-6 p-6 backdrop-blur-[20px]"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text font-circle text-lg font-medium">
          <Trans>Change reward</Trans>
        </h3>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          data-testid="stake-manage-reward-card-toggle"
        />
      </div>
      {enabled && (
        <RewardList
          selectedRewardContract={stagedRewardContract ?? currentRewardContract}
          onSelect={onSelect}
          keepAddress={currentRewardContract}
          dataTestIdPrefix="stake-manage-reward"
        />
      )}
    </section>
  );
}
