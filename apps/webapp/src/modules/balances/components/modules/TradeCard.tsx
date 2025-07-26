import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { HStack } from '@/modules/layout/components/HStack';
import { TOKENS } from '@jetstreamgg/sky-hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { defaultConfig } from '@jetstreamgg/sky-widgets';
import { mainnet } from 'viem/chains';
import { useChainId } from 'wagmi';
import { useMemo } from 'react';

const SKY_TOKEN_SYMBOLS = new Set([
  TOKENS.dai.symbol,
  TOKENS.usds.symbol,
  TOKENS.susds.symbol,
  TOKENS.mkr.symbol,
  TOKENS.sky.symbol,
  TOKENS.spk.symbol
]);

export function TradeCard() {
  const chainId = useChainId();

  const { skyTokens, nonSkyTokens } = useMemo(() => {
    const tokens = defaultConfig.tradeTokenList[chainId] || [];
    const sky: typeof tokens = [];
    const nonSky: typeof tokens = [];

    for (const token of tokens) {
      if (SKY_TOKEN_SYMBOLS.has(token.symbol)) {
        sky.push(token);
      } else {
        nonSky.push(token);
      }
    }

    return { skyTokens: sky, nonSkyTokens: nonSky };
  }, [chainId]);

  return (
    <ModuleCard
      intent={Intent.TRADE_INTENT}
      module={t`Trade`}
      title={t`Trade your crypto tokens`}
      className="from-[#543381] to-[#7a41c0]"
      logoName="trade"
      subHeading={
        <div className="flex flex-wrap items-center gap-4">
          <HStack className="items-center -space-x-1">
            {nonSkyTokens.map((token, index) => (
              <div key={token.symbol} style={{ zIndex: nonSkyTokens.length - index }}>
                <TokenIcon token={token} className="h-6 w-6" />
              </div>
            ))}
          </HStack>
          <div className="h-px w-10 bg-white/30" />
          <HStack className="items-center -space-x-1">
            {skyTokens.map((token, index) => (
              <div key={token.symbol} style={{ zIndex: skyTokens.length - index }}>
                <TokenIcon token={token} className="h-6 w-6" />
              </div>
            ))}
          </HStack>
        </div>
      }
      emphasisText={
        chainId === mainnet.id ? (
          <Text className="text-textSecondary">
            Trades are powered by{' '}
            <ExternalLink href="https://cow.fi/" showIcon={false} className="text-textSecondary underline">
              CoW Protocol
            </ExternalLink>
            .
          </Text>
        ) : undefined
      }
    />
  );
}
