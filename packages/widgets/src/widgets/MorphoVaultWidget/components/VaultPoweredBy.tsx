import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { Morpho } from '@widgets/shared/components/icons/Morpho';
import { Text } from '@widgets/shared/components/ui/Typography';

export const VaultPoweredBy = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => (
  <div className="mb-4 flex items-center gap-1.5">
    <Text className="text-text text-sm leading-none font-normal">
      Powered by{' '}
      <ExternalLink
        href="https://morpho.org/"
        showIcon={true}
        iconSize={12}
        wrapperClassName="gap-1"
        onExternalLinkClicked={onExternalLinkClicked}
      >
        Morpho
      </ExternalLink>
    </Text>
    <Morpho className="rounded-[0.25rem]" />
  </div>
);
