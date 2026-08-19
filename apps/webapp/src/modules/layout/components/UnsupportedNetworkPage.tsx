import { useEffect, useRef } from 'react';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { UnsupportedNetwork } from '@/modules/icons/UnsupportedNetwork';
import { useChains, useConnection, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useAppSearchParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';

export const UnsupportedNetworkPage = ({ children }: { children: React.ReactNode }) => {
  const chains = useChains();
  const { switchChain } = useSwitchChain();
  const [, setSearchParams] = useAppSearchParams();
  const { chainId: walletChainId } = useConnection();
  const { trackUnsupportedNetworkShown, trackNetworkSwitchRequested, trackNetworkSwitchCompleted } =
    useAppAnalytics();

  // Full-page block, recorded as a plain pageview until now (APP-444 D-4).
  const shownTracked = useRef(false);
  useEffect(() => {
    if (shownTracked.current) return;
    shownTracked.current = true;
    trackUnsupportedNetworkShown({ walletChainId });
  }, [trackUnsupportedNetworkShown, walletChainId]);

  const handleSwitchChain = (chainId: number, name: string) => {
    // The wallet sits on an off-config chain, so wagmi's fallback chainId is
    // not the real origin — report the wallet's actual chain when known.
    const fromChainId = walletChainId ?? -1;
    trackNetworkSwitchRequested({ source: 'unsupported_network_page', fromChainId, toChainId: chainId });
    setSearchParams(params => {
      params.set(QueryParams.Network, normalizeUrlParam(name));
      return params;
    });
    switchChain(
      { chainId },
      {
        onSuccess: () =>
          trackNetworkSwitchCompleted({
            source: 'unsupported_network_page',
            fromChainId,
            toChainId: chainId,
            status: 'success'
          }),
        onError: error =>
          trackNetworkSwitchCompleted({
            source: 'unsupported_network_page',
            fromChainId,
            toChainId: chainId,
            status: isUserRejectedRequestError(error) ? 'rejected' : 'error'
          })
      }
    );
  };

  return (
    <>
      <Dialog open={true} modal={true}>
        <DialogContent
          aria-describedby={undefined}
          className="bg-containerDark max-w-[640px] p-10"
          onOpenAutoFocus={e => e.preventDefault()} //don't automatically focus the first button
        >
          <div className="flex flex-col gap-5 sm:flex-row">
            <UnsupportedNetwork className="shrink-0" />
            <div>
              <DialogTitle className="text-text mb-2 text-[28px] md:-mt-2 md:text-[32px]">
                <Trans>Your wallet is connected to an unsupported network</Trans>
              </DialogTitle>
              <Text className="font-graphik text-text mb-10">
                <Trans>
                  Only Ethereum Mainnet and Base are supported at this time.
                  <br />
                  Please switch networks to continue.
                </Trans>
              </Text>
              <div className="flex flex-wrap gap-2">
                {/* This will display buttons for all supported networks for the current Wagmi config. */}
                {chains.map(({ name, id }) => (
                  <Button
                    variant="connectPrimary"
                    className="border-transparent hover:border-transparent focus:border-transparent"
                    key={id}
                    onClick={() => handleSwitchChain(id, name)}
                  >
                    Switch to {name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {children}
    </>
  );
};
