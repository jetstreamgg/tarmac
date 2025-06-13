import { Card } from '@/components/ui/card';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PriceData } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { Text } from '@/modules/layout/components/Typography';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';

type TokenBalance = {
  value: bigint;
  decimals: number;
  symbol: string;
  formatted: string;
  chainId: number;
};

export function AssetBalanceCard({
  tokenBalance,
  priceData,
  isLoadingPrice,
  error,
  chainId
}: {
  tokenBalance: TokenBalance;
  priceData: PriceData | undefined;
  isLoadingPrice: boolean;
  chainId: number;
  error?: Error | null;
}) {
  return (
    <Card key={tokenBalance.symbol} className="flex h-[84px] min-w-[208px] items-center justify-between">
      <div className="flex items-center space-x-2">
        <TokenIcon
          className="h-8 w-8"
          token={{ symbol: tokenBalance.symbol, name: tokenBalance.symbol }}
          chainId={chainId}
        />
        <div className="flex flex-col justify-between">
          <Text>{tokenBalance.symbol}</Text>
          <OracleInfo
            isLoading={isLoadingPrice || !priceData}
            info={priceData ? `$${formatNumber(parseFloat(priceData.price), { maxDecimals: 2 })}` : '--'}
            error={error}
          />
        </div>
      </div>
      <div className="flex flex-col justify-between">
        <Text className="text-right font-bold">
          {formatNumber(parseFloat(tokenBalance.formatted), { maxDecimals: 0, compact: true })}
        </Text>
        <OracleInfo
          isLoading={isLoadingPrice || !priceData}
          info={`$${formatNumber(
            parseFloat(formatUnits(tokenBalance?.value || 0n, tokenBalance?.decimals || 18)) *
              parseFloat(priceData?.price || '0'),
            { maxDecimals: 0, compact: true }
          )}`}
          error={error}
        />
      </div>
    </Card>
  );
}

function OracleInfo({ info, isLoading, error }: { info: string; isLoading: boolean; error?: Error | null }) {
  return (
    <LoadingErrorWrapper
      isLoading={isLoading}
      loadingClassName="h-5"
      error={error ? error : null}
      errorComponent={<></>}
    >
      <Text className="text-textSecondary text-[13px]">{info}</Text>
    </LoadingErrorWrapper>
  );
}
