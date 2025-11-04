import { ExternalLink } from './ExternalLink';
import { Text } from './Typography';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function FooterLinks() {
  const footerLinks = getFooterLinks();
  const externalClass = 'hover:text-white hover:underline hover:underline-offset-4';

  return (
    <div className={'flex w-full pt-2'}>
      <div className="flex w-full justify-end gap-3 md:justify-start">
        {footerLinks.map((link, i) => {
          const url = sanitizeUrl(link.url);
          if (!url) return null;
          const key = url || `link-${i}`;

          if (link.highlight === 'true') {
            return (
              <Button key={key} variant="primaryAlt" size="xs" className="px-4 py-2" asChild>
                <ExternalLink href={url} showIcon={false}>
                  {link.name}
                </ExternalLink>
              </Button>
            );
          }

          return (
            <ExternalLink key={key} showIcon={false} href={url} className={externalClass}>
              <Text variant="captionSm" className="text-white">
                {link.name}
              </Text>
            </ExternalLink>
          );
        })}
      </div>
    </div>
  );
}
