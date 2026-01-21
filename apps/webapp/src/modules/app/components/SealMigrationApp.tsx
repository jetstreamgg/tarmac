import { useEffect } from 'react';
import { DetailsPane } from './DetailsPane';
import { AppContainer } from './AppContainer';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { validateLinkedActionSearchParams, validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useConnection, useConnectionEffect, useChainId, useChains, useSwitchChain } from 'wagmi';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useSafeAppNotification } from '../hooks/useSafeAppNotification';
import { SealMigrationWidgetPane } from './SealMigrationWidgetPane';
import { isL2ChainId } from '@jetstreamgg/sky-utils';

export function SealMigrationApp() {
  const { bpi } = useBreakpointIndex();

  const chainId = useChainId();
  const chains = useChains();

  const { connector } = useConnection();
  useConnectionEffect({
    // Once the user connects their wallet, check if the network param is set and switch chains if necessary
    onConnect() {
      const parsedChainId = chains.find(chain => chain.name?.toLowerCase() === network?.toLowerCase())?.id;
      if (parsedChainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  });

  const { switchChain } = useSwitchChain({
    mutation: {
      onError: err => {
        // If the user rejects the network switch request, update the network query param to the current chain
        if (err.name === 'UserRejectedRequestError') {
          const chainName = chains.find(c => c.id === chainId)?.name;
          if (chainName) {
            setSearchParams(params => {
              params.set(QueryParams.Network, chainName.toLowerCase());
              return params;
            });
          }
        }
      }
    }
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const detailsParam = !(searchParams.get(QueryParams.Details) === 'false');
  const network = searchParams.get(QueryParams.Network) || undefined;

  const newChainId = network
    ? (chains.find(chain => chain.name?.toLowerCase() === network.toLowerCase())?.id ?? chainId)
    : chainId;

  // If the user is connected to a Safe Wallet using WalletConnect, notify they can use the Safe App
  useSafeAppNotification();

  // Run validation on search params whenever search params change
  useEffect(() => {
    setSearchParams(
      params => {
        // Runs initial validation for globally allowed params
        const validatedParams = validateSearchParams(
          params,
          [],
          'seal',
          () => {},
          newChainId,
          chains,
          () => {},
          false
        );
        // Runs second validation for linked-action-specific criteria
        const validatedLinkedActionParams = validateLinkedActionSearchParams(validatedParams);
        return validatedLinkedActionParams;
      },
      { replace: true }
    );
  }, [searchParams]);

  useEffect(() => {
    // If there's no network param, default to the current chain
    if (!network) {
      const chainName = chains.find(c => c.id === chainId)?.name;
      if (chainName)
        setSearchParams(params => {
          params.set(QueryParams.Network, chainName.toLowerCase());
          return params;
        });
    } else {
      // If the network param doesn't match the current chain, switch chains
      const parsedChainId = chains.find(chain => chain.name?.toLowerCase() === network?.toLowerCase())?.id;
      if (parsedChainId && parsedChainId !== chainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  }, [network]);

  useEffect(() => {
    // If the user changes the network in their wallet, update the `network` query param
    const handleChainChange = ({ chainId: newChainId }: { chainId?: number | undefined }) => {
      const newChainName = chains.find(c => c.id === newChainId)?.name;
      if (newChainName) {
        const isL2 = isL2ChainId(newChainId || 1);
        setSearchParams(params => {
          params.set(QueryParams.Network, newChainName.toLowerCase());
          if (isL2) {
            params.set(QueryParams.Details, 'false');
          }
          return params;
        });
      }
    };

    const emitter = connector?.emitter;
    emitter?.on('change', handleChainChange);

    // Cleanup function to remove the listener
    return () => {
      emitter?.off('change', handleChainChange);
    };
  }, [chains, connector, setSearchParams]);

  return (
    <AppContainer>
      <SealMigrationWidgetPane>
        {bpi === BP.sm && detailsParam && <DetailsPane intent={Intent.SEAL_INTENT} />}
      </SealMigrationWidgetPane>
      {bpi > BP.sm && detailsParam && <DetailsPane intent={Intent.SEAL_INTENT} />}
    </AppContainer>
  );
}
