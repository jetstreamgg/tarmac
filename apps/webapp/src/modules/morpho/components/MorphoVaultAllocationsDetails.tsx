import { useMorphoVaultAllocations } from '@jetstreamgg/sky-hooks';
import { UtilizationBar } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Skeleton } from '@/components/ui/skeleton';

type MorphoVaultAllocationsDetailsProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultAllocationsDetails({ vaultAddress }: MorphoVaultAllocationsDetailsProps) {
  const { data: allocationsData, isLoading } = useMorphoVaultAllocations({ vaultAddress });

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!allocationsData || allocationsData.allocations.length === 0) {
    return (
      <Text className="text-textSecondary">
        <Trans>No market allocations found</Trans>
      </Text>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {allocationsData.allocations.map(allocation => (
        <div key={allocation.marketId} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Text className="text-sm font-medium">
              {allocation.collateralAssetSymbol
                ? `${allocation.collateralAssetSymbol}/${allocation.loanAssetSymbol}`
                : allocation.loanAssetSymbol}
            </Text>
            <Text className="text-textSecondary text-sm">{allocation.formattedSupplyApy} APY</Text>
          </div>
          <UtilizationBar
            utilizationRate={allocation.allocationPercentage}
            isLoading={false}
            showAlert={false}
            showLabel={false}
            barHeight="h-2"
          />
          <div className="flex items-center justify-between">
            <Text className="text-textSecondary text-xs">
              {allocation.collateralAssetSymbol && `LLTV: ${allocation.formattedLltv}`}
            </Text>
            <Text className="text-textSecondary text-xs">{allocation.formattedAllocationPercentage}</Text>
          </div>
        </div>
      ))}
    </div>
  );
}
