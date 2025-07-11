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
    title: 'Staking Rewards Rate (SRR)',
    description: (
      <Text variant="small" className="leading-5 text-white/80">
        The Staking Rewards Rate (SRR) is variable and may fluctuate. It is determined by: (1) the current
        issuance rate of the rewards set through onchain governance processes and (2) the market price of the
        staked SKY at the time of each calculation. Rewards are accrued in USDS for the time being, subject to
        any future adjustment by onchain governance. The SRR shown here is an estimated annual rate, updated
        using data from a third party provider (i.e.,{' '}
        <ExternalLink
          href="https://blockanalitica.com/"
          className="hover:text-white hover:underline"
          showIcon={false}
          onExternalLinkClicked={onExternalLinkClicked}
        >
          BlockAnalitica
        </ExternalLink>
        ). Further, the estimate is for informational purposes only and does not guarantee future results.
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
  }
});

export const PopoverRateInfo = ({
  type,
  onExternalLinkClicked,
  iconClassName
}: {
  type: 'str' | 'ssr' | 'srr' | 'dtc';
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  iconClassName?: string;
}) => {
  const content = getContent(onExternalLinkClicked);

  if (!(type in content)) return null;

  return (
    <Popover>
      <PopoverTrigger onClick={e => e.stopPropagation()} className="z-10">
        <Info className={iconClassName} />
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
        <div className="scrollbar-thin mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto">
          {content[type].description}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
