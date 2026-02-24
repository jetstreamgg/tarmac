import { Trans } from '@lingui/react/macro';
import { EmptyFunds } from '../icons/EmptyFunds';
import { Heading } from './Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

export function NoFundsCopy({
  className,
  onExternalLinkClicked
}: {
  className?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 py-1 pr-3 pl-5">
        <div className="px-3 py-1.5">
          <EmptyFunds />
        </div>
        <div className="space-y-1">
          <Heading variant="small">
            <Trans>Put your funds to work</Trans>
          </Heading>
          <ExternalLink
            href="https://sky.money/features"
            iconSize={16}
            className="text-textEmphasis"
            onExternalLinkClicked={onExternalLinkClicked}
          >
            <Trans>Sky Protocol features</Trans>
          </ExternalLink>
        </div>
      </div>
    </div>
  );
}
