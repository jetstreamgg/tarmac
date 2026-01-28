import { useMorphoVaultSingleMarketApiData } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PairTokenIcons } from '@jetstreamgg/sky-widgets';
import { useChainId } from 'wagmi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

type MorphoVaultAllocationsDetailsProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultAllocationsDetails({ vaultAddress }: MorphoVaultAllocationsDetailsProps) {
  const { data: singleMarketData, isLoading } = useMorphoVaultSingleMarketApiData({ vaultAddress });
  const allocationsData = singleMarketData?.market;
  const chainId = useChainId();

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="text-center">
              <Skeleton className="mx-auto h-4 w-16" />
            </TableHead>
            <TableHead className="text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="select-none has-[td]:hover:bg-transparent has-[td]:active:bg-transparent">
            <TableCell colSpan={3} className="h-auto px-4 py-2">
              <Skeleton className="h-3 w-16" />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="h-auto py-4 pl-6">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28" />
              </div>
            </TableCell>
            <TableCell className="h-auto py-4 text-center">
              <Skeleton className="mx-auto h-4 w-14" />
            </TableCell>
            <TableCell className="h-auto py-4 text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
          </TableRow>
          <TableRow className="select-none has-[td]:hover:bg-transparent has-[td]:active:bg-transparent">
            <TableCell colSpan={3} className="h-auto px-4 py-2">
              <Skeleton className="h-3 w-16" />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="h-auto py-4 pl-6">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </TableCell>
            <TableCell className="h-auto py-4 text-center">
              <Skeleton className="mx-auto h-4 w-14" />
            </TableCell>
            <TableCell className="h-auto py-4 text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (
    !allocationsData ||
    (allocationsData.v1Vaults.length === 0 &&
      allocationsData.markets.length === 0 &&
      allocationsData.idleLiquidity.length === 0)
  ) {
    return (
      <Text className="text-textSecondary">
        <Trans>No allocations found</Trans>
      </Text>
    );
  }

  return (
    <Table>
      {/* Table Header */}
      <TableHeader>
        <TableRow>
          <TableHead>
            <Text variant="small">
              <Trans>Vaults / Markets</Trans>
            </Text>
          </TableHead>
          <TableHead className="text-center">
            <Text variant="small">
              <Trans>Allocation ({allocationsData.assetSymbol})</Trans>
            </Text>
          </TableHead>
          <TableHead className="text-right">
            <Text variant="small">
              <Trans>Net Rate</Trans>
            </Text>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {/* V1 Vaults Section */}
        {allocationsData.v1Vaults.length > 0 && (
          <>
            <TableRow className="select-none has-[td]:hover:bg-transparent has-[td]:active:bg-transparent">
              <TableCell colSpan={3} className="h-auto px-4 py-2">
                <Text className="text-textSecondary text-xs">
                  <Trans>Vaults V1</Trans>
                </Text>
              </TableCell>
            </TableRow>
            {allocationsData.v1Vaults.map(v1Vault => (
              <TableRow key={v1Vault.vaultAddress}>
                <TableCell className="h-auto py-4 pl-6">
                  <div className="flex items-center gap-1.5">
                    <TokenIcon token={{ symbol: allocationsData.assetSymbol }} className="h-5 w-5" />
                    <Text className="text-sm">{v1Vault.vaultName}</Text>
                    <Tooltip>
                      <TooltipTrigger>
                        <ExternalLink
                          href={`https://app.morpho.org/ethereum/vault/${v1Vault.vaultAddress}`}
                          showIcon={true}
                          iconClassName="h-[13px] w-[13px]"
                        />
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent>
                          <Text className="text-sm">View vault on Morpho</Text>
                        </TooltipContent>
                      </TooltipPortal>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="h-auto py-4 text-center">
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <Text className="text-text text-sm">{v1Vault.formattedAssets}</Text>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Text className="text-sm">{v1Vault.formattedAssetsUsd}</Text>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="h-auto py-4 text-right">
                  <Text className="text-sm">{v1Vault.formattedNetApy}</Text>
                </TableCell>
              </TableRow>
            ))}
          </>
        )}

        {/* Markets Section */}
        {allocationsData.markets.length > 0 && (
          <>
            <TableRow className="select-none has-[td]:hover:bg-transparent has-[td]:active:bg-transparent">
              <TableCell colSpan={3} className="h-auto px-4 py-2">
                <Text className="text-textSecondary text-xs">
                  <Trans>Markets</Trans>
                </Text>
              </TableCell>
            </TableRow>
            {allocationsData.markets.map(market => (
              <TableRow key={market.marketId}>
                <TableCell className="h-auto py-4 pl-6">
                  <div className="flex items-center gap-1.5">
                    <PairTokenIcons
                      leftToken={market.collateralAsset}
                      rightToken={market.loanAsset}
                      chainId={chainId}
                    />
                    <Text className="text-text text-sm">
                      {market.collateralAsset} / {market.loanAsset}
                    </Text>
                    <Tooltip>
                      <TooltipTrigger asChild className="cursor-default">
                        <div className="bg-textSecondary/15 rounded-sm px-1 py-0.5">
                          <Text className="text-xs">{market.formattedLltv}</Text>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <Text className="text-sm">Liquidation Loan-To-Value (LLTV)</Text>
                        <TooltipArrow width={12} height={8} />
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <ExternalLink
                          href={`https://app.morpho.org/ethereum/market/${market.marketId}`}
                          showIcon={true}
                          iconClassName="h-[13px] w-[13px]"
                        />
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent>
                          <Text className="text-sm">View market on Morpho</Text>
                        </TooltipContent>
                      </TooltipPortal>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="h-auto py-4 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild className="cursor-default">
                      <Text className="text-text text-sm">{market.formattedAssets}</Text>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Text className="text-sm">{market.formattedAssetsUsd}</Text>
                      <TooltipArrow width={12} height={8} />
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="h-auto py-4 text-right">
                  <Text className="text-sm">{market.formattedNetApy}</Text>
                </TableCell>
              </TableRow>
            ))}
          </>
        )}

        {/* Idle Liquidity Section */}
        {allocationsData.idleLiquidity.length > 0 && (
          <>
            <TableRow className="select-none has-[td]:hover:bg-transparent has-[td]:active:bg-transparent">
              <TableCell colSpan={3} className="h-auto px-4 py-2">
                <Text className="text-textSecondary text-xs">
                  <Trans>Idle liquidity</Trans>
                </Text>
              </TableCell>
            </TableRow>
            {allocationsData.idleLiquidity.map(idle => (
              <TableRow key={idle.assetSymbol}>
                <TableCell className="h-auto py-4 pl-6">
                  <div className="flex items-center gap-1.5">
                    <TokenIcon token={{ symbol: idle.assetSymbol }} className="h-5 w-5" />
                    <Text className="text-text text-sm">{idle.assetSymbol}</Text>
                  </div>
                </TableCell>
                <TableCell className="h-auto py-4 text-center">
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <Text className="text-text text-sm">{idle.formattedAssets}</Text>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Text className="text-sm">{idle.formattedAssetsUsd}</Text>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="h-auto py-4 text-right">
                  <Text className="text-textSecondary text-sm">-</Text>
                </TableCell>
              </TableRow>
            ))}
          </>
        )}
      </TableBody>
    </Table>
  );
}
