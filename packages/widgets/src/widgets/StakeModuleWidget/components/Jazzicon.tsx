import JazziconDefault, { jsNumberForAddress } from 'react-jazzicon';
import { useMemo } from 'react';
import { cn } from '@widgets/lib/utils';

// Vite 8 / Rolldown exposes a CJS module's default import as the whole exports object,
// so we unwrap to reach the component.
const Jazzicon = (JazziconDefault as unknown as { default: typeof JazziconDefault }).default;

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
