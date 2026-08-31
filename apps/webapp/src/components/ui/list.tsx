import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Loader } from '@/components/ui/loader';

/**
 * List / Wallet (Figma Patterns/Lists 5209:36922, row 5209:38238): the
 * whole-row wallet connect control — a p-4 borderPrimary hairline row
 * (borderTertiary on hover) holding a 24px wallet icon and a Label 5 name,
 * with an optional Label 6 badge ("Recent") and a 16px fgQuaternary chevron
 * on the right. `active` (5209:38304) is the connecting state: brandBorder
 * edge over the gradient-brand3 fill, the right side replaced by a 20px
 * brand-gradient loader. Disabled has no Figma state; it reuses the resting
 * row at half opacity.
 */
const ListWallet = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Wallet logo, rendered at 24px. */
    icon: React.ReactNode;
    name: React.ReactNode;
    /** Label 6 pill in the right slot (e.g. "Recent"). */
    badge?: React.ReactNode;
    /** Connecting state: brand border + fill, loader instead of the chevron. */
    active?: boolean;
  }
>(({ icon, name, badge, active = false, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'flex w-full items-center justify-between overflow-hidden rounded-2xl border p-4 text-left transition-colors disabled:pointer-events-none',
      active
        ? 'border-brandBorder from-brand3-start to-brand3-end bg-linear-to-b'
        : 'border-borderPrimary hover:border-borderTertiary disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="font-circle text-fgPrimary truncate text-sm leading-4 font-medium tracking-[-0.28px]">
        {name}
      </span>
    </span>
    {active ? (
      <Loader size="s" brand />
    ) : (
      <span className="flex shrink-0 items-center gap-2">
        {badge != null && (
          <span className="bg-glassBadge font-circle text-fgSecondary flex h-6 items-center rounded-full px-2 text-xs leading-3.5 font-medium tracking-[-0.24px] whitespace-nowrap">
            {badge}
          </span>
        )}
        <ChevronRight className="text-fgQuaternary size-4 shrink-0" />
      </span>
    )}
  </button>
));
ListWallet.displayName = 'ListWallet';

export { ListWallet };
