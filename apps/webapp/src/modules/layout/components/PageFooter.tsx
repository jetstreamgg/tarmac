import { cn } from '@/lib/cn';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { ExternalLink } from './ExternalLink';
import { pageGutterClasses } from './shellLayoutClasses';

/**
 * The bottom line of every page: copyright on the left, legal links on the
 * right, both on fg-secondary.
 *
 * This is the interim footer (APP-456 #1) — it reproduces only the last row of
 * the landing page's footer, which is the part whose content is already
 * settled. The full footer (the disclaimer paragraphs above this row) waits on
 * a design spec.
 *
 * The links come from the deployment's `VITE_FOOTER_LINKS`, the same source
 * the More menu reads, so the two never drift apart.
 */
export function PageFooter() {
  const links = getFooterLinks()
    .map(link => ({ ...link, url: sanitizeUrl(link.url) }))
    .filter((link): link is { name: string; url: string; highlight?: string } => !!link.url);

  return (
    <footer
      data-testid="page-footer"
      className={cn(
        'text-fgSecondary mx-auto w-full max-w-[1320px] pt-10 pb-6',
        // The row stacks below sm: at 375px the copyright and three link labels
        // don't fit on one line, and wrapping them mid-row reads as a broken
        // grid rather than a footer.
        'flex flex-col gap-3 text-xs leading-4 sm:flex-row sm:items-center sm:justify-between',
        pageGutterClasses
      )}
    >
      {/* The landing page's wording, verbatim. */}
      <p>© {new Date().getFullYear()} All rights reserved</p>
      {links.length > 0 && (
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {links.map(link => (
            <ExternalLink
              key={link.url}
              href={link.url}
              showIcon={false}
              className="text-fgSecondary hover:text-fgPrimary transition-colors"
            >
              {link.name}
            </ExternalLink>
          ))}
        </nav>
      )}
    </footer>
  );
}
