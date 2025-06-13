import { Popover, PopoverArrow, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Close, Info } from '@/modules/icons';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

const content = {
  str: {
    title: 'Sky Token Rewards (STR) Rate',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        The Sky Token Rewards (STR) rate is variable, and is determined by the following factors: the current
        issuance rate of the reward token in question, as set through the relevant onchain governance
        processes pertinent to the reward token in question (for example, SKY issuance rate is decided by the
        decentralised Maker/Sky ecosystem onchain governance), the current market price of the reward token in
        question, and the user’s proportional percentage of the total supply within the pool of funds accruing
        that particular reward. STR rate may be volatile. The rate provided here is an estimate of the
        relevant STR rate expressed in expected rate per annum, should be automatically updated every 5
        minutes and is powered by data provided by a third party (
        <ExternalLink
          href="https://blockanalitica.com/"
          className="hover:text-white hover:underline"
          showIcon={false}
        >
          BlockAnalitica
        </ExternalLink>
        ). This figure does not represent or guarantee future results.
      </Text>
    )
  },
  ssr: {
    title: 'Sky Savings Rate (SSR)',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
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
        >
          BlockAnalitica
        </ExternalLink>
        ). This figure does not represent or guarantee future results.
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
  srr: {
    title: 'Staking Rewards Rate',
    description: (
      <Text className="leading-5 text-white/80" variant="small">
        The Staking Rewards Rate (SRR) is variable and may fluctuate. It is determined by: (1) the current
        issuance rate of the rewards set through onchain governance processes and (2) the market price of the
        stakedSKY at the time of each calculation. Rewards are accrued in USDS for the time being, subject to
        future adjustment by onchain governance. The SRR provided is an estimated annual rate, updated using
        data from a third party provider (i.e.,
        <ExternalLink
          href="https://blockanalitica.com/"
          className="hover:text-white hover:underline"
          showIcon={false}
        >
          BlockAnalitica
        </ExternalLink>
        ). Further, The estimate is for informational purposes only and does not guarantee future results.
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
  }
};

export const PopoverInfo = ({ type }: { type: 'str' | 'ssr' | 'sbr' | 'srr' | 'dtc' | 'psm' }) => {
  if (!(type in content)) return null;

  return (
    <Popover>
      <PopoverTrigger>
        <Info />
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="backdrop-blur-lg">
        <Heading variant="small" className="text-[16px] leading-6">
          {content[type].title}
        </Heading>
        <PopoverClose className="absolute right-4 top-4">
          <Close className="h-5 w-5 cursor-pointer" />
        </PopoverClose>
        <div className="scrollbar-thin mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto">
          {content[type].description}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
