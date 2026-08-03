import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Layers, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { BundleExplainer } from './BundleExplainer';

/**
 * The `Bundled` / `Not bundled` badge that sits beside the network fee, and the panel it
 * opens (Figma 1036:206945 / 1036:207016).
 *
 * Figma draws the panel over a hovered badge, but it contains a working switch, so it is
 * a click-opened Popover rather than a Tooltip — a hover surface can't be operated by
 * keyboard or touch.
 *
 * `PopoverContent` portals to the document root, which puts this panel outside the
 * transaction modal's dialog. The modal handles that (see `onPointerDownOutside` in
 * TransactionModal); without it, using the switch reads as a click outside the dialog and
 * Radix dismisses the whole modal.
 *
 * The switch writes the app-wide preference (`useBatchToggle`), so flipping it here also
 * changes the nav menu and every later transaction.
 */
export function BundleTogglePanel() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          data-testid="bundle-toggle-badge"
          aria-label={t`Bundled transactions`}
        >
          <Badge variant={batchEnabled ? 'brand' : 'neutral'}>
            {batchEnabled ? <Zap width={12} height={12} /> : <Layers width={12} height={12} />}
            {batchEnabled ? <Trans>Bundled</Trans> : <Trans>Not bundled</Trans>}
          </Badge>
        </button>
      </PopoverTrigger>
      {/* The surface is the DS Tooltip's, not the app popover's opaque bg-container:
          this panel sits beside the fee row's info tooltip, and the two read as one
          family only if they share the bg-tertiary glass + 20px backdrop blur and the
          16px radius (tooltip.tsx carries the same recipe). */}
      <PopoverContent
        align="start"
        side="top"
        className="bg-bgTertiary flex w-[260px] flex-col gap-2 rounded-2xl p-4 shadow-none backdrop-blur-[20px]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-fgPrimary font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]">
            <Zap size={16} className="text-fgBrand shrink-0" />
            <Trans>Bundle transactions</Trans>
          </span>
          <Switch
            checked={batchEnabled}
            onCheckedChange={setBatchEnabled}
            aria-label={t`Toggle bundled transactions`}
            data-testid="bundle-panel-switch"
          />
        </div>
        <BundleExplainer />
      </PopoverContent>
    </Popover>
  );
}
