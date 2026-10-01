import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Signature, Landmark } from 'lucide-react';
import { stakeModuleAddress } from '@/hooks';
import { getEtherscanLink } from '@/utils';
import { Button } from '@/components/ui/button';
import { StakeRateChart } from './StakeRateChart';
import { StakeDetailsStrip } from './StakeDetailsStrip';
import { BorrowUtilizationBlock } from './BorrowUtilizationBlock';
import { StakeRailCard, type StakeRailCardProps } from './StakeRailCard';

/**
 * Overview tab body (APP-600, comp 3617:23747): the Rate/TVL chart card, the
 * details strip, the borrow-utilization block and the Links row in the main
 * column, with the shared rail card (`StakeRailCard`) in the right rail.
 * Read-only.
 */
export function StakeOverviewTab({ rail }: { rail: StakeRailCardProps }) {
  // Mobile order: rail card → chart (20px below) → Details → Borrow
  // Utilization → Links (40px rhythm).
  //
  // Desktop (from 1200; the rail's hero figure can't fit a 912-1199 third,
  // APP-606): two columns — the left column stacks its blocks 80px apart, the
  // right rail holds the shared rail card. `items-start` keeps the rail from
  // stretching to the (much taller) left column's height.
  return (
    <div className="desktop:grid-cols-3 desktop:gap-8 grid items-start gap-5">
      <div className="desktop:order-none desktop:col-span-2 desktop:gap-20 order-2 flex flex-col gap-10">
        <StakeRateChart />
        <StakeDetailsStrip />
        <BorrowUtilizationBlock />
        <StakeLinks />
      </div>
      <div className="desktop:sticky desktop:top-22 desktop:self-start desktop:order-none desktop:col-span-1 order-1">
        <StakeRailCard {...rail} />
      </div>
    </div>
  );
}

function StakeLinks() {
  const chainId = useChainId();
  // Staking is mainnet-only; on a chain without a module deployment (the page
  // itself has no hard chain gate) link the mainnet contract rather than
  // rendering /address/undefined.
  const stakeAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
  const contractHref = stakeAddress
    ? getEtherscanLink(chainId, stakeAddress, 'address')
    : getEtherscanLink(1, stakeModuleAddress[1], 'address');

  // The comp's first link, Docs (FileText icon), is held back until the
  // staking docs page exists.
  const links = [
    { label: <Trans>View contract</Trans>, href: contractHref, icon: <Signature className="h-4 w-4" /> },
    {
      label: <Trans>Governance</Trans>,
      href: 'https://vote.sky.money/',
      icon: <Landmark className="h-4 w-4" />
    }
  ];

  return (
    <div data-testid="stake-overview-links" className="flex flex-col gap-4">
      <h3 className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]">
        <Trans>Links</Trans>
      </h3>
      <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-4">
        {links.map(({ label, href, icon }, i) => (
          <Button key={i} variant="secondary" size="l" className="w-full" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {icon}
              {/* An element, so the icon isn't `svg:last-child` (the recipe's -mr-2 would eat the gap). */}
              <span>{label}</span>
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
