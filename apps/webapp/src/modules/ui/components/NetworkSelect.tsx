import { useCallback } from 'react';
import { useChains } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { getChainIcon } from '@/utils';
import { useAppChainId, useIsSafeWallet } from '@/hooks';
import { useChainModalContext } from '@/modules/ui/context/ChainModalContext';

type NetworkSelectProps = {
  /** The chains this surface may switch between — the product's supported set. */
  chainIds: number[];
  /** Extra classes on the chain-name label, e.g. to hide it per tier. */
  labelClassName?: string;
  /** Extra classes on the trigger, e.g. `w-full justify-between` for a full-width row. */
  triggerClassName?: string;
  /** DS Button / Dropdown recipe: Network M (24px icon) or Network XS (16px icon). */
  size?: 'm' | 'xs';
  dataTestId?: string;
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
 */
function NetworkSelectView({
  chainIds,
  onSelect,
  labelClassName,
  triggerClassName,
  size = 'm',
  dataTestId = 'network-select',
  children
}: NetworkSelectProps & { onSelect: (chainId: number) => void }) {
  // The wallet's chain, not wagmi's pinned one: a wallet parked on a chain the
  // app doesn't configure leaves `useChainId()` naming the last configured
  // chain, which would read here as "the product's chain is the wallet's" and
  // make the dropdown inert (see below). Same derivation the transaction
  // guard uses.
  const walletChainId = useAppChainId();
  const chains = useChains();
  const isSafeWallet = useIsSafeWallet();

  // The chain this surface is showing: the wallet's when the product runs
  // there, else the product's own first chain.
  const onProductChain = chainIds.includes(walletChainId);
  const activeChainId = onProductChain ? walletChainId : (chainIds[0] ?? walletChainId);
  const activeChainName = chains.find(chain => chain.id === activeChainId)?.name ?? 'Ethereum';
  // Radix swallows a pick of the already-selected value. When the wallet is
  // OFF the product's chains the pill shows the product's first chain, but
  // nothing is selected — so picking that chain still asks the wallet for it.
  // That is the escape hatch after a declined automatic switch.
  const selectValue = onProductChain ? String(walletChainId) : '';

  const isStatic = isSafeWallet || chainIds.length <= 1;

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
      <span
        className={cn(
          'text-text',
          size === 'xs' && 'text-xs leading-[14px] tracking-[-0.24px]',
          labelClassName
        )}
      >
        {activeChainName}
      </span>
      {!isStatic && (
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
      // A block that spans the row, so the custom trigger body (Convert's
      // full-width row) keeps its layout AND the wrapper has a box of its own —
      // a `display: contents` wrapper has none, and an e2e visibility check on
      // the testid would fail on any config where the product is single-chain.
      <span className="block w-full" data-testid={dataTestId}>
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
    <Select value={selectValue} onValueChange={value => onSelect(Number(value))}>
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
      {/* A full-width row trigger must not stretch the panel across the card,
          and the panel hangs from the end of it — that is where the row's
          chevron sits, so it is the edge the affordance points from. A pill
          trigger is narrow enough that either edge reads the same, and keeps
          the default start alignment. */}
      <SelectContent matchTriggerWidth={!children} align={children ? 'end' : 'start'}>
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
 * Selecting a network does one thing: ask the wallet to switch.
 *
 * It deliberately does NOT touch the router. The chain lives in the wallet and
 * nothing in the URL mirrors it any more (`?network=` is retired as app state);
 * every surface reads the chain straight from wagmi once the switch lands.
 *
 * Staying router-free is also what lets this render inside a transaction modal.
 * `TransactionProvider` wraps `RouterProvider` (pages/App.tsx), so a modal body
 * sits ABOVE the router: a `useNavigate` / `useAppSearchParams` call from in
 * there throws, the error boundary swallows it, and the modal never appears —
 * the page just seems to re-render.
 */
export function NetworkSelect(props: NetworkSelectProps) {
  // The shared switch: wagmi's `switchChain` plus this app's analytics and its
  // rejected/unsupported-chain toasts.
  const { handleSwitchChain } = useChainModalContext();
  const onSelect = useCallback((chainId: number) => handleSwitchChain({ chainId }), [handleSwitchChain]);
  return <NetworkSelectView {...props} onSelect={onSelect} />;
}
