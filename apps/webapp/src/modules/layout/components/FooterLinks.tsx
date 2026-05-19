import { ExternalLink } from './ExternalLink';
import { Text } from './Typography';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';
import { POSTHOG_ENABLED } from '@/modules/analytics/PostHogProvider';

export function FooterLinks() {
  const footerLinks = getFooterLinks();
  const { showBanner } = useCookieConsent();
  const externalClass = 'hover:text-white hover:underline hover:underline-offset-4';

  const regularLinks = footerLinks.filter(link => link.highlight !== 'true');
  const highlightedLinks = footerLinks.filter(link => link.highlight === 'true');

  return (
    <div className={'flex w-full pt-2'}>
      <div className="flex w-full items-center justify-end gap-3 md:justify-start">
        {regularLinks.map((link, i) => {
          const url = sanitizeUrl(link.url);
          if (!url) return null;
          return (
            <ExternalLink key={url || `link-${i}`} showIcon={false} href={url} className={externalClass}>
              <Text variant="captionSm" className="text-white">
                {link.name}
              </Text>
            </ExternalLink>
          );
        })}
        {POSTHOG_ENABLED && (
          <button onClick={showBanner} className={externalClass}>
            <Text variant="captionSm" className="text-white">
              Cookie Settings
            </Text>
          </button>
        )}
        {highlightedLinks.map((link, i) => {
          const url = sanitizeUrl(link.url);
          if (!url) return null;
          return (
            <Button
              key={url || `highlight-${i}`}
              variant="primaryAlt"
              size="xs"
              className="py-2 sm:px-4"
              asChild
            >
              <ExternalLink href={url} showIcon={false}>
                {link.name}
              </ExternalLink>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
