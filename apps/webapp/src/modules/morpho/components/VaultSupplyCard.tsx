import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useTokenBalance, getTokenDecimals, type Token } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';

const NO_VALUE = '–';

/**
 * No-position vault entry card (Figma: undeposited state). Mirrors the Savings
 * no-position card, adapted to a vault: a "Supply {asset} and earn X% APY"
 * headline, a (TODO) blurb, a Current Rate / Idle balance stat row, and a
 * full-width Supply CTA that opens the shared supply modal. No inline input —
 * all amount entry happens in the modal.
 */
export function VaultSupplyCard({
  assetToken,
  netRate,
  onSupply
}: {
  assetToken: Token;
  /** Net APY as a decimal fraction (e.g. 0.0445). */
  netRate?: number;
  onSupply: () => void;
}) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const decimals = getTokenDecimals(assetToken, chainId);

  const { data: balance } = useTokenBalance({ address, chainId, token: assetToken.address[chainId] });

  // The CTA stays enabled while disconnected: clicking routes through the
  // connect flow and continues into the supply modal once connected.
  const onSupplyOrConnect = useConnectThenAct(onSupply);

  const rate = netRate !== undefined ? formatDecimalPercentage(netRate) : NO_VALUE;
  const idleBalance =
    isConnected && balance
      ? formatNumber(parseFloat(formatUnits(balance.value, decimals)), { maxDecimals: 2 })
      : NO_VALUE;

  return (
    <Card className="flex flex-col gap-6 p-6" data-testid="vault-supply-card">
      <h3 className="text-text text-2xl leading-snug font-medium">
        <Trans>
          Supply{' '}
          <span className="whitespace-nowrap">
            <TokenIcon
              token={{ symbol: assetToken.symbol }}
              width={24}
              showChainIcon={false}
              className="mr-1 inline-block h-6 w-6 -translate-y-0.5 align-middle"
            />
            {assetToken.symbol}
          </span>{' '}
          and earn {rate} APY
        </Trans>
      </h3>

      {/* TODO: product description copy. */}
      <p className="text-textSecondary text-sm leading-relaxed">TODO</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Current Rate</Trans>
          </span>
          <span className="text-text font-medium">{rate}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Idle balance</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {idleBalance}
            <TokenIcon
              token={{ symbol: assetToken.symbol }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
          </span>
        </div>
      </div>

      <Button variant="primary" className="w-full" onClick={onSupplyOrConnect} data-testid="vault-supply-cta">
        <Trans>Supply</Trans>
      </Button>
    </Card>
  );
}
