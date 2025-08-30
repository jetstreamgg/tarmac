import { Avatar, AvatarFallback, AvatarImage } from '@widgets/components/ui/avatar';
import { cn } from '@widgets/lib/utils';
import { useTokenImage } from '@widgets/shared/hooks/useTokenImage';
import { Token } from '@jetstreamgg/sky-hooks';
import { useChainImage } from '@widgets/shared/hooks/useChainImage';

export function TokenIcon({
  token,
  chainId,
  width = 50,
  className,
  fallbackClassName,
  fallbackDelay = 500,
  noChain
}: {
  token: Partial<Token> & { symbol: string };
  chainId?: number;
  width?: number;
  className?: string;
  fallbackClassName?: string;
  fallbackDelay?: number;
  noChain?: boolean;
}): React.ReactElement {
  const tokenImageSrc = useTokenImage(token.symbol);
  const chainImageSrc = noChain ? undefined : useChainImage(chainId);

  if (!tokenImageSrc) return <></>;

  return (
    <Avatar className={cn('relative overflow-visible', className)}>
      <AvatarImage width={width} height={width} src={tokenImageSrc} alt={token.name} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={fallbackDelay}>
        {token.symbol.toUpperCase()}
      </AvatarFallback>
      {chainImageSrc && (
        <Avatar className={cn('absolute -right-px bottom-0 h-1/2 w-1/2')}>
          <AvatarImage src={chainImageSrc} className="h-full w-full" />
        </Avatar>
      )}
    </Avatar>
  );
}
