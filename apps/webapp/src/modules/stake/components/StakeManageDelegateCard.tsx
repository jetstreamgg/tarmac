import { Trans } from '@lingui/react/macro';
import { Switch } from '@/components/ui/switch';
import { DelegateList } from './StakeTakeoverDelegateCard';

/**
 * Manage card 3 · Change delegate (UX 1104:21587): plain title + toggle (no
 * segmented control), sharing F4's delegate search/list. The urn's current
 * delegate renders pre-selected; Confirm only stages a change when the
 * selection differs (M20) — the container resolves `staged ?? current`.
 */
export function StakeManageDelegateCard({
  enabled,
  onEnabledChange,
  currentDelegate,
  stagedDelegate,
  onSelect
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  currentDelegate: `0x${string}` | undefined;
  stagedDelegate: `0x${string}` | undefined;
  onSelect: (delegate: `0x${string}`) => void;
}) {
  return (
    <section
      data-testid="stake-manage-delegate-card"
      // Same inset and header→body gap as the stake/borrow cards (Design QA
      // 2800:91832): 32px from md up, 20px on phones.
      className="bg-glassSurface rounded-card flex flex-col gap-6 p-5 backdrop-blur-[20px] md:gap-8 md:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text font-circle text-lg font-medium">
          <Trans>Change delegate</Trans>
        </h3>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          data-testid="stake-manage-delegate-card-toggle"
        />
      </div>
      {enabled && (
        <DelegateList
          selectedDelegate={stagedDelegate ?? currentDelegate}
          onSelect={onSelect}
          dataTestIdPrefix="stake-manage-delegate"
        />
      )}
    </section>
  );
}
