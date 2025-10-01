import { ExternalLink } from './ExternalLink';
import { Text } from './Typography';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';

export function FooterLinks() {
  const footerLinks = getFooterLinks();
  const externalClass = 'hover:text-white hover:underline hover:underline-offset-4';

  return (
    <div className={'flex w-full pt-2'}>
      <div className="flex w-full justify-end gap-3 md:justify-start">
        {footerLinks.map((link, i) => (
          <ExternalLink
            key={link.url || `link-${i}`}
            showIcon={false}
            href={sanitizeUrl(link.url)}
            className={externalClass}
          >
            <Text variant="captionSm" className="text-white">
              {link.name}
            </Text>
          </ExternalLink>
        ))}
      </div>
    </div>
  );
}
