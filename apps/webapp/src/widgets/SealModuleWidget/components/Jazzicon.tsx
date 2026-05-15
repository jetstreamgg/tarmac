import JazziconDefault, { jsNumberForAddress } from 'react-jazzicon';
import { useMemo } from 'react';

// react-jazzicon is CJS-only. Vite 8's dev dep-optimizer exposes the whole module.exports
// as the default, while the prod bundler auto-unwraps to module.exports.default. Fall back
// to handle both.
const Jazzicon =
  (JazziconDefault as unknown as { default?: typeof JazziconDefault }).default ?? JazziconDefault;

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
