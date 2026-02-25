import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { ModulesBalances } from './ModulesBalances';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { BalancesFilter } from './BalancesFilter';
import { useCallback, useState } from 'react';
import { useChainId } from 'wagmi';

interface BalancesContentProps {
  hideModuleBalances?: boolean;
  chainIds?: number[];
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  stakeCardUrl?: string;
  stusdsCardUrl?: string;
  morphoCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  showAllNetworks?: boolean;
  hideZeroBalances?: boolean;
  setShowAllNetworks?: (showAllNetworks: boolean) => void;
  setHideZeroBalances?: (hideZeroBalances: boolean) => void;
  onAllFundsEmpty?: (isEmpty: boolean) => void;
}

export const BalancesContent = ({
  hideModuleBalances,
  onExternalLinkClicked,
  chainIds,
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  stakeCardUrl,
  stusdsCardUrl,
  morphoCardUrl,
  showAllNetworks: showAllNetworksProp,
  hideZeroBalances: hideZeroBalancesProp,
  setShowAllNetworks: setShowAllNetworksProp,
  setHideZeroBalances: setHideZeroBalancesProp,
  onAllFundsEmpty
}: BalancesContentProps): React.ReactElement => {
  const [showAllNetworksInternal, setShowAllNetworksInternal] = useState(true);
  const [hideZeroBalancesInternal, setHideZeroBalancesInternal] = useState(true);
  const [allFundsEmpty, setAllFundsEmpty] = useState(false);

  const handleAllFundsEmpty = useCallback(
    (isEmpty: boolean) => {
      setAllFundsEmpty(isEmpty);
      onAllFundsEmpty?.(isEmpty);
    },
    [onAllFundsEmpty]
  );

  const showAllNetworks = showAllNetworksProp ?? showAllNetworksInternal;
  const hideZeroBalances = hideZeroBalancesProp ?? hideZeroBalancesInternal;
  const setShowAllNetworks = setShowAllNetworksProp ?? setShowAllNetworksInternal;
  const setHideZeroBalances = setHideZeroBalancesProp ?? setHideZeroBalancesInternal;

  const chainId = useChainId();

  return (
    <VStack className="items-stretch">
      <motion.div variants={positionAnimations}>
        {!allFundsEmpty && (
          <>
            <BalancesFilter
              showBalanceFilter={true}
              showAllNetworks={showAllNetworks}
              hideZeroBalances={hideZeroBalances}
              setShowAllNetworks={setShowAllNetworks}
              setHideZeroBalances={setHideZeroBalances}
              chainId={chainId}
            />
            {!hideModuleBalances && (
              <Heading variant="small" className="mb-3 leading-6">
                <Trans>Supplied funds</Trans>
              </Heading>
            )}
          </>
        )}
        <ModulesBalances
          hideModuleBalances={hideModuleBalances}
          rewardsCardUrl={rewardsCardUrl}
          savingsCardUrlMap={savingsCardUrlMap}
          sealCardUrl={sealCardUrl}
          stakeCardUrl={stakeCardUrl}
          stusdsCardUrl={stusdsCardUrl}
          morphoCardUrl={morphoCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          chainIds={chainIds}
          hideZeroBalances={hideZeroBalances}
          showAllNetworks={showAllNetworks}
          onAllFundsEmpty={handleAllFundsEmpty}
        />
      </motion.div>
    </VStack>
  );
};
