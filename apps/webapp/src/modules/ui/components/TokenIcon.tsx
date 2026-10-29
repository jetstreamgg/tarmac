import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Token } from '@/hooks';
import { useChainImage } from '@/modules/ui/hooks/useChainImage';
import { useTokenImage } from '@/modules/ui/hooks/useTokenImage';

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
  // Typed `string`, but wallet and third-party data can hand us anything at
  // runtime (APP-654). Treat a non-string symbol as missing rather than crash.
  const rawSymbol: unknown = token.symbol;
  const symbol = typeof rawSymbol === 'string' ? rawSymbol : undefined;
  const tokenImageSrc = useTokenImage(symbol);
  const chainImageSrc = useChainImage(chainId);

  if (!symbol) return <></>;

  return (
    <Avatar className={cn('relative overflow-visible', className)}>
      <AvatarImage width={width} height={width} src={tokenImageSrc} alt={token.name} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={500}>
        {symbol.toUpperCase()}
      </AvatarFallback>
      {showChainIcon && chainImageSrc && (
        <Avatar className={cn('absolute -right-px bottom-0 h-1/2 w-1/2')}>
          <AvatarImage src={chainImageSrc} className="h-full w-full" />
        </Avatar>
      )}
    </Avatar>
  );
}
