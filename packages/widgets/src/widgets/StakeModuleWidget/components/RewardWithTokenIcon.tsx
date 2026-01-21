import { Avatar, AvatarFallback, AvatarImage } from '@widgets/components/ui/avatar';
import { cn } from '@widgets/lib/utils';
import { useTokenImage } from '@widgets/shared/hooks/useTokenImage';
import { Token } from '@jetstreamgg/sky-hooks';
import { Rewards } from '@widgets/shared/components/icons/Rewards';

export function RewardWithTokenIcon({
  token,
  className,
  fallbackClassName,
  fallbackDelay = 500
}: {
  token: Partial<Token> & { symbol: string };
  className?: string;
  fallbackClassName?: string;
  fallbackDelay?: number;
}): React.ReactElement {
  const tokenImageSrc = useTokenImage(token.symbol);

  return (
    <Avatar className={cn('relative h-6 w-6 overflow-visible', className)}>
      <Rewards className={className} />
      {tokenImageSrc && (
        <Avatar className={cn('absolute -right-px bottom-0 h-1/2 w-1/2')}>
          <AvatarImage src={tokenImageSrc} className="h-full w-full" />
          <AvatarFallback className={cn('bg-slate-200 text-xs', fallbackClassName)} delayMs={fallbackDelay}>
            {token.symbol.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </Avatar>
  );
}
