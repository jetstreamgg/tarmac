import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useMemo } from 'react';
import { cn } from '@widgets/lib/utils';

export const JazziconComponent = ({
  address,
  className,
  diameter = 24
}: {
  address?: `0x${string}`;
  className?: string;
  diameter?: number;
}) => {
  return useMemo(() => {
    return address ? (
      <div className={cn('h-6 w-6 shrink-0', className)}>
        <Jazzicon diameter={diameter} seed={jsNumberForAddress(address)} />
      </div>
    ) : null;
  }, [address, diameter]);
};
