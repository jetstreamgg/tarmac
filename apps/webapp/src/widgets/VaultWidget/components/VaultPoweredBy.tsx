import { ExternalLink } from '@/widgets/shared/components/ExternalLink';
import { Morpho } from '@/widgets/shared/components/icons/Morpho';
import { Sky } from '@/widgets/shared/components/icons/Sky';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { VaultProvider } from '@/hooks';

const PROVIDER_META: Record<VaultProvider, { label: string; href: string }> = {
  morpho: { label: 'Morpho', href: 'https://morpho.org/' },
  sky: { label: 'Sky', href: 'https://sky.money/' }
};

export const VaultPoweredBy = ({
  provider = 'morpho',
  onExternalLinkClicked
}: {
  /** Which provider powers the vault (defaults to Morpho for legacy call sites) */
  provider?: VaultProvider;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { label, href } = PROVIDER_META[provider];
  return (
    <div className="mb-4 flex items-center gap-1.5">
      <Text className="text-text text-sm leading-none font-normal">
        Powered by{' '}
        <ExternalLink
          href={href}
          showIcon={true}
          iconSize={12}
          wrapperClassName="gap-1"
          onExternalLinkClicked={onExternalLinkClicked}
        >
          {label}
        </ExternalLink>
      </Text>
      {provider === 'sky' ? (
        <Sky className="rounded-full" />
      ) : (
        <Morpho className="rounded-[0.25rem]" />
      )}
    </div>
  );
};
