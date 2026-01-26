import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { Text } from '@widgets/shared/components/ui/Typography';

export const VaultPoweredBy = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => (
  <Text className="text-text mb-4 text-sm leading-none font-normal">
    Powered by{' '}
    <ExternalLink
      href="https://morpho.org/"
      showIcon={false}
      className="underline"
      onExternalLinkClicked={onExternalLinkClicked}
    >
      Morpho
    </ExternalLink>
  </Text>
);
