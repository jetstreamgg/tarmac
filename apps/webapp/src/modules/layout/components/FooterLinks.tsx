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
        <Button variant="primaryAlt" size="xs" className="px-4 py-2">
          <ExternalLink href="https://jobs.ashbyhq.com/skyecosystem" showIcon={false}>
            Careers
          </ExternalLink>
        </Button>
      </div>
    </div>
  );
}
