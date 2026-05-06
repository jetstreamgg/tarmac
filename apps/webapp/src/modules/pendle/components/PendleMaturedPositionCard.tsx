import { Trans } from '@lingui/react/macro';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import {
  type PendleMarketConfig,
  usePendleMaturedPositionEarnings,
  usePendleRedeemPreview
} from '@jetstreamgg/sky-hooks';
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
  const { earnings, apy, currency } = usePendleMaturedPositionEarnings(market, ptBalance);
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
        {earnings !== undefined && earnings > 0 && currency && (
          <Text variant="small" className="text-textSecondary mt-4">
            {apy !== undefined ? (
              <Trans>
                You&apos;ve earned {formatNumber(earnings)} {currency} with {formatDecimalPercentage(apy)} APY
              </Trans>
            ) : (
              <Trans>
                You&apos;ve earned {formatNumber(earnings)} {currency}
              </Trans>
            )}
          </Text>
        )}
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
