import { useCallback } from 'react';
import { useChainId, useChains } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { getChainIcon } from '@/utils';
import { Intent } from '@/lib/enums';
import { useIsSafeWallet } from '@/hooks';
import { useChainModalContext } from '@/modules/ui/context/ChainModalContext';
import { INTENT_PATHS, keepSearch, useAppSearchParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';

type NetworkSelectProps = {
  /** The chains this surface may switch between — the product's supported set. */
  chainIds: number[];
  showLabel?: boolean;
  /** Extra classes on the chain-name label, e.g. to hide it per tier. */
  labelClassName?: string;
  /** Extra classes on the trigger, e.g. `w-full justify-between` for a full-width row. */
  triggerClassName?: string;
  showDropdownIcon?: boolean;
  /** DS Button / Dropdown recipe: Network M (24px icon) or Network XS (16px icon). */
  size?: 'm' | 'xs';
  dataTestId?: string;
  disabled?: boolean;
  /**
   * A custom trigger body, replacing the pill — Convert's full-width Network row
   * is the whole clickable surface. The child then owns the trigger's looks
   * entirely: no pill recipe is applied, and the panel sizes to its own content
   * instead of matching a trigger that spans the card.
   */
  children?: React.ReactNode;
};

/**
 * The network switch control on a product page and in a transaction modal's
 * entry grid (Figma 2682:77695).
 *
 * Replaces the old full-screen `ChainModal`: switching chain is an ordinary
 * pick from a short list, not a dialog. The panel needs no styling of its own
 * — the design-system `Select` already IS the comp (bg-tertiary glass at 16px
 * radius, `gap-3` rows, an fg-brand check on the selected row).
 *
 * Two things the old modal got wrong:
 *  - A `chainIds` of one renders a plain, non-interactive pill. A module that
 *    runs on a single chain has nothing to offer.
 *  - The trigger names the chain the PRODUCT is on, not the wallet's. The two
 *    differ while a switch is in flight or after one was declined, and the old
 *    pill named the wallet's chain — on a page that cannot use it.
 *
 * Safe wallets get the static pill too: a Safe's chain is fixed by the Safe
 * app it runs inside, so there is nothing this control could do.
 *
 * `onSelect` is the only half that varies by mount point — see `NetworkSelect`
 * (which mirrors the choice into the `network=` param) and `ModalNetworkSelect`
 * (which cannot, and doesn't need to).
 */
function NetworkSelectView({
  chainIds,
  onSelect,
  showLabel = true,
  labelClassName,
  triggerClassName,
  showDropdownIcon = true,
  size = 'm',
  dataTestId = 'network-select',
  disabled = false,
  children
}: NetworkSelectProps & { onSelect: (chainId: number) => void }) {
  const walletChainId = useChainId();
  const chains = useChains();
  const isSafeWallet = useIsSafeWallet();

  // The chain this surface is showing: the wallet's when the product runs
  // there, else the product's own first chain.
  const activeChainId = chainIds.includes(walletChainId) ? walletChainId : (chainIds[0] ?? walletChainId);
  const activeChainName = chains.find(chain => chain.id === activeChainId)?.name ?? 'Ethereum';

  const isStatic = disabled || isSafeWallet || chainIds.length <= 1;

  // A custom trigger body brings its own looks, so the trigger gets out of its
  // way entirely: no pill recipe, and none of SelectTrigger's own layout.
  //
  // The `[&>span]` pair is the load-bearing half, and both halves are needed:
  // the base recipe's `line-clamp-1` puts `display: -webkit-box` on the child,
  // which beats the row's own `flex` on specificity and drops its trailing
  // chevron onto a second line — and `line-clamp-none` alone only trades that
  // for `display: block`. Flex has to be re-asserted from out here, which is
  // the same fix FilterSelect carries for the same reason.
  const triggerClasses = children
    ? cn(
        'block h-auto w-full rounded-none border-0 bg-transparent p-0',
        '[&>span]:line-clamp-none [&>span]:flex',
        triggerClassName
      )
    : cn(
        buttonVariants({ variant: 'dropdown', size: size === 'xs' ? 'dropdownXs' : 'dropdownM' }),
        'h-auto w-auto bg-transparent',
        triggerClassName
      );

  const pillContent = (
    <>
      {getChainIcon(activeChainId, size === 'xs' ? 'h-4 w-4' : 'h-6 w-6')}
      {/* Label 5 in every dropdown comp (Figma 1030:60397, 1030:59254) — which
          is what dropdownM already sets, so the label is a bare span and
          inherits it. A <Text> here would re-declare Graphik at 16px and win,
          which is how the network pill drifted off the comps across all
          products. XS steps down to Label 6 (Figma 1030:138802). */}
      {showLabel && (
        <span
          className={cn(
            'text-text',
            size === 'xs' && 'text-xs leading-[14px] tracking-[-0.24px]',
            labelClassName
          )}
        >
          {activeChainName}
        </span>
      )}
      {showDropdownIcon && !isStatic && (
        <ChevronDown
          className={cn(
            'transition-transform group-data-[state=open]:rotate-180',
            size === 'xs' ? 'size-3' : 'size-4'
          )}
        />
      )}
    </>
  );

  if (isStatic) {
    // A span, not a disabled button: there is no action here, so nothing
    // should take focus or announce itself as a control. It keeps the pill's
    // geometry by wearing the same recipe, minus the interactive states.
    return children ? (
      // `contents` so the wrapper contributes no box of its own — a custom
      // trigger body brings its own layout (Convert's full-width row), which an
      // inline span around it would break.
      <span className="contents" data-testid={dataTestId}>
        {children}
      </span>
    ) : (
      <span
        className={cn(triggerClasses, 'hover:border-glassBorder cursor-default hover:bg-transparent')}
        data-testid={dataTestId}
      >
        {pillContent}
      </span>
    );
  }

  return (
    <Select value={String(activeChainId)} onValueChange={value => onSelect(Number(value))}>
      {/* hideIcon: the pill draws its own chevron (above), so it can sit
          inside the pill, flip with the panel and take the per-size geometry —
          and stay the trigger's last child, which is what callers target to
          push it to the right edge of a full-width row. */}
      <SelectTrigger
        hideIcon
        data-testid={dataTestId}
        aria-label={activeChainName}
        className={cn(triggerClasses, 'group')}
      >
        {children ?? pillContent}
      </SelectTrigger>
      {/* A full-width row trigger must not stretch the panel across the card. */}
      <SelectContent matchTriggerWidth={!children}>
        {chainIds.map(id => (
          <SelectItem key={id} value={String(id)}>
            <span className="flex items-center gap-3">
              {getChainIcon(id, 'h-6 w-6 shrink-0')}
              {chains.find(chain => chain.id === id)?.name ?? `Chain ${id}`}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The page-level control: switching also mirrors the new chain into the
 * `network=` search param (and, with `nextIntent`, moves to the module that
 * chain choice implies).
 */
export function NetworkSelect({
  nextIntent,
  ...props
}: NetworkSelectProps & {
  /** Route to move to alongside the switch (the module a chain choice implies). */
  nextIntent?: Intent;
}) {
  const chains = useChains();
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const { handleSwitchChain } = useChainModalContext();

  const onSelect = useCallback(
    (nextChainId: number) => {
      handleSwitchChain({
        chainId: nextChainId,
        onSuccess: (_, { chainId: newChainId }) => {
          const newChainName = chains.find(c => c.id === newChainId)?.name;
          if (!newChainName) return;
          const normalizedNewChainName = normalizeUrlParam(newChainName);
          const currentNetwork = searchParams.get(QueryParams.Network);
          // Only act if the network actually changed (compare normalized to
          // avoid case-only diffs).
          if (normalizeUrlParam(currentNetwork || '') === normalizedNewChainName) return;
          if (nextIntent) {
            void navigate({
              to: INTENT_PATHS[nextIntent],
              search: prev => ({
                ...keepSearch(prev),
                [QueryParams.Network]: normalizedNewChainName
              }),
              replace: true
            });
          } else {
            setSearchParams(
              (params: URLSearchParams) => {
                params.set(QueryParams.Network, normalizedNewChainName);
                return params;
              },
              { replace: true }
            );
          }
        }
      });
    },
    [handleSwitchChain, chains, searchParams, nextIntent, navigate, setSearchParams]
  );

  return <NetworkSelectView {...props} onSelect={onSelect} />;
}

/**
 * The transaction-modal control. Identical, minus the search-param mirroring —
 * and that omission is load-bearing, not a simplification.
 *
 * `TransactionProvider` wraps `RouterProvider` (pages/App.tsx), so a modal body
 * renders ABOVE the router and has no router context: calling `useNavigate` or
 * `useAppSearchParams` from here throws, the error boundary catches it, and the
 * page appears to re-render instead of the modal opening.
 *
 * Nothing is lost. `useAppOrchestration` listens to the connector's own
 * `change` event and mirrors whatever chain the wallet lands on into `network=`
 * — including a switch made from in here.
 */
export function ModalNetworkSelect(props: NetworkSelectProps) {
  const { handleSwitchChain } = useChainModalContext();
  const onSelect = useCallback((chainId: number) => handleSwitchChain({ chainId }), [handleSwitchChain]);
  return <NetworkSelectView {...props} onSelect={onSelect} />;
}
