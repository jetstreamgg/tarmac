import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { FileText, Signature, Landmark } from 'lucide-react';
import { stakeModuleAddress } from '@/hooks';
import { getEtherscanLink } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { Button } from '@/components/ui/button';
import { Card as CardSurface } from '@/components/ui/card';
import { StakeEngineCard } from './StakeEngineCard';

// Corpus-fed About copy (PRD Decision 11): never hardcode Figma text — the body
// arrives pre-authored from the sync pipeline. Where corpus and mock differ,
// corpus wins.
const ABOUT_BANNER_ID = 'about-the-staking-engine';

// Mobile comp 1222:17233 drops the card chrome — sections sit flat on the page
// background with Label 3 headings; the desktop card look returns at md.
function Card({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <CardSurface
      data-testid={testId}
      className="md:bg-glassSurface flex flex-col gap-4 rounded-none bg-transparent p-0 backdrop-blur-none md:rounded-[28px] md:p-6 md:backdrop-blur-[20px]"
    >
      {children}
    </CardSurface>
  );
}

// Section headings: Label 3 (16/18, -0.32) on the phone tier, the desktop
// 24px title at md.
const sectionHeading =
  'text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:font-sans md:text-2xl md:leading-normal md:tracking-normal';

/**
 * About tab body (hi-fi 486:32043, mobile 1222:17233): the corpus-fed "About
 * the Staking Engine" copy, a numbered How-it-works list, and a Links block —
 * with the shared Sky Staking Engine promo card in the right rail (first on
 * the phone tier per the mobile comp). Read-only.
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
    <div className="grid gap-10 lg:grid-cols-3 lg:gap-6">
      <div className="order-2 flex flex-col gap-10 lg:order-none lg:col-span-2 lg:gap-6">
        <Card testId="stake-about-copy">
          {banner?.title && <h3 className={sectionHeading}>{banner.title}</h3>}
          <div className="text-fgSecondary text-sm leading-[22px] md:text-base md:leading-normal">
            {parseBannerContent(banner?.description)}
          </div>
        </Card>

        <Card testId="stake-how-it-works">
          <h3 className={sectionHeading}>
            <Trans>How it works?</Trans>
          </h3>
          {/* Phone tier: the rows live in their own bordered 24px surface
              (comp 1222:17233); at md the parent card supplies the chrome. */}
          <ol className="border-borderPrimary flex flex-col rounded-3xl border md:rounded-none md:border-none">
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

        <div data-testid="stake-about-links" className="flex flex-col gap-4">
          <h3 className={`${sectionHeading} md:hidden`}>
            <Trans>Links</Trans>
          </h3>
          <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-4">
            {links.map(({ label, href, icon }, i) => (
              <Button key={i} variant="secondary" size="l" className="w-full" asChild>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {icon}
                  {label}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-none lg:col-span-1">
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
    <li className="border-borderPrimary flex items-center justify-between gap-3 border-b p-4 last:border-b-0 md:px-0 md:py-4">
      <span className="flex items-center gap-2 md:gap-3">
        <span className="bg-glassSurface md:bg-surface text-text font-circle flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:leading-normal md:tracking-normal">
          {n}
        </span>
        <span className="text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:text-base md:leading-normal md:font-normal md:tracking-normal">
          {children}
        </span>
      </span>
      {optional && (
        <span className="text-fgSecondary text-xs leading-[18px] md:text-sm md:leading-normal">
          <Trans>(Optional)</Trans>
        </span>
      )}
    </li>
  );
}
