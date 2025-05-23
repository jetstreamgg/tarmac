import { Trans } from '@lingui/react/macro';
import { ConnectWallet } from '../icons/ConnectWallet';
import { Heading } from './Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

export function ConnectWalletCopy({
  className,
  onExternalLinkClicked
}: {
  className?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 py-1 pl-5 pr-3">
        <div className="px-3 py-1.5">
          <ConnectWallet />
        </div>
        <div className="space-y-1">
          <Heading variant="small">
            <Trans>Connect to explore Sky Protocol features</Trans>
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
