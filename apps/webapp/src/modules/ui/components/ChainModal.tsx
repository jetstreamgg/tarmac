import { Button } from '@/components/ui/button';
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
import { useSearchParams } from 'react-router-dom';
import { mapIntentToQueryParam, QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';
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
  showDropdownIcon = true,
  variant = 'default',
  dataTestId = 'chain-modal-trigger',
  children,
  nextIntent,
  disabled = false
}: {
  showLabel?: boolean;
  showDropdownIcon?: boolean;
  variant?: 'default' | 'widget' | 'wrapper';
  dataTestId?: string;
  children?: React.ReactNode;
  nextIntent?: Intent;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const chainId = useChainId();
  const client = useClient();
  const chains = useChains();
  const isSafeWallet = useIsSafeWallet();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    handleSwitchChain,
    isPending: isSwitchChainPending,
    variables: switchChainVariables
  } = useChainModalContext();

  return (
    <Dialog open={open} onOpenChange={disabled ? undefined : setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {variant === ChainModalVariant.wrapper ? (
          <button className="h-full w-full">{children}</button>
        ) : (
          <Button
            variant="connect"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2',
              variant === ChainModalVariant.widget &&
                'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100 hover:from-primary-start/100 hover:to-primary-end/100 focus:from-primary-start/100 focus:to-primary-end/100 border-transparent px-[9px] bg-blend-overlay hover:border-transparent hover:bg-white/10 focus:border-transparent focus:bg-white/15'
            )}
            data-testid={dataTestId}
          >
            {getChainIcon(chainId, variant === ChainModalVariant.widget ? 'h-5 w-5' : 'h-6 w-6')}
            {showLabel && <Text className="text-text">{client?.chain.name || 'Ethereum'}</Text>}
            {showDropdownIcon && <ChevronDown width={14} height={14} />}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
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
                      // Rule 1: Manual network changes always win
                      // Don't clear origin on manual switch - user's choice takes precedence
                      // Origin will only be cleared when it's used for auto-return

                      const newChainName = chains.find(c => c.id === newChainId)?.name;
                      if (newChainName) {
                        const normalizedNewChainName = normalizeUrlParam(newChainName);
                        const currentNetwork = searchParams.get(QueryParams.Network);
                        // Only update if the network actually changed
                        if (currentNetwork !== normalizedNewChainName) {
                          setSearchParams(
                            (params: URLSearchParams) => {
                              if (currentNetwork !== normalizedNewChainName) {
                                params.set(QueryParams.Network, normalizedNewChainName);
                              }
                              if (nextIntent) {
                                params.set(QueryParams.Widget, mapIntentToQueryParam(nextIntent));
                              }
                              return params;
                            },
                            { replace: true }
                          );
                        }
                      }
                    },
                    onSettled: () => setOpen(false)
                  });
                }}
                className={cn(
                  'flex w-full justify-between p-1.5',
                  chainId === chain.id &&
                    'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100'
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
            className="text-text absolute right-4 top-4 h-8 w-8 rounded-full p-0"
            data-testid="chain-modal-close"
          >
            <Close />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
