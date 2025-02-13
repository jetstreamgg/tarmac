import { type GetBalanceData } from 'wagmi/query';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VStack } from '@/shared/components/ui/layout/VStack';
import { TokenBalances } from './TokenBalances';
import { BalancesHistory } from './BalancesHistory';
import { BalancesTabsList } from './BalancesTabsList';
import { ModulesBalances } from './ModulesBalances';
import { motion } from 'framer-motion';
import { positionAnimations } from '@/shared/animation/presets';
import { BalancesWidgetState } from '@/shared/types/widgetState';
import { TokenForChain } from '@jetstreamgg/hooks';
import { Heading } from '@/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { BalancesFlow } from '../constants';

export interface TokenBalanceResponse extends GetBalanceData {
  tokenAddress?: string;
  formatted: string;
}

interface BalancesContentProps {
  validatedExternalState?: BalancesWidgetState;
  customTokenList?: TokenForChain[];
  hideModuleBalances?: boolean;
  tabIndex: 0 | 1;
  actionForToken?: (
    symbol: string,
    balance: string
  ) => { label: string; actionUrl: string; image: string } | undefined;
  onClickRewardsCard?: () => void;
  onClickSavingsCard?: () => void;
  onClickSealCard?: () => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onToggle: (number: 0 | 1) => void;
}

export const BalancesContent = ({
  customTokenList,
  hideModuleBalances,
  actionForToken,
  onClickRewardsCard,
  onClickSavingsCard,
  onClickSealCard,
  onExternalLinkClicked,
  onToggle,
  tabIndex
}: BalancesContentProps): React.ReactElement => {
  return (
    <Tabs value={tabIndex === 1 ? BalancesFlow.TX_HISTORY : BalancesFlow.FUNDS} className="w-full">
      <BalancesTabsList onToggle={onToggle} />
      <TabsContent value={BalancesFlow.FUNDS} className="mt-0">
        <VStack className="items-stretch pt-4">
          <motion.div variants={positionAnimations}>
            <Heading variant="small" className="mb-3 leading-6">
              <Trans>Supplied Funds</Trans>
            </Heading>
            <ModulesBalances
              onClickRewardsCard={onClickRewardsCard}
              onClickSavingsCard={onClickSavingsCard}
              onClickSealCard={onClickSealCard}
              onExternalLinkClicked={onExternalLinkClicked}
              hideModuleBalances={hideModuleBalances}
            />
          </motion.div>

          <motion.div variants={positionAnimations}>
            <Heading variant="small" className="mb-3 leading-6">
              <Trans>Wallet Funds</Trans>
            </Heading>
            <TokenBalances actionForToken={actionForToken} customTokenList={customTokenList} />
          </motion.div>
        </VStack>
      </TabsContent>
      <TabsContent value={BalancesFlow.TX_HISTORY} className="mt-0">
        <motion.div variants={positionAnimations}>
          <BalancesHistory onExternalLinkClicked={onExternalLinkClicked} />
        </motion.div>
      </TabsContent>
    </Tabs>
  );
};
