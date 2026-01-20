import React, { useState, useEffect, forwardRef } from 'react';
import { ExpertIntent, Intent } from '@/lib/enums';
import { TradeDetails } from '@/modules/trade/components/TradeDetails';
import { UpgradeDetails } from '@/modules/upgrade/components/UpgradeDetails';
import { SavingsDetails } from '@/modules/savings/components/SavingsDetails';
import { StUSDSDetails } from '@/modules/stusds/components/StUSDSDetails';
import { MorphoVaultDetails } from '@/modules/morpho/components/MorphoVaultDetails';
import { MORPHO_VAULTS } from '@/modules/morpho/constants';
import { QueryParams } from '@/lib/constants';
import { useChainId } from 'wagmi';
import { useSearchParams } from 'react-router-dom';
import { RewardsDetailsPane } from '@/modules/rewards/components/RewardsDetailsPane';
import { BalancesDetails } from '@/modules/balances/components/BalancesDetails';
import { ConnectCard } from '@/modules/layout/components/ConnectCard';
import { AnimatePresence, motion } from 'framer-motion';
import { easeOutExpo } from '@/modules/ui/animation/timingFunctions';
import { cardAnimations } from '@/modules/ui/animation/presets';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { FooterLinks } from '@/modules/layout/components/FooterLinks';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { StakeDetailsPane } from '@/modules/stake/components/StakeDetailsPane';
import { ExpertDetailsPane } from '@/modules/expert/components/ExpertDetailsPane';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { SealDetailsPane } from '@/modules/seal/components/SealDetailsPane';

type DetailsPaneProps = {
  intent: Intent;
};

// When using popLayout mode on AnimatePresence, any immediate child of AnimatePresence that's a custom component
// must be wrapped in `forwardRef`, forwarding the provided ref to the motion component that is being animated.
const MotionDetailsWrapper = forwardRef<
  React.ComponentRef<typeof motion.div>,
  React.ComponentPropsWithoutRef<typeof motion.div>
>((props, ref) => (
  <motion.div
    ref={ref}
    variants={cardAnimations}
    initial={AnimationLabels.initial}
    animate={AnimationLabels.animate}
    exit={AnimationLabels.exit}
    {...props}
  />
));

export const DetailsPane = ({ intent }: DetailsPaneProps) => {
  const defaultDetail = Intent.BALANCES_INTENT;
  const [intentState, setIntentState] = useState<Intent>(intent || defaultDetail);
  const [keys, setKeys] = useState([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { bpi } = useBreakpointIndex();
  const { selectedExpertOption } = useConfigContext();
  const chainId = useChainId();
  const [searchParams] = useSearchParams();

  // Get the selected vault address from URL params (for multi-vault support)
  const selectedVaultAddress = searchParams.get(QueryParams.Vault) as `0x${string}` | null;

  // Find the selected vault config, default to first vault if not specified
  const selectedVault =
    MORPHO_VAULTS.find(v => v.vaultAddress[chainId]?.toLowerCase() === selectedVaultAddress?.toLowerCase()) ||
    MORPHO_VAULTS[0];

  useEffect(() => {
    setIntentState(prevIntentState => {
      if (prevIntentState !== intent) {
        // By giving the keys a new value, we force the motion component to animate the new component in, even if it's
        // the same component as before. This prevents the component from being re-added before being removed
        setKeys(prevKeys => prevKeys.map(key => key + 8));
      }

      return intent || defaultDetail;
    });
  }, [intent]);

  return (
    // The remaining padding in the right is added by the scrollbar
    // `details-pane` class is used by the AppContainer component to make the container full width if the details pane is visible
    <motion.div
      className="scrollbar-thin-always details-pane bg-panel flex w-full flex-col gap-4 p-3 group-has-[.chat-pane]:w-[calc(100%-764px)] md:overflow-auto md:rounded-3xl md:p-6 md:pr-3.5 xl:p-8 xl:pr-[22px]"
      layout
      key="details-pane"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ layout: { duration: 0 }, opacity: { duration: 0.5, ease: easeOutExpo } }}
    >
      {intentState !== Intent.BALANCES_INTENT && !isConnectedAndAcceptedTerms && (
        <ConnectCard intent={intent} />
      )}
      <AnimatePresence mode="popLayout">
        {(() => {
          switch (intentState) {
            case Intent.TRADE_INTENT:
              return (
                <MotionDetailsWrapper key={keys[0]}>
                  <TradeDetails />
                </MotionDetailsWrapper>
              );
            case Intent.UPGRADE_INTENT:
              return (
                <MotionDetailsWrapper key={keys[1]}>
                  <UpgradeDetails />
                </MotionDetailsWrapper>
              );
            case Intent.REWARDS_INTENT:
              return (
                <MotionDetailsWrapper key={keys[2]}>
                  <RewardsDetailsPane />
                </MotionDetailsWrapper>
              );
            case Intent.SAVINGS_INTENT:
              return (
                <MotionDetailsWrapper key={keys[3]}>
                  <SavingsDetails />
                </MotionDetailsWrapper>
              );
            case Intent.STAKE_INTENT:
              return (
                <MotionDetailsWrapper key={keys[4]}>
                  <StakeDetailsPane />
                </MotionDetailsWrapper>
              );
            case Intent.EXPERT_INTENT:
              // Switch for the multiple expert options
              switch (selectedExpertOption) {
                case ExpertIntent.STUSDS_INTENT:
                  return (
                    <MotionDetailsWrapper key={keys[5]}>
                      <StUSDSDetails />
                    </MotionDetailsWrapper>
                  );
                case ExpertIntent.MORPHO_VAULT_INTENT:
                  return (
                    <MotionDetailsWrapper key={keys[9]}>
                      <MorphoVaultDetails
                        vaultAddress={selectedVault.vaultAddress[chainId]}
                        assetToken={selectedVault.assetToken}
                        vaultName={selectedVault.name}
                      />
                    </MotionDetailsWrapper>
                  );
                default:
                  return (
                    <MotionDetailsWrapper key={keys[6]}>
                      <ExpertDetailsPane />
                    </MotionDetailsWrapper>
                  );
              }
            case Intent.SEAL_INTENT:
              return (
                <MotionDetailsWrapper key={keys[7]}>
                  <SealDetailsPane />
                </MotionDetailsWrapper>
              );
            case Intent.BALANCES_INTENT:
            default:
              return (
                <MotionDetailsWrapper key={keys[8]}>
                  <BalancesDetails />
                </MotionDetailsWrapper>
              );
          }
        })()}
      </AnimatePresence>
      {bpi < BP.md && <FooterLinks />}
    </motion.div>
  );
};
