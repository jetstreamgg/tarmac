import { Trans } from '@lingui/react/macro';
import { useChains } from 'wagmi';
import { useEarnMarketplace } from '@/hooks';
import { formatNumber } from '@/utils';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { AppLink } from '@/lib/navigation';

const NO_VALUE = '–';

const formatUsd = (totalUsd?: number) => (totalUsd !== undefined ? `$${formatNumber(totalUsd)}` : NO_VALUE);

// Placeholder destination screen; the real Earn marketplace lands with Track C
// (C2). The table below is a deliberately bare rendering of the C1
// useEarnMarketplace aggregator so the data layer can be exercised in-app.
export function EarnPage() {
  const { rows, isLoading } = useEarnMarketplace();
  const chains = useChains();
  const chainName = (id: number) => chains.find(c => c.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Heading>
        <Trans>Earn</Trans>
      </Heading>
      <Text variant="medium" className="text-textSecondary">
        <Trans>The Earn experience is coming soon.</Trans>
      </Text>
      <table className="text-text w-full text-left text-sm" data-testid="earn-opportunities-table">
        <thead>
          <tr className="text-textSecondary border-b">
            <th className="p-2 font-medium">
              <Trans>Token</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>Network</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>Risk profile</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>Rate</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>30D Rate</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>TVL</Trans>
            </th>
            <th className="p-2 font-medium">
              <Trans>My position</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b" data-testid={`earn-row-${row.id}`}>
              <td className="p-2">
                <AppLink to={row.detailPath} className="underline">
                  {row.name}
                </AppLink>
                <span className="text-textSecondary ml-2">{row.tokenSymbol}</span>
              </td>
              <td className="p-2">{row.networks.map(chainName).join(', ') || NO_VALUE}</td>
              <td className="p-2 capitalize">{row.risk}</td>
              <td className="p-2">{row.isLoading ? '…' : row.rate.formatted}</td>
              <td className="p-2">{row.rate30d?.formatted ?? NO_VALUE}</td>
              <td className="p-2">{row.isLoading ? '…' : formatUsd(row.tvl?.totalUsd)}</td>
              <td className="p-2">{row.isLoading ? '…' : formatUsd(row.position?.totalUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isLoading && (
        <Text variant="small" className="text-textSecondary">
          <Trans>Loading…</Trans>
        </Text>
      )}
    </div>
  );
}
