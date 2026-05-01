import { Trans } from '@lingui/react/macro';
import { Text } from '@widgets/shared/components/ui/Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { Pendle as PendleIcon } from '@widgets/shared/components/icons/Pendle';

type PendlePoweredByProps = {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const PendlePoweredBy = ({ onExternalLinkClicked }: PendlePoweredByProps) => (
  <div className="mb-4 flex items-center gap-1.5">
    <Text className="text-text text-sm leading-none font-normal">
      <Trans>Powered by</Trans>{' '}
      <ExternalLink
        href="https://pendle.finance/"
        showIcon
        iconSize={12}
        wrapperClassName="gap-1"
        onExternalLinkClicked={onExternalLinkClicked}
      >
        Pendle
      </ExternalLink>
    </Text>
    <PendleIcon className="rounded-[0.25rem]" />
  </div>
);
