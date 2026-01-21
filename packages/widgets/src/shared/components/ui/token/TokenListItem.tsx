import { Button } from '@widgets/components/ui/button';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Text } from '@widgets/shared/components/ui/Typography';
import { HStack } from '../layout/HStack';
import { VStack } from '../layout/VStack';
import { TokenIcon } from './TokenIcon';
import { PopoverClose } from '@widgets/components/ui/popover';
import { TOKENS, Token, getTokenDecimals, usePrices, useTokenBalance } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useConnection, useBalance, useChainId } from 'wagmi';
import { formatUnits } from 'viem';

interface TokenListItemProps {
  token: Token;
  onTokenSelected?: (token: Token) => void;
  enabled?: boolean;
}

export function TokenListItem({
  token,
  onTokenSelected,
  enabled = true
}: TokenListItemProps): React.ReactElement {
  const chainId = useChainId();
  const tokenAddress = typeof token.address === 'string' ? token.address : token.address?.[chainId];
  const { address: connectedAddress, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const { data: nativeBalance, isLoading: isLoadingNativeBalance } = useBalance({
    address: connectedAddress,
    chainId: chainId,
    query: { enabled: token.symbol === TOKENS.eth.symbol }
  });

  const { data: tokenBalance, isLoading: isLoadingTokenBalance } = useTokenBalance({
    address: connectedAddress,
    chainId: chainId,
    token: tokenAddress,
    isNative: !!token?.isNative
  });

  const currentToken = useMemo(
    () => ({ ...token, address: tokenAddress, decimals: getTokenDecimals(token, chainId) }),
    [token, tokenAddress, chainId]
  );
  const { data: pricesData, isLoading: isLoadingPrices } = usePrices();
  const isLoading = isLoadingNativeBalance || isLoadingTokenBalance || isLoadingPrices;

  const formattedBalance = isConnectedAndEnabled
    ? token.symbol === TOKENS.eth.symbol
      ? formatBigInt(nativeBalance?.value || 0n, { unit: nativeBalance?.decimals })
      : formatBigInt(tokenBalance?.value || 0n, { unit: tokenBalance?.decimals })
    : '';

  const isEthToken = token.symbol === TOKENS.eth.symbol;
  const balanceData = isEthToken ? nativeBalance : tokenBalance;
  const usdDecimals = (balanceData?.decimals || 0) + (currentToken?.decimals || 0);
  const balanceValue = balanceData?.value || 0n;
  const price = pricesData?.[currentToken.symbol]?.price || '0';
  const formattedUsdBalance = isConnectedAndEnabled
    ? formatNumber(parseFloat(formatUnits(balanceValue, balanceData?.decimals || 18)) * parseFloat(price), {
        unit: usdDecimals,
        compact: true
      })
    : '';

  return (
    <motion.div variants={positionAnimations}>
      <PopoverClose asChild>
        <Button
          variant={null}
          className="h-14 w-full rounded-xl bg-blend-overlay hover:bg-[#FFFFFF0D]"
          onClick={() => onTokenSelected?.(token)}
        >
          <HStack className="h-full w-full items-center justify-between py-2.5">
            <HStack className="items-center justify-between p-0">
              <div className="h-8 w-8">
                <TokenIcon className="h-8 w-8" token={token} />
              </div>
              <VStack className="h-9 items-start justify-between" gap={1}>
                <Text className="text-text text-[13px] leading-none font-normal">{token.name}</Text>
                <Text className="text-selectActive text-xs leading-none font-normal">{token.symbol}</Text>
              </VStack>
            </HStack>
            <VStack className="h-9 items-end justify-between p-0">
              {isLoading ? (
                <>
                  <Skeleton className="bg-surface h-4 w-20" />
                  <Skeleton className="bg-surface h-4 w-5" />
                </>
              ) : (
                <>
                  <Text className="text-text h-full text-right text-[13px] leading-none font-normal">
                    {formattedBalance}
                  </Text>
                  <Text className="text-selectActive text-right text-xs leading-none font-normal">
                    {formattedUsdBalance && `$${formattedUsdBalance}`}
                  </Text>
                </>
              )}
            </VStack>
          </HStack>
        </Button>
      </PopoverClose>
    </motion.div>
  );
}
