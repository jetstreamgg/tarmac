import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@widgets/components/ui/popover';
import { Close } from '../icons/Close';
import { Info } from '../icons/Info';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

const getContent = (
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
) => ({
  str: {
    title: 'Sky Token Rewards (STR) Rate',
    description: (
      <Text variant="small" className="leading-5 text-white/80">
        The Sky Token Rewards Rate is different for each type of token rewarded, and always fluctuates,
        determined by the following factors:
        <br />
        <br />
        • The issuance rate of the token rewarded, which is determined by Sky Ecosystem Governance;
        <br />
        <br />
        • The market price of the token rewarded; and
        <br />
        <br />
        • The user’s proportional supply within the total pool of assets linked to the Sky Token Rewards
        module.
        <br />
        <br />
        Sky.money does not control the issuance, determination, or distribution of these rewards.
      </Text>
    )
  },
  ssr: {
    title: 'Sky Savings Rate (SSR)',
    description: (
      <Text variant="small" className="leading-5 text-white/80">
        The Sky Savings Rate (SSR) is variable, determined by decentralised Sky Ecosystem onchain governance,
        and configured on the Ethereum blockchain. Sky Ecosystem governance is able to adapt the SSR and other
        relevant parameters at any time at its discretion and without notice, based on market conditions,
        protocol surplus and other factors. The rate provided here is an estimate of the SSR expressed in
        expected compounded rate per annum, should be automatically updated every 5 minutes, and is powered by
        data provided by a third party (
        <ExternalLink
          href="https://blockanalitica.com/"
          className="hover:text-white hover:underline"
          showIcon={false}
          onExternalLinkClicked={onExternalLinkClicked}
        >
          BlockAnalitica
        </ExternalLink>
        ). This figure does not represent or guarantee future results.
      </Text>
    )
  },
  srr: {
    title: 'Staking Rewards Rates (SRR)',
    description: (
      <Text variant="small" className="leading-5 text-white/80">
        Staking Rewards Rates are variable and may fluctuate. They are determined by: (1) the current issuance
        rate of the rewards set through onchain governance processes, and (2) the market price of the staked
        SKY at the time of each calculation. The SRRs shown are estimated annual rates, updated using data
        from a third-party provider (i.e.,{' '}
        <ExternalLink
          href="https://blockanalitica.com/"
          className="hover:text-white hover:underline"
          showIcon={false}
          onExternalLinkClicked={onExternalLinkClicked}
        >
          BlockAnalitica
        </ExternalLink>
        ). Further, the estimates are for informational purposes only and do not guarantee future results.
      </Text>
    )
  },
  dtc: {
    title: 'Debt Ceiling',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        The debt ceiling is the maximum amount of debt or tokens that can be issued within the SKY protocol,
        serving as a risk management tool to ensure stability and limit overexposure. It is a parameter
        subject to change by the Sky Ecosystem Governance.
      </Text>
    )
  },
  sbr: {
    title: 'Borrow Rate',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        The borrow rate is a parameter determined by Sky ecosystem governance through a process of
        decentralised onchain voting. Borrow rate fees accumulate automatically per block and get added to the
        total debt.
      </Text>
    )
  },
  psm: {
    title: 'Peg Stability Module (PSM)',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky
        Protocol for USDS or DAI at a fixed rate, with zero protocol fees; however, gas fees will apply. They
        are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX)
        transactions, PSM operations do not involve trading between users. Instead, they are direct,
        non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the
        Sky Protocol.
      </Text>
    )
  },
  stakingRewards: {
    title: 'Staking Rewards',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        Staking Rewards can be accessed when SKY is supplied to the Staking Engine of the decentralized,
        non-custodial Sky Protocol. Currently, all Staking Rewards take the form of USDS. Staking Reward rates
        are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.
      </Text>
    )
  },
  borrow: {
    title: 'Borrow',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        Borrowing against your staked collateral carries the risk of automatic liquidation without any
        possibility of recourse if at any time the value of your staked collateral drops below the required
        threshold and your position becomes undercollateralized. Please ensure you fully understand these
        risks before proceeding.
      </Text>
    )
  },
  delegate: {
    title: 'Delegate',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        When you hold SKY tokens, you maintain the right to participate in the process of Sky Ecosystem
        Governance voting. That means that you have the ability to contribute to the community-driven,
        decentralized ecosystem decision-making process, which occurs through onchain voting.
        <br />
        <br />
        The voting power delegation feature of the Staking Engine of the Sky Protocol enables you to entrust
        your voting power to a delegate of your choosing, who can then vote in the Sky Ecosystem Governance
        process on your behalf. You can choose one delegate per SKY position. If you want to entrust your SKY
        to two delegates using the Staking Engine, you will need to create two separate positions.
        <br />
        <br />
        Delegates in receipt of token voting power can never directly access any tokens delegated to them,
        including staked tokens. Throughout the delegation process, you always own and are in control of your
        staked tokens, and you can change your delegate at any time. Staking to delegate your voting power may
        be a useful option for governance token holders who have limited time to allocate to the process, who
        want to save on the cost of gas involved in voting on their own, and who also want to access Staking
        Rewards.
      </Text>
    )
  },
  liquidation: {
    title: 'Liquidation',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of
        your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour
        price update delay applies. In other words, when SKY drops below a user&apos;s liquidation price it
        will only start applying one hour later. This is called the OSM delay in technical terms, and it also
        applies to any legacy Maker MCD vault.
      </Text>
    )
  },
  delayedUpgradePenalty: {
    title: 'Delayed Upgrade Penalty',
    description: (
      <>
        <Text className="leading-5 text-white/80" variant="small">
          The Delayed Upgrade Penalty is a time-based upgrade mechanism, approved by Sky Ecosystem Governance,
          which is designed to facilitate a smooth and prompt upgrade of MKR to SKY.
        </Text>
        <br />
        <Text className="leading-5 text-white/80" variant="small">
          The penalty, which will begin sometime in September 2025, reduces the amount of SKY received per MKR
          upgraded at a rate of 1%, and increases by 1% every three months thereafter until it reaches 100% in
          25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.
        </Text>
      </>
    )
  }
});

// Export the valid tooltip types as a runtime constant
export const POPOVER_TOOLTIP_TYPES = [
  'str',
  'ssr',
  'sbr',
  'srr',
  'dtc',
  'psm',
  'stakingRewards',
  'borrow',
  'delegate',
  'liquidation',
  'delayedUpgradePenalty'
] as const;

// Derive the type from the constant
export type PopoverTooltipType = (typeof POPOVER_TOOLTIP_TYPES)[number];

export const PopoverRateInfo = ({
  type,
  onExternalLinkClicked,
  iconClassName,
  width = 16,
  height = 15
}: {
  type: PopoverTooltipType;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  iconClassName?: string;
  width?: number;
  height?: number;
}) => {
  const content = getContent(onExternalLinkClicked);

  if (!(type in content)) return null;

  return (
    <Popover>
      <PopoverTrigger onClick={e => e.stopPropagation()} className="z-10">
        <Info className={iconClassName} width={width} height={height} />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="bg-containerDark w-80 rounded-xl backdrop-blur-[50px]"
      >
        <Heading variant="small" className="text-[16px] leading-6">
          {content[type].title}
        </Heading>
        <PopoverClose onClick={e => e.stopPropagation()} className="absolute right-4 top-4 z-10">
          <Close className="h-5 w-5 cursor-pointer text-white" />
        </PopoverClose>
        <div
          className="scrollbar-thin mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          // The `onWheel` and `onTouchMove` stopPropagation handlers allow to scroll through the popover
          // content when rendered on top of another focus capturing elements, like modals.
          onWheel={e => {
            e.stopPropagation();
          }}
          onTouchMove={e => {
            e.stopPropagation();
          }}
        >
          {content[type].description}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
