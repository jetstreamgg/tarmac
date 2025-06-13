import { Avatar, AvatarFallback, AvatarImage } from '@widgets/components/ui/avatar';
import { cn } from '@widgets/lib/utils';
import { useTokenImage } from '@widgets/shared/hooks/useTokenImage';
import { Token } from '@jetstreamgg/sky-hooks';

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
  const imageSrc = useTokenImage(token.symbol, chainId, noChain);

  if (!imageSrc) return <></>;

  return (
    <Avatar className={cn('', className)}>
      <AvatarImage width={width} height={width} src={imageSrc} alt={token.name} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={fallbackDelay}>
        {token.symbol.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
