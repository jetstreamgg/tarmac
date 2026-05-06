import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { type PendleMarketConfig, usePendleRedeemPreview } from '@jetstreamgg/sky-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { Text } from '@/modules/layout/components/Typography';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';

type PendleMaturedPositionCardProps = {
  market: PendleMarketConfig;
  ptBalance: bigint;
};

export const PendleMaturedPositionCard = ({ market, ptBalance }: PendleMaturedPositionCardProps) => {
  const formattedBalance = formatBigInt(ptBalance, {
    unit: market.underlyingDecimals,
    maxDecimals: 4
  });
  const maturityLabel = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const { data: previewAmount, isLoading: previewLoading } = usePendleRedeemPreview(market, ptBalance);
  const formattedReceive =
    previewAmount !== undefined
      ? formatBigInt(previewAmount as bigint, { unit: market.underlyingDecimals, maxDecimals: 4 })
      : undefined;
  // The amount we surface to the user is the receive amount (post SY-rate
  // conversion). Until the on-chain preview resolves, fall back to the PT
  // balance — same number of decimals, just a transient discrepancy.
  const displayedAmount = formattedReceive ?? formattedBalance;

  const tokenTile = (
    <HStack className="items-center" gap={2}>
      <TokenIcon className="h-5 w-5" token={{ symbol: market.underlyingSymbol }} showChainIcon={false} />
      <Text>
        {displayedAmount} {market.underlyingSymbol}
      </Text>
    </HStack>
  );

  const { openRedeemModal, isRedeemable, isPrepared } = usePendleRedeemModal(market, {
    transactionContent: tokenTile
  });

  return (
    <Card variant="stats" data-testid="pendle-matured-position-card">
      <CardHeader>
        <CardTitle variant="stats" className="mb-2">
          <Trans>Matured on {maturityLabel}</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent variant="stats">
        <TokenIconWithBalance
          token={{ symbol: market.underlyingSymbol, name: market.underlyingSymbol }}
          balance={displayedAmount}
        />
        {/* TODO: mock copy — replace with computed earnings + APY. */}
        <Text variant="small" className="text-textSecondary mt-4">
          <Trans>You&apos;ve earned 87.42 {market.underlyingSymbol} with 5.21% APY</Trans>
        </Text>
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={openRedeemModal}
          disabled={!isRedeemable || !isPrepared || previewLoading}
          data-testid="pendle-matured-redeem-button"
        >
          <Trans>
            Redeem {displayedAmount} {market.underlyingSymbol}
          </Trans>
        </Button>
      </CardContent>
    </Card>
  );
};
