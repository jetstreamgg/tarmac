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

// Sections sit flat on the page background at every tier — the desktop comp
// (1036:208624, APP-432 item 19) dropped the glass card chrome too, leaving a
// 16px heading→content gap.
function Section({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-4">
      {children}
    </section>
  );
}

// Section headings: Label 3 (16/18, -0.32) on the phone tier, the comp's
// 18/22 Circular at md — fg-primary, not white.
const sectionHeading =
  'text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]';

/**
 * About tab body (desktop 1036:208624, mobile 1222:17233): the corpus-fed
 * "About the Staking Engine" copy, a numbered How-it-works list, and a Links
 * block — flat sections on the page background at every tier — with the shared
 * Sky Staking Engine promo card in the right rail (first on the phone tier per
 * the mobile comp). Read-only.
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
      <div className="order-2 flex flex-col gap-10 md:gap-14 lg:order-none lg:col-span-2">
        <Section testId="stake-about-copy">
          {banner?.title && <h3 className={sectionHeading}>{banner.title}</h3>}
          {/* The comp's 14/22 body — passed through to the parser so its
              13px Text default doesn't undercut the wrapper. */}
          <div className="text-fgSecondary text-sm leading-[22px]">
            {parseBannerContent(banner?.description, 'text-sm leading-[22px]')}
          </div>
        </Section>

        <Section testId="stake-how-it-works">
          <h3 className={sectionHeading}>
            <Trans>How it works?</Trans>
          </h3>
          {/* The rows live in a bordered 24px surface at every tier — the
              desktop comp keeps the hairline container now that the glass
              card around it is gone. */}
          <ol className="border-borderPrimary flex flex-col rounded-3xl border">
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
        </Section>

        <div data-testid="stake-about-links" className="flex flex-col gap-4">
          <h3 className={sectionHeading}>
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
    <li className="border-borderPrimary flex items-center justify-between gap-3 border-b p-4 last:border-b-0 md:p-6">
      <span className="flex items-center gap-2 md:gap-3">
        <span className="bg-bgSecondary text-fgPrimary font-circle flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-4 font-medium tracking-[-0.28px]">
          {n}
        </span>
        <span className="text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
          {children}
        </span>
      </span>
      {optional && (
        <span className="text-fgSecondary text-xs leading-[18px]">
          <Trans>(Optional)</Trans>
        </span>
      )}
    </li>
  );
}
