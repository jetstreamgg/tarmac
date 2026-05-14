import { Trans } from '@lingui/react/macro';
import { EmptyFunds } from '../icons/EmptyFunds';
import { Heading } from './Typography';

export function NoFundsCopy({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 py-1 pr-3 pl-5">
        <div className="px-3 py-1.5">
          <EmptyFunds />
        </div>
        <Heading variant="small">
          <Trans>Put your funds to work</Trans>
        </Heading>
      </div>
    </div>
  );
}
