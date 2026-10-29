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
  showChainIcon = true,
  alt = ''
}: {
  token: Partial<Token> & { symbol: string };
  width?: number;
  className?: string;
  fallbackClassName?: string;
  chainId?: number;
  showChainIcon?: boolean;
  /**
   * Decorative by default: nearly every icon sits beside its printed symbol, so
   * a name would only be read twice. Pass the token name where the icon stands
   * alone (APP-578).
   */
  alt?: string;
}): React.ReactElement {
  const tokenImageSrc = useTokenImage(token.symbol);
  const chainImageSrc = useChainImage(chainId);

  if (!token.symbol) return <></>;

  return (
    <Avatar className={cn('relative overflow-visible', className)}>
      <AvatarImage width={width} height={width} src={tokenImageSrc} alt={alt} />
      <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={500}>
        {token.symbol.toUpperCase()}
      </AvatarFallback>
      {showChainIcon && chainImageSrc && (
        <Avatar className={cn('absolute -right-px bottom-0 h-1/2 w-1/2')}>
          <AvatarImage src={chainImageSrc} alt="" className="h-full w-full" />
        </Avatar>
      )}
    </Avatar>
  );
}
