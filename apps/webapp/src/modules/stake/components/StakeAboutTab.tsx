import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { FileText, Signature, Landmark } from 'lucide-react';
import { stakeModuleAddress } from '@/hooks';
import { getEtherscanLink } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { Button } from '@/components/ui/button';
import { StakeEngineCard } from './StakeEngineCard';

// Corpus-fed About copy (PRD Decision 11): never hardcode Figma text — the body
// arrives pre-authored from the sync pipeline. Where corpus and mock differ,
// corpus wins.
const ABOUT_BANNER_ID = 'about-the-staking-engine';

function Card({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="bg-panel rounded-card flex flex-col gap-4 p-6 backdrop-blur-2xl">
      {children}
    </div>
  );
}

/**
 * About tab body (hi-fi 486:32043): the corpus-fed "About the Staking Engine"
 * copy, a numbered How-it-works list, and a Links row — with the shared Sky
 * Staking Engine promo card in the right rail. Read-only.
 */
export function StakeAboutTab() {
  const banner = getBannerById(ABOUT_BANNER_ID);
  const chainId = useChainId();
  // Staking is mainnet-only; on a chain without a module deployment (the page
  // itself has no hard chain gate) link the mainnet contract rather than
  // rendering /address/undefined.
  const stakeAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
  const contractHref = stakeAddress
    ? getEtherscanLink(chainId, stakeAddress, 'address')
    : getEtherscanLink(1, stakeModuleAddress[1], 'address');

  // Leading contextual icons per hi-fi 486:32079 (file · signature · landmark),
  // not a trailing external-link glyph.
  const links = [
    { label: <Trans>Docs</Trans>, href: 'https://docs.sky.money', icon: <FileText className="h-4 w-4" /> },
    { label: <Trans>View contract</Trans>, href: contractHref, icon: <Signature className="h-4 w-4" /> },
    {
      label: <Trans>Governance</Trans>,
      href: 'https://vote.sky.money/',
      icon: <Landmark className="h-4 w-4" />
    }
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card testId="stake-about-copy">
          {banner?.title && <h3 className="text-text text-2xl font-medium">{banner.title}</h3>}
          <div className="text-textSecondary">{parseBannerContent(banner?.description)}</div>
        </Card>

        <Card testId="stake-how-it-works">
          <h3 className="text-text text-2xl font-medium">
            <Trans>How it works?</Trans>
          </h3>
          <ol className="flex flex-col">
            <HowItWorksRow n={1}>
              <Trans>Stake SKY & earn rewards</Trans>
            </HowItWorksRow>
            <HowItWorksRow n={2} optional>
              <Trans>Borrow USDS</Trans>
            </HowItWorksRow>
            <HowItWorksRow n={3} optional>
              <Trans>Delegate Voting Power</Trans>
            </HowItWorksRow>
          </ol>
        </Card>

        <div data-testid="stake-about-links" className="grid grid-cols-3 gap-4">
          {links.map(({ label, href, icon }, i) => (
            <Button
              key={i}
              variant="outline"
              className="border-border h-12 w-full gap-2 rounded-full bg-white/[0.03] hover:bg-white/[0.06]"
              asChild
            >
              <a href={href} target="_blank" rel="noopener noreferrer" className="justify-center gap-2">
                {icon}
                {label}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-1">
        <StakeEngineCard />
      </div>
    </div>
  );
}

function HowItWorksRow({
  n,
  optional,
  children
}: {
  n: number;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="border-textSecondary/10 flex items-center justify-between gap-3 border-b py-4 last:border-b-0">
      <span className="flex items-center gap-3">
        <span className="bg-surface text-text flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
          {n}
        </span>
        <span className="text-text">{children}</span>
      </span>
      {optional && (
        <span className="text-textSecondary text-sm">
          <Trans>(Optional)</Trans>
        </span>
      )}
    </li>
  );
}
