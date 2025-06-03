import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Token } from '@jetstreamgg/hooks';
import { getChainSpecificText } from '@jetstreamgg/utils';

import React from 'react';
import { useChainId } from 'wagmi';

export function TokenIcon({
  token,
  width = 50,
  className,
  fallbackClassName,
  chainId
}: {
  token: Partial<Token> & { symbol: string };
  width?: number;
  className?: string;
  fallbackClassName?: string;
  chainId?: number;
}): React.ReactElement {
  const connectedChainId = useChainId();
  const chainIdToUse = chainId ?? connectedChainId;
  if (!token.symbol) return <></>;

  const path = `/tokens/${getChainSpecificText(
    {
      base: 'base/',
      arbitrum: 'arbitrum/',
      optimism: 'optimism/',
      unichain: 'unichain/',
      ethereum: 'ethereum/',
      default: ''
    },
    chainIdToUse
  )}${token.symbol.toLowerCase()}.svg`;

  return (
    <Avatar className={cn('', className)}>
      <AvatarImage width={width} height={width} src={path} alt={token.name} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={500}>
        {token.symbol.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
