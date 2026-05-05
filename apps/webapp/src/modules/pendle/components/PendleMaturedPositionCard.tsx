import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { type PendleMarketConfig, usePendleRedeemPreview } from '@jetstreamgg/sky-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
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

  const tokenTile = (
    <HStack className="items-center" gap={2}>
      <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS' }} showChainIcon={false} />
      <Text>
        {formattedBalance} PT-{market.underlyingSymbol} → {formattedReceive ?? formattedBalance}{' '}
        {market.underlyingSymbol}
      </Text>
    </HStack>
  );

  const { openRedeemModal, isRedeemable, isPrepared } = usePendleRedeemModal(market, {
    transactionContent: tokenTile
  });

  return (
    <Card variant="stats" data-testid="pendle-matured-position-card">
      <CardHeader>
        <VStack className="items-stretch" gap={1}>
          <CardTitle variant="stats">
            <Trans>Available to redeem</Trans>
          </CardTitle>
          <HStack className="items-center" gap={2}>
            <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS' }} showChainIcon={false} />
            <Text>
              {formattedBalance} PT-{market.underlyingSymbol}
            </Text>
          </HStack>
        </VStack>
        <VStack className="items-stretch text-right" gap={1}>
          <CardTitle variant="stats" className="whitespace-nowrap">
            <Trans>Matured</Trans>
          </CardTitle>
          <Text className="whitespace-nowrap">{maturityLabel}</Text>
        </VStack>
      </CardHeader>
      <CardContent variant="stats" className="mt-4">
        <Button
          className="border-textSecondary disabled:border-textMuted disabled:text-textMuted w-full border bg-transparent hover:bg-[rgb(77,76,111)] active:bg-[rgb(94,92,136)]"
          onClick={openRedeemModal}
          disabled={!isRedeemable || !isPrepared || previewLoading}
          data-testid="pendle-matured-redeem-button"
        >
          <Trans>
            Redeem {formattedBalance} PT-{market.underlyingSymbol}
          </Trans>
        </Button>
      </CardContent>
    </Card>
  );
};
