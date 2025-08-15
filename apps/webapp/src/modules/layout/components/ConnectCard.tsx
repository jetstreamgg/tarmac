import { Heading, Text } from './Typography';
import { Button } from '@/components/ui/button';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { GradientShapeCard } from '@/modules/ui/components/GradientShapeCard';
import { Intent } from '@/lib/enums';
import { useChainId } from 'wagmi';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { getBannerById } from '@/data/banners/banners';

export function ConnectCard({ intent, className }: { intent: Intent; className?: string }) {
  const connect = useCustomConnectModal();
  const chainId = useChainId();

  // Map intents to banner IDs - all intents have a default, some have additional variants
  const bannerIdMap = {
    [Intent.BALANCES_INTENT]: { default: 'about-balances' },
    [Intent.REWARDS_INTENT]: { default: null }, // No banner for rewards, keep hardcoded
    [Intent.SAVINGS_INTENT]: { default: 'savings' },
    [Intent.UPGRADE_INTENT]: { default: null }, // No banner for upgrade, keep hardcoded
    [Intent.TRADE_INTENT]: { allL2s: 'trade-1', default: 'trade-2' },
    [Intent.SEAL_INTENT]: { default: 'about-the-seal-engine' },
    [Intent.STAKE_INTENT]: { default: 'about-the-staking-engine' }
  };

  // Helper function to get the appropriate banner based on context
  const getBannerForContext = (intentBannerMap: any) => {
    if (!intentBannerMap) return null;

    // Check if this is a simple string (backward compatibility)
    if (typeof intentBannerMap === 'string') {
      return getBannerById(intentBannerMap);
    }

    // For objects with multiple banner IDs
    // Check for L2-specific banner first if on L2
    if (intentBannerMap.allL2s && chainId && [8453, 42161, 10, 480].includes(chainId)) {
      const l2Banner = getBannerById(intentBannerMap.allL2s);
      if (l2Banner) return l2Banner;
    }

    // Fall back to default
    return intentBannerMap.default ? getBannerById(intentBannerMap.default) : null;
  };

  // Get banner content if available
  const bannerConfig = bannerIdMap[intent];
  const banner = getBannerForContext(bannerConfig);

  // Use banner title if available, otherwise fall back to hardcoded
  const heading =
    banner?.title ||
    {
      [Intent.BALANCES_INTENT]: t`About Balances`,
      [Intent.REWARDS_INTENT]: t`About Sky Token Rewards`,
      [Intent.SAVINGS_INTENT]: t`About the Sky Savings Rate`,
      [Intent.UPGRADE_INTENT]: t`Ready to upgrade and explore?`,
      [Intent.TRADE_INTENT]: t`About Trade`,
      [Intent.SEAL_INTENT]: t`About Seal Engine`,
      [Intent.STAKE_INTENT]: t`About the Staking Engine`
    }[intent];

  // For content, use banner description based on chain context
  // Keep special handling for intents with PopoverInfo
  const contentText = {
    [Intent.BALANCES_INTENT]:
      banner?.description ||
      t`Balances displays all of your Sky-related assets. When you connect your crypto wallet to Sky.money to access the decentralised Sky Protocol, only the tokens in the wallet that are relevant to the app are listed. With all of your Sky funds visible in one place, you can better self-manage your funds. Sky.money is non-custodial and permissionless.`,

    [Intent.REWARDS_INTENT]:
      banner?.description ||
      t`When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time. The USDS, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.`,

    [Intent.SAVINGS_INTENT]: banner?.description || (
      <Text variant="small" className="leading-[18px]">
        <Trans>
          When you supply USDS to the Sky Savings Rate module of the decentralized Sky Protocol, you access
          the Sky Savings Rate <PopoverInfo type="ssr" /> and may accumulate additional USDS over time. No
          minimum supply amount is required, and you always maintain control of your supplied assets, as this
          feature is non-custodial.
        </Trans>
      </Text>
    ),

    [Intent.UPGRADE_INTENT]:
      banner?.description ||
      t`Your DeFi journey with Sky is just beginning. Connect your wallet to access the decentralised Sky Protocol and upgrade your DAI to USDS, and your MKR to SKY. Unlocking all the Sky Protocol has to offer, without giving up control, is easy.`,

    [Intent.TRADE_INTENT]: (() => {
      // For trade, check if we need PopoverInfo for PSM
      if (banner?.description) {
        // Check if the banner description contains PSM reference that needs PopoverInfo
        if (banner.description.includes('[(PSM)]')) {
          return (
            <Text variant="small" className="leading-[18px]">
              <Trans>
                On Layer 2 (L2) scaling solutions for the Ethereum blockchain via Sky.money, you can convert
                between USDS, sUSDS and USDC through a Peg Stability Module (PSM) <PopoverInfo type="psm" />{' '}
                deployed to the L2. The PSM handles conversions programmatically, driven at your direction,
                between these pairs directly.
              </Trans>
            </Text>
          );
        }
        return banner.description;
      }
      // Fallback
      return t`Directly trade eligible tokens for Sky ecosystem tokens using permissionless and non-custodial rails. With the Sky.money interface, you can access the decentralised Sky Protocol to trade, via smart contracts on the blockchain instead of relying on centralised entities.`;
    })(),

    [Intent.SEAL_INTENT]:
      banner?.description ||
      t`The Seal Engine is a module of the Sky Protocol. The MKR and or SKY tokens you supply to the Seal Engine are sealed behind an exit fee in order to provide access to Seal Rewards and encourage a deeper commitment to Sky ecosystem governance. With Sky, you always remain in control of your funds.`,

    [Intent.STAKE_INTENT]:
      banner?.description ||
      t`The Staking Engine is a module of the Sky Protocol. When you stake SKY tokens to the Staking Engine, you can access Staking Rewards and may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. With Sky, you always remain in control of your assets.`
  };

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(100% 177.78% at 100% 0%, #A273FF 0%, #4331E9 100%)"
      colorMiddle="radial-gradient(circle at 0% 100%, #FFCD6B 0%, #EB5EDF 150%)"
      colorRight="#2A197D"
      className={className}
    >
      <div className="w-[80%] space-y-2 lg:w-2/3" data-testid="connect-wallet-card">
        <Heading className="mb-2">{heading}</Heading>
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
