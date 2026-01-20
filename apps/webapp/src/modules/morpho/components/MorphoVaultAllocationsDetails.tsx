import { useMorphoVaultAllocations } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ExternalLink } from 'lucide-react';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

type MorphoVaultAllocationsDetailsProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultAllocationsDetails({ vaultAddress }: MorphoVaultAllocationsDetailsProps) {
  const { data: allocationsData, isLoading } = useMorphoVaultAllocations({ vaultAddress });
  const chainId = useChainId();

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="border-cardSecondary grid grid-cols-3 gap-2 border-b pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="grid grid-cols-3 gap-2 py-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (
    !allocationsData ||
    (allocationsData.v1Vaults.length === 0 && allocationsData.idleLiquidity.length === 0)
  ) {
    return (
      <Text className="text-textSecondary">
        <Trans>No allocations found</Trans>
      </Text>
    );
  }

  return (
    <div className="flex w-full flex-col">
      {/* Table Header */}
      <div className="border-cardSecondary grid grid-cols-3 gap-2 border-b pb-2">
        <Text className="text-textSecondary text-xs font-medium">
          <Trans>Vaults / Markets</Trans>
        </Text>
        <Text className="text-textSecondary text-center text-xs font-medium">
          <Trans>Allocation ({allocationsData.assetSymbol})</Trans>
        </Text>
        <Text className="text-textSecondary text-right text-xs font-medium">
          <Trans>Net APY</Trans>
        </Text>
      </div>

      {/* V1 Vaults Section */}
      {allocationsData.v1Vaults.length > 0 && (
        <div className="flex flex-col">
          {/* Section Header */}
          <div className="py-2">
            <Text className="text-textSecondary text-xs">
              <Trans>Vaults V1</Trans>
            </Text>
          </div>

          {/* V1 Vault Rows */}
          {allocationsData.v1Vaults.map(v1Vault => (
            <div
              key={v1Vault.vaultAddress}
              className="border-cardSecondary grid grid-cols-3 items-center gap-2 border-b py-2 pl-2"
            >
              <a
                href={getEtherscanLink(chainId, v1Vault.vaultAddress, 'address')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text hover:text-textSecondary flex items-center gap-1.5 transition-colors"
              >
                <TokenIcon token={{ symbol: allocationsData.assetSymbol }} className="h-5 w-5" />
                <Text className="text-sm">{v1Vault.vaultName}</Text>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
              <div className="flex justify-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <Text className="text-text text-sm">{v1Vault.formattedAssets}</Text>
                  </TooltipTrigger>
                  <TooltipContent>
                    <Text className="text-sm">{v1Vault.formattedAssetsUsd}</Text>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Text className="text-bullish text-right text-sm">{v1Vault.formattedNetApy}</Text>
            </div>
          ))}
        </div>
      )}

      {/* Idle Liquidity Section */}
      {allocationsData.idleLiquidity.length > 0 && (
        <div className="flex flex-col">
          {/* Section Header */}
          <div className="py-2">
            <Text className="text-textSecondary text-xs">
              <Trans>Idle liquidity</Trans>
            </Text>
          </div>

          {/* Idle Liquidity Rows */}
          {allocationsData.idleLiquidity.map(idle => (
            <div
              key={idle.assetSymbol}
              className="border-cardSecondary grid grid-cols-3 items-center gap-2 border-b py-2 pl-2"
            >
              <div className="flex items-center gap-1.5">
                <TokenIcon token={{ symbol: idle.assetSymbol }} className="h-5 w-5" />
                <Text className="text-text text-sm">{idle.assetSymbol}</Text>
              </div>
              <div className="flex justify-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <Text className="text-text text-sm">{idle.formattedAssets}</Text>
                  </TooltipTrigger>
                  <TooltipContent>
                    <Text className="text-sm">{idle.formattedAssetsUsd}</Text>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Text className="text-textSecondary text-right text-sm">-</Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
