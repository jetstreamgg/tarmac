import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useMemo } from 'react';

export const JazziconComponent = ({
  address,
  diameter = 24
}: {
  address?: `0x${string}`;
  diameter?: number;
}) => {
  return useMemo(() => {
    return address ? (
      <div className="h-6 w-6 shrink-0">
        <Jazzicon diameter={diameter} seed={jsNumberForAddress(address)} />
      </div>
    ) : null;
  }, [address, diameter]);
};
