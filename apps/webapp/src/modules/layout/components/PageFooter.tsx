import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { ExternalLink } from './ExternalLink';
import { pageGutterClasses } from './shellLayoutClasses';

/**
 * Which of the deployment's links belong in the footer: the legal documents
 * only. `VITE_FOOTER_LINKS` also carries non-legal entries — Bug Bounty today —
 * which stay in the More menu but don't belong beside the legal disclaimer.
 * Matched on the name, the same vocabulary `TopNav` picks its glyphs from.
 */
const isLegalLink = (name: string) => /terms|privacy|risk/i.test(name);

/**
 * The page footer (APP-456 #1): the landing page's legal disclaimer over its
 * bottom row — copyright on the left, legal links on the right.
 *
 * Copy is the landing footer's, verbatim, cut to its first two paragraphs (the
 * forward-looking-statements paragraph is left off). The two blocks are
 * typographically distinct: the disclaimer is 10px on fg-secondary, the bottom
 * row 12px on fg-primary.
 *
 * The links come from the deployment's `VITE_FOOTER_LINKS`, the same source the
 * More menu reads, so the two never drift apart.
 */
export function PageFooter() {
  const links = getFooterLinks()
    .filter(link => isLegalLink(link.name))
    .map(link => ({ ...link, url: sanitizeUrl(link.url) }))
    .filter((link): link is { name: string; url: string; highlight?: string } => !!link.url);

  return (
    <footer
      data-testid="page-footer"
      className={cn('mx-auto flex w-full max-w-[1320px] flex-col gap-6 pt-10 pb-6', pageGutterClasses)}
    >
      <div
        data-testid="page-footer-disclaimer"
        className="text-fgSecondary flex flex-col gap-4 text-[10px] leading-[14px]"
      >
        <p>
          <Trans>
            IMPORTANT DISCLAIMER: Skybase International operates the sky.money interface as a non-custodial
            frontend. Skybase does not custody user assets, does not intermediate transactions, and does not
            exercise control over protocol parameters, governance decisions, or smart contract operations.
            Skybase operates independently from SkyDAO, Sky Frontier Foundation, and all other Sky Ecosystem
            participants. This communication should not be attributed to, and does not represent the views of,
            SkyDAO, the Sky Protocol, or any other ecosystem participant.
          </Trans>
        </p>
        <p>
          <Trans>
            Skybase International does not guarantee any level of yield, return, or protocol performance. The
            Sky Savings Rate and all other protocol parameters are determined through decentralized governance
            by SKY tokenholders and are subject to change or elimination at any time. Skybase does not set,
            control, or guarantee any rates displayed on this interface. Historical rates based on public
            on-chain data are provided for informational purposes only and may not continue. Skybase does not
            provide investment advice and makes no recommendation regarding the purchase, sale, or holding of
            any tokens.
          </Trans>
        </p>
      </div>

      <div
        className={cn(
          'text-fgPrimary text-xs leading-4',
          // The row stacks below sm: at 375px the copyright and four link labels
          // don't fit on one line, and wrapping them mid-row reads as a broken
          // grid rather than a footer.
          'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
        )}
      >
        <p>© {new Date().getFullYear()} All rights reserved</p>
        {links.length > 0 && (
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {links.map(link => (
              <ExternalLink
                key={link.url}
                href={link.url}
                showIcon={false}
                className="text-fgPrimary hover:underline hover:underline-offset-4"
              >
                {link.name}
              </ExternalLink>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}
