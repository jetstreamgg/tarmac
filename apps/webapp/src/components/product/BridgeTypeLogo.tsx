import { cn } from '@/lib/cn';
import { CircleLogo, SkyLinkLogo } from '@/modules/icons';

/** The logo drawn before a bridge route's name: Circle's for CCTP, SkyLink's for Sky's native bridges. */
export type BridgeTypeLogoKind = 'cctp' | 'skylink';

type BridgeTypeLogoProps = { logo: BridgeTypeLogoKind; size?: 12 | 16 };

export function BridgeTypeLogo({ logo, size = 12 }: BridgeTypeLogoProps) {
  const className = cn('shrink-0', size === 16 ? 'size-4' : 'size-3');
  return logo === 'cctp' ? (
    <CircleLogo boxSize={size} className={className} aria-hidden data-testid="cell-logo-cctp" />
  ) : (
    <SkyLinkLogo
      boxSize={size}
      className={cn('text-fgPrimary', className)}
      aria-hidden
      data-testid="cell-logo-skylink"
    />
  );
}
