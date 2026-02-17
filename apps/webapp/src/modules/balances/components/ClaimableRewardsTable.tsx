import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { useClaimableRewards, TOKENS, type ClaimableReward } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { ClaimRewardsModal } from './ClaimRewardsModal';
import { MODULE_ICONS } from '../constants';

export function ClaimableRewardsTable() {
  const { data: rewards, isLoading, mutate } = useClaimableRewards();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const allSelected = rewards.length > 0 && selectedIds.size === rewards.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const selectedRewards = useMemo(() => rewards.filter(r => selectedIds.has(r.id)), [rewards, selectedIds]);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rewards.map(r => r.id)));
    }
  }, [allSelected, rewards]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleClaimSelected = () => setIsModalOpen(true);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  if (isLoading) {
    return <LoadingClaimableRewardsTable />;
  }

  if (rewards.length === 0) {
    return null;
  }

  return (
    <>
      <div className="@container">
        <Table>
          <ClaimableRewardsTableHeader
            checkboxSlot={
              <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={toggleAll} />
            }
          />
          <TableBody>
            {rewards.map(reward => (
              <ClaimableRewardRow
                key={reward.id}
                reward={reward}
                selected={selectedIds.has(reward.id)}
                onToggle={() => toggleOne(reward.id)}
              />
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={selectedIds.size === 0} onClick={handleClaimSelected}>
            {selectedIds.size === 0 ? (
              <Trans>Select rewards to claim</Trans>
            ) : (
              <Trans>Claim Selected ({selectedIds.size})</Trans>
            )}
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <ClaimRewardsModal
          open={isModalOpen}
          onClose={handleModalClose}
          selectedRewards={selectedRewards}
          onClaimSuccess={mutate}
        />
      )}
    </>
  );
}

function ClaimableRewardRow({
  reward,
  selected,
  onToggle
}: {
  reward: ClaimableReward;
  selected: boolean;
  onToggle: () => void;
}) {
  const token = TOKENS[reward.rewardTokenSymbol.toLowerCase()];

  const formattedAmount = formatNumber(
    parseFloat(formatUnits(reward.claimableAmount, reward.rewardTokenDecimals)),
    { maxDecimals: 4, compact: true }
  );

  const formattedUsd =
    reward.claimableAmountUsd > 0
      ? formatNumber(reward.claimableAmountUsd, { maxDecimals: 2, compact: true })
      : '-';

  return (
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell className="w-[40px]">
        <Checkbox checked={selected} className="pointer-events-none" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {MODULE_ICONS[reward.module] && (
            <img src={MODULE_ICONS[reward.module]} alt={reward.module} className="h-5 w-5" />
          )}
          <div className="flex flex-col">
            <Text variant="small">{reward.module}</Text>
            {reward.moduleDetail && (
              <Text variant="captionSm" className="text-textSecondary">
                {reward.moduleDetail}
              </Text>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {token && <TokenIcon token={token} width={24} className="h-6 w-6" />}
          <Text variant="small">{reward.rewardTokenSymbol}</Text>
        </div>
      </TableCell>
      <TableCell>
        <Text variant="small">{formattedAmount}</Text>
      </TableCell>
      <TableCell className="[@container(width<750px)]:hidden">
        <Text variant="small" className="text-textSecondary">
          {formattedUsd !== '-' ? `$${formattedUsd}` : formattedUsd}
        </Text>
      </TableCell>
    </TableRow>
  );
}

function ClaimableRewardsTableHeader({ checkboxSlot }: { checkboxSlot: ReactNode }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[40px]">{checkboxSlot}</TableHead>
        <TableHead className="w-1/4">
          <Text variant="small" className="text-selectActive">
            <Trans>Module</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/4">
          <Text variant="small" className="text-selectActive">
            <Trans>Reward Token</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/4">
          <Text variant="small" className="text-selectActive">
            <Trans>Amount</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/4 [@container(width<750px)]:hidden">
          <Text variant="small" className="text-selectActive">
            <Trans>Amount (USD)</Trans>
          </Text>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function LoadingClaimableRewardsTable() {
  return (
    <div className="@container">
      <Table>
        <ClaimableRewardsTableHeader checkboxSlot={<Skeleton className="h-4 w-4" />} />
        <TableBody>
          {[1, 2, 3].map(i => (
            <TableRow key={i}>
              <TableCell className="w-[40px]">
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="[@container(width<750px)]:hidden">
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
