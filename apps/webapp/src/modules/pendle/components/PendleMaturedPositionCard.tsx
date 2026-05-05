import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

/**
 * Single matured-position card for the "Ready to redeem" section on the list
 * page. Shows the market + 1:1 redemption preview + a Redeem button that
 * opens the global TransactionContext modal.
 */
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

  const tokenTile = (
    <HStack className="items-center" gap={2}>
      <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS' }} showChainIcon={false} />
      <Text>
        {formattedBalance} PT-{market.underlyingSymbol} → {formattedBalance} {market.underlyingSymbol}
      </Text>
    </HStack>
  );

  const { openRedeemModal, isRedeemable, isPrepared } = usePendleRedeemModal(market, {
    transactionContent: tokenTile
  });

  return (
    <Card
      className="bg-transparent from-card to-card bg-radial-(--gradient-position) lg:p-5"
      data-testid="pendle-matured-position-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'USDS' }} />
          <Text>PT-{market.underlyingSymbol}</Text>
          <Text variant="small" className="text-textSecondary">
            <Trans>· Matured</Trans>
          </Text>
        </HStack>
        <Button
          onClick={openRedeemModal}
          disabled={!isRedeemable || !isPrepared}
          data-testid="pendle-matured-redeem-button"
        >
          <Trans>Redeem</Trans>
        </Button>
      </CardHeader>
      <CardContent className="mt-3 p-0">
        <VStack gap={1}>
          <Text className="text-textSecondary text-sm">
            <Trans>
              Redeem {formattedBalance} PT-{market.underlyingSymbol} for {formattedBalance}{' '}
              {market.underlyingSymbol} (1:1)
            </Trans>
          </Text>
          <Text variant="small" className="text-textSecondary">
            <Trans>Matured · {maturityLabel}</Trans>
          </Text>
        </VStack>
      </CardContent>
    </Card>
  );
};
