import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useChainId, useChains, useClient } from 'wagmi';
import { MainnetChain, BaseChain, ArbitrumChain, Close, OptimismChain, UnichainChain } from '@/modules/icons';
import { cn } from '@/lib/utils';
import { base, arbitrum, optimism, unichain } from 'viem/chains';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Intent } from '@/lib/enums';
import { useChainModalContext } from '@/modules/ui/context/ChainModalContext';
import { useNavigate } from '@tanstack/react-router';
import { INTENT_PATHS, keepSearch, useAppSearchParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useIsSafeWallet } from '@/hooks';
import { Trans } from '@lingui/react/macro';

enum ChainModalVariant {
  default = 'default',
  widget = 'widget',
  wrapper = 'wrapper'
}

//TODO: handle optimism and unichain
const getChainIcon = (chainId: number, className?: string) =>
  base.id === chainId ? (
    <BaseChain className={className} />
  ) : arbitrum.id === chainId ? (
    <ArbitrumChain className={className} />
  ) : chainId === optimism.id ? (
    <OptimismChain className={className} />
  ) : chainId === unichain.id ? (
    <UnichainChain className={className} />
  ) : (
    <MainnetChain className={className} />
  );

export function ChainModal({
  showLabel = true,
  labelClassName,
  triggerClassName,
  showDropdownIcon = true,
  variant = 'default',
  size = 'm',
  dataTestId = 'chain-modal-trigger',
  children,
  nextIntent,
  disabled = false,
  chainIds
}: {
  showLabel?: boolean;
  /** Extra classes on the chain-name label, e.g. to hide it per tier. */
  labelClassName?: string;
  /** Extra classes on the trigger button, e.g. `w-full justify-between` for the M6.3 full-width row. */
  triggerClassName?: string;
  showDropdownIcon?: boolean;
  variant?: 'default' | 'widget' | 'wrapper';
  /** DS Button / Dropdown recipe: Network M (24px icon) or Network XS (16px icon). */
  size?: 'm' | 'xs';
  dataTestId?: string;
  children?: React.ReactNode;
  nextIntent?: Intent;
  disabled?: boolean;
  /** Restrict the switchable network list to these chain ids (per-product scoping). */
  chainIds?: number[];
}) {
  const [open, setOpen] = useState(false);
  const chainId = useChainId();
  const client = useClient();
  const chains = useChains();
  const isSafeWallet = useIsSafeWallet();
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const {
    handleSwitchChain,
    isPending: isSwitchChainPending,
    variables: switchChainVariables
  } = useChainModalContext();

  const isWidget = variant === ChainModalVariant.widget;

  // The chains this trigger could actually switch between — the same filter the
  // dialog list below applies.
  const selectableChains = chains.filter(chain => (chainIds ? chainIds.includes(chain.id) : true));
  // Single-chain products (stake, rewards, the vaults, stUSDS, fixed yield — all
  // mainnet-only) have nowhere to switch to, so the pill is a label rather than a
  // control: no chevron, no dialog, nothing to click or focus. It stays a live
  // dropdown wherever a second chain is configured, which includes every one of
  // those products in dev — the Tenderly fork joins the mainnet family there
  // (CHAIN_WIDGET_MAP), so the fork is still reachable from the product page.
  const isSingleChain = selectableChains.length <= 1;

  // Non-widget trigger = design-system Button / Dropdown, Network M (Figma
  // 5019:4105): 24px chain icon, 16px chevron that flips while open (Radix
  // DialogTrigger supplies data-state). The widget look keeps its legacy
  // recipe untouched — connectPrimary is just the text-color base; the
  // className below overrides every gradient/border stop it sets.
  const triggerVariant = isWidget ? 'connectPrimary' : 'dropdown';
  const triggerSize = isWidget ? 'default' : size === 'xs' ? 'dropdownXs' : 'dropdownM';
  const triggerClasses = cn(
    isWidget
      ? 'from-primary-start/100 to-primary-end/100 hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 flex items-center gap-1.5 border-transparent bg-radial-(--gradient-position) px-[9px] py-2 bg-blend-overlay hover:border-transparent hover:bg-white/10 focus:border-transparent focus:bg-white/15'
      : 'group',
    triggerClassName
  );

  const pill = (
    <>
      {getChainIcon(chainId, isWidget ? 'h-5 w-5' : size === 'xs' ? 'h-4 w-4' : 'h-6 w-6')}
      {showLabel &&
        (isWidget ? (
          <Text className={cn('text-text', labelClassName)}>{client?.chain.name || 'Ethereum'}</Text>
        ) : (
          // Label 5 / Circular Medium in every dropdown comp (Figma
          // 1030:60397, 1030:59254) — which is what dropdownM already
          // sets, so the label is a bare span and inherits it. A <Text>
          // here would re-declare Graphik at 16px and win, which is how
          // the network pill drifted off the comps across all products.
          // XS steps down to Label 6 (Figma 1030:138802).
          <span
            className={cn(
              'text-text',
              size === 'xs' && 'text-xs leading-[14px] tracking-[-0.24px]',
              labelClassName
            )}
          >
            {client?.chain.name || 'Ethereum'}
          </span>
        ))}
    </>
  );

  if (isSingleChain) {
    // `pointer-events-none` is what makes the static pill inert: it also keeps
    // the dropdown recipe's hover states (fill + border) from firing on what is
    // now a plain label. The testid stays put — e2e asserts the pill is on the page.
    return variant === ChainModalVariant.wrapper ? (
      <div className="h-full w-full" data-testid={dataTestId}>
        {children}
      </div>
    ) : (
      <div
        className={buttonVariants({
          variant: triggerVariant,
          size: triggerSize,
          className: cn('pointer-events-none', triggerClasses)
        })}
        data-testid={dataTestId}
      >
        {pill}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={disabled ? undefined : setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {variant === ChainModalVariant.wrapper ? (
          // The testid must render on the wrapper too — e2e drives the network
          // dialog through it (e.g. `convert-network`).
          <button className="h-full w-full" data-testid={dataTestId}>
            {children}
          </button>
        ) : (
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClasses}
            data-testid={dataTestId}
          >
            {pill}
            {showDropdownIcon &&
              (isWidget ? (
                <ChevronDown width={14} height={14} />
              ) : (
                <ChevronDown
                  className={cn(
                    'transition-transform group-data-[state=open]:rotate-180',
                    size === 'xs' ? 'size-3' : 'size-4'
                  )}
                />
              ))}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className={cn('bg-containerDark p-4 sm:min-w-[400px] sm:p-4', isSafeWallet && 'sm:max-w-[400px]')}
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <DialogTitle>
          <Text className="text-text pl-2 text-[28px] md:text-[32px]">{t`Switch network`}</Text>
        </DialogTitle>
        <div className="flex flex-col items-start gap-1">
          {isSafeWallet && (
            <div className="my-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <Text className="text-text text-sm">
                <Trans>
                  Network switching is managed by your Safe app. Switch networks there, then visit this app
                  again from the Safe apps menu.
                </Trans>
              </Text>
            </div>
          )}
          {chains
            .filter(chain => (chainIds ? chainIds.includes(chain.id) : true))
            .filter(chain => (isSafeWallet ? chain.id === chainId : true))
            .map(chain => (
              <Button
                key={chain.id}
                disabled={isSafeWallet}
                onClick={() => {
                  // Skip if chain is already selected
                  if (chain.id === chainId) return;

                  handleSwitchChain({
                    chainId: chain.id,
                    onSuccess: (_, { chainId: newChainId }) => {
                      const newChainName = chains.find(c => c.id === newChainId)?.name;
                      if (newChainName) {
                        const normalizedNewChainName = normalizeUrlParam(newChainName);
                        const currentNetwork = searchParams.get(QueryParams.Network);
                        // Only update if the network actually changed (compare normalized to avoid case-only diffs)
                        if (normalizeUrlParam(currentNetwork || '') !== normalizedNewChainName) {
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
                      }
                    },
                    onSettled: () => setOpen(false)
                  });
                }}
                className={cn(
                  'flex w-full justify-between p-1.5',
                  chainId === chain.id &&
                    'from-primary-start/100 to-primary-end/100 bg-radial-(--gradient-position)'
                )}
                variant={chainId === chain.id ? 'default' : 'ghost'}
              >
                <div className="flex items-center gap-3">
                  {getChainIcon(chain.id)}
                  <Text className={cn('text-text text-left')}>{chain.name}</Text>
                </div>
                {chainId === chain.id && (
                  <div className="mr-1.5 flex items-center gap-2">
                    <Text variant="medium">Connected</Text>
                    <div className="bg-bullish h-2 w-2 rounded-full" />
                  </div>
                )}
                {isSwitchChainPending && switchChainVariables?.chainId === chain.id && (
                  <div className="mr-1.5 flex items-center gap-2">
                    <Text variant="medium">Confirm in your wallet</Text>
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  </div>
                )}
              </Button>
            ))}
        </div>
        <DialogClose asChild>
          <Button
            variant="outline"
            className="text-text absolute top-4 right-4 h-8 w-8 rounded-full p-0"
            data-testid="chain-modal-close"
          >
            <Close />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
