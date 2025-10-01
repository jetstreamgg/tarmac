import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Token } from '@jetstreamgg/sky-hooks';
import { useChainImage, useTokenImage } from '@jetstreamgg/sky-widgets';

export function TokenIcon({
  token,
  width = 50,
  className,
  fallbackClassName,
  chainId,
  showChainIcon = true
}: {
  token: Partial<Token> & { symbol: string };
  width?: number;
  className?: string;
  fallbackClassName?: string;
  chainId?: number;
  showChainIcon?: boolean;
}): React.ReactElement {
  const tokenImageSrc = useTokenImage(token.symbol);
  const chainImageSrc = useChainImage(chainId);

  if (!token.symbol) return <></>;

  return (
    <Avatar className={cn('relative overflow-visible', className)}>
      <AvatarImage width={width} height={width} src={tokenImageSrc} alt={token.name} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={500}>
        {token.symbol.toUpperCase()}
      </AvatarFallback>
      {showChainIcon && chainImageSrc && (
        <Avatar className={cn('absolute -right-px bottom-0 h-1/2 w-1/2')}>
          <AvatarImage src={chainImageSrc} className="h-full w-full" />
        </Avatar>
      )}
    </Avatar>
  );
}
