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
 * The page footer (APP-456 #1): the landing page footer's bottom row and
 * nothing else — copyright on the left, legal links on the right, 12px on
 * fg-primary. The legal disclaimer that sat above it was cut.
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
      className={cn(
        'text-fgPrimary mx-auto w-full max-w-[1320px] pt-10 pb-6 text-xs leading-4',
        // The row stacks below sm: at 375px the copyright and four link labels
        // don't fit on one line, and wrapping them mid-row reads as a broken
        // grid rather than a footer.
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        pageGutterClasses
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
              // Same hover as these links get in the More menu (`moreItemClasses`),
              // which is where the other half of `VITE_FOOTER_LINKS` renders — they
              // dim to fg-secondary rather than picking up an underline. The
              // focus ring is the app's standard one, so keyboard users get a
              // visible target the pointer hover alone wouldn't give them.
              className="text-fgPrimary hover:text-fgSecondary focus-visible:ring-focusRing rounded-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {link.name}
            </ExternalLink>
          ))}
        </nav>
      )}
    </footer>
  );
}
