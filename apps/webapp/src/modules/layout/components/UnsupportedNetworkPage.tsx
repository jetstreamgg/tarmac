import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { UnsupportedNetwork } from '@/modules/icons/UnsupportedNetwork';
import { useChains, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';

export const UnsupportedNetworkPage = ({ children }: { children: React.ReactNode }) => {
  const chains = useChains();
  const { switchChain } = useSwitchChain();
  const [, setSearchParams] = useSearchParams();

  const handleSwitchChain = (chainId: number, name: string) => {
    setSearchParams(params => {
      params.set(QueryParams.Network, normalizeUrlParam(name));
      return params;
    });
    switchChain({ chainId });
  };

  return (
    <>
      <Dialog open={true} modal={true}>
        <DialogContent
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
