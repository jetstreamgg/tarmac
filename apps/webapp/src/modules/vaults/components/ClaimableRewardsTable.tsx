import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useMerklRewards, useMerklClaimRewards, MerklTokenReward } from '@jetstreamgg/sky-hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function ClaimableRewardsTable() {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { data, isLoading, mutate } = useMerklRewards();
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const { launch, txCallbacks } = useTransaction();

  const rewards = data?.rewards ?? [];

  // Auto-select all rewards when data loads or reward tokens change
  const rewardAddresses = useMemo(() => rewards.map(r => r.tokenAddress).join(','), [rewards]);
  useEffect(() => {
    if (rewards.length > 0) {
      setSelectedTokens(new Set(rewards.map(r => r.tokenAddress)));
    }
  }, [rewardAddresses]);

  // Get the selected rewards for claiming (memoized to stabilize the reference for useMerklClaimRewards)
  const selectedRewards = useMemo(
    () => rewards.filter(r => selectedTokens.has(r.tokenAddress)),
    [rewards, selectedTokens]
  );

  const claimRewards = useMerklClaimRewards({
    rewards: selectedRewards,
    ...txCallbacks
  });

  const toggleInSet = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
      setter(prev => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    []
  );

  const allSelected = selectedTokens.size === rewards.length && rewards.length > 0;
  const someSelected = selectedTokens.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(new Set(rewards.map(r => r.tokenAddress)));
    }
  }, [allSelected, rewards]);

  if (!isConnectedAndAcceptedTerms) return null;

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Skeleton className="h-4 w-4" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="text-right">
              <Skeleton className="ml-auto h-4 w-16" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[0, 1].map(i => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!data?.hasClaimableRewards) {
    return (
      <Text className="text-textSecondary">
        <Trans>There are currently no claimable rewards.</Trans>
      </Text>
    );
  }

  const hasSelection = selectedTokens.size > 0;

  return (
    <div className="flex flex-col gap-4">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[5%]" />
          <col className="w-[30%]" />
          <col className="w-[45%]" />
          <col className="w-[20%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={toggleAll}
                aria-label={t`Select all`}
              />
            </TableHead>
            <TableHead>
              <Trans>Token</Trans>
            </TableHead>
            <TableHead>
              <Trans>Source</Trans>
            </TableHead>
            <TableHead className="text-right">
              <Trans>Amount</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rewards.map(reward => (
            <RewardTokenRows
              key={reward.tokenAddress}
              reward={reward}
              isSelected={selectedTokens.has(reward.tokenAddress)}
              isExpanded={expandedTokens.has(reward.tokenAddress)}
              onToggleSelect={() => toggleInSet(setSelectedTokens, reward.tokenAddress)}
              onToggleExpand={() => toggleInSet(setExpandedTokens, reward.tokenAddress)}
            />
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!hasSelection || !claimRewards.prepared}
          onClick={() =>
            launch({
              title: t`Claim rewards`,
              subtitles: {
                review:
                  selectedRewards.length > 1
                    ? t`You are claiming ${selectedRewards.length} token rewards`
                    : t`You are claiming your ${selectedRewards[0].tokenSymbol} rewards.`,
                pending: t`Please confirm that you want to claim the rewards directly in your wallet.`,
                loading: t`Your claim is being processed on the blockchain. Please wait.`,
                success: t`You've successfully claimed your rewards.`,
                error: t`An error occurred while claiming your rewards.`
              },
              transactionContent: (
                <div className="flex flex-col gap-1">
                  {selectedRewards.map(r => (
                    <div key={r.tokenAddress} className="flex items-center gap-2 py-1">
                      <TokenIcon className="h-6 w-6" token={{ symbol: r.tokenSymbol }} />
                      <Text>{r.formattedTotalAmount}</Text>
                      <Text>{r.tokenSymbol}</Text>
                    </div>
                  ))}
                </div>
              ),
              onConfirm: claimRewards.execute,
              confirmLabel: t`Claim`,
              onSuccess: () => {
                setSelectedTokens(new Set());
                mutate();
              },
              analytics: {
                widgetName: 'vaults',
                flow: 'claim',
                action: 'claim',
                data: {
                  module: 'morpho',
                  claimedRewards: selectedRewards.map(r => ({
                    amount: Number(r.formattedTotalAmount),
                    tokenAddress: r.tokenAddress,
                    tokenSymbol: r.tokenSymbol
                  }))
                }
              }
            })
          }
        >
          {hasSelection ? <Trans>Claim rewards</Trans> : <Trans>Select rewards to claim</Trans>}
        </Button>
      </div>
    </div>
  );
}

function RewardTokenRows({
  reward,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand
}: {
  reward: MerklTokenReward;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}) {
  const hasMultipleSources = reward.sources.length > 1;

  return (
    <>
      {/* Main token row */}
      <TableRow className="cursor-pointer" onClick={onToggleSelect}>
        <TableCell>
          <Checkbox checked={isSelected} className="pointer-events-none" aria-label={reward.tokenSymbol} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <TokenIcon className="h-6 w-6" token={{ symbol: reward.tokenSymbol }} />
            <Text>{reward.tokenSymbol}</Text>
          </div>
        </TableCell>
        <TableCell>
          {hasMultipleSources ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="flex items-center gap-1 text-left"
              aria-expanded={isExpanded}
            >
              <Text>
                <Trans>Total</Trans>
              </Text>
              <ChevronDown
                className={`text-textSecondary h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <Text className="text-textSecondary">{reward.sources[0]?.label}</Text>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Text>{reward.formattedTotalAmount}</Text>
        </TableCell>
      </TableRow>

      {/* Expanded source breakdown rows */}
      {hasMultipleSources && (
        <tr>
          <td colSpan={4} className="p-0">
            <Collapsible open={isExpanded}>
              <CollapsibleContent className="data-[state=closed]:animate-slide-up-fade data-[state=open]:animate-slide-down-fade overflow-hidden transition-all">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[5%]" />
                    <col className="w-[30%]" />
                    <col className="w-[45%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <tbody>
                    {reward.sources.map(source => (
                      <tr key={`${reward.tokenAddress}-${source.label}`} className="border-0">
                        <td className="p-4" />
                        <td className="p-4" />
                        <td className="p-4">
                          <Text className="text-textSecondary text-sm">{source.label}</Text>
                        </td>
                        <td className="p-4 text-right">
                          <Text className="text-textSecondary text-sm">{source.formattedAmount}</Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CollapsibleContent>
            </Collapsible>
          </td>
        </tr>
      )}
    </>
  );
}
