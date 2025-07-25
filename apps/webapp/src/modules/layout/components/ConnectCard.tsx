import { Heading, Text } from './Typography';
import { Button } from '@/components/ui/button';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { GradientShapeCard } from '@/modules/ui/components/GradientShapeCard';
import { Intent } from '@/lib/enums';
import { useChainId } from 'wagmi';
import { getChainSpecificText } from '@jetstreamgg/sky-utils';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

export function ConnectCard({ intent, className }: { intent: Intent; className?: string }) {
  const connect = useCustomConnectModal();
  const chainId = useChainId();

  const heading = {
    [Intent.BALANCES_INTENT]: t`About Balances`,
    [Intent.REWARDS_INTENT]: t`About Sky Token Rewards`,
    [Intent.SAVINGS_INTENT]: t`About the Sky Savings Rate`,
    [Intent.UPGRADE_INTENT]: t`Ready to upgrade and explore?`,
    [Intent.TRADE_INTENT]: t`About Trade`,
    [Intent.SEAL_INTENT]: t`About Seal Engine`,
    [Intent.STAKE_INTENT]: t`About the Staking Engine`
  };

  const contentText = {
    [Intent.BALANCES_INTENT]: getChainSpecificText(
      {
        allL2s: t`Balances displays all of your Sky-related assets available on the selected network for the Ethereum blockchain. When you connect your crypto wallet to Sky.money, you can view your tokens across supported networks on the decentralized Sky Protocol. This visibility is built in for ease of use. Sky.money is non-custodial and permissionless.`,
        default: t`Balances displays all of your Sky-related assets. When you connect your crypto wallet to Sky.money to access the decentralised Sky Protocol, only the tokens in the wallet that are relevant to the app are listed. With all of your Sky funds visible in one place, you can better self-manage your funds. Sky.money is non-custodial and permissionless.`
      },
      chainId
    ),
    [Intent.REWARDS_INTENT]: t`When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time. The USDS, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.`,
    [Intent.SAVINGS_INTENT]: getChainSpecificText(
      {
        default: (
          <Text variant="small" className="leading-[18px]">
            <Trans>
              When you supply USDS to the Sky Savings Rate module of the decentralized Sky Protocol, you
              access the Sky Savings Rate <PopoverInfo type="ssr" /> and may accumulate additional USDS over
              time. No minimum supply amount is required, and you always maintain control of your supplied
              assets, as this feature is non-custodial.
            </Trans>
          </Text>
        )
      },
      chainId
    ),
    [Intent.UPGRADE_INTENT]: t`Your DeFi journey with Sky is just beginning. Connect your wallet to access the decentralised Sky Protocol and upgrade your DAI to USDS, and your MKR to SKY. Unlocking all the Sky Protocol has to offer, without giving up control, is easy.`,
    [Intent.TRADE_INTENT]: getChainSpecificText(
      {
        allL2s: (
          <Text variant="small" className="leading-[18px]">
            <Trans>
              On Layer 2 (L2) scaling solutions for the Ethereum blockchain via Sky.money, you can convert
              between USDS, sUSDS and USDC through a Peg Stability Module (PSM) <PopoverInfo type="psm" />{' '}
              deployed to the L2. The PSM handles conversions programmatically, driven at your direction,
              between these pairs directly.
            </Trans>
          </Text>
        ),
        default: t`Directly trade eligible tokens for Sky ecosystem tokens using permissionless and non-custodial rails. With the Sky.money interface, you can access the decentralised Sky Protocol to trade, via smart contracts on the blockchain instead of relying on centralised entities.`
      },
      chainId
    ),
    [Intent.SEAL_INTENT]: t`The Seal Engine is a module of the Sky Protocol. The MKR and or SKY tokens you supply to the Seal Engine are sealed behind an exit fee in order to provide access to Seal Rewards and encourage a deeper commitment to Sky ecosystem governance. With Sky, you always remain in control of your funds.`,
    [Intent.STAKE_INTENT]: t`The Staking Engine is a module of the Sky Protocol. When you stake SKY tokens to the Staking Engine, you can access Staking Rewards and may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. With Sky, you always remain in control of your assets.`
  };

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(100% 177.78% at 100% 0%, #A273FF 0%, #4331E9 100%)"
      colorMiddle="radial-gradient(circle at 0% 100%, #FFCD6B 0%, #EB5EDF 150%)"
      colorRight="#2A197D"
      className={className}
    >
      <div className="w-[80%] space-y-2 lg:w-2/3" data-testid="connect-wallet-card">
        <Heading className="mb-2">{heading[intent]}</Heading>
        <Text variant="small" className="leading-[18px]">
          {contentText[intent]}
        </Text>
      </div>
      <Button
        className="border-border mt-3 w-fit px-6 py-6 lg:mt-0"
        variant="outline"
        onClick={connect}
        data-testid="connect-wallet-card-button"
      >
        <Trans>Connect wallet</Trans>
      </Button>
    </GradientShapeCard>
  );
}
