import { cn } from '@/lib/cn';
import { getChainIcon } from '@/utils';
import { getBridgeNetwork, type BridgeNetworkId } from '../model/networks';

// No Avalanche/Solana artwork in the DS yet; a lettered disc stands in until design ships icons.
const PLACEHOLDER: Partial<Record<BridgeNetworkId, { letter: string; className: string }>> = {
  avalanche: { letter: 'A', className: 'bg-[#e84142]' },
  solana: { letter: 'S', className: 'bg-linear-to-br from-[#9945ff] to-[#14f195]' }
};

type BridgeNetworkIconProps = { network: BridgeNetworkId; className?: string };

export function BridgeNetworkIcon({ network, className }: BridgeNetworkIconProps) {
  const placeholder = PLACEHOLDER[network];
  if (placeholder) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold text-white',
          placeholder.className,
          className
        )}
      >
        {placeholder.letter}
      </span>
    );
  }
  return getChainIcon(getBridgeNetwork(network).chainId ?? 1, cn('shrink-0', className));
}

type BridgeNetworkBadgeProps = { network: BridgeNetworkId };

/** Badges / Illustration pill (28px) naming a network — the review hero's right-hand badge. */
export function BridgeNetworkBadge({ network }: BridgeNetworkBadgeProps) {
  return (
    <span className="bg-glassBadge flex h-7 shrink-0 items-center gap-1 rounded-full py-1.5 pr-2 pl-1.5">
      <BridgeNetworkIcon network={network} className="size-4" />
      <span className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
        {getBridgeNetwork(network).name}
      </span>
    </span>
  );
}
