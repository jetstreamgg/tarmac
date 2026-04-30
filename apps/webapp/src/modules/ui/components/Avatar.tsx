import JazziconDefault, { jsNumberForAddress } from 'react-jazzicon';

// react-jazzicon is CJS-only. Vite 8's dev dep-optimizer exposes the whole module.exports
// as the default, while the prod bundler auto-unwraps to module.exports.default. Fall back
// to handle both.
const Jazzicon =
  (JazziconDefault as unknown as { default?: typeof JazziconDefault }).default ?? JazziconDefault;

export const CustomAvatar = ({ address, size }: { address: string; size: number }) => {
  return address ? <Jazzicon diameter={size} seed={jsNumberForAddress(address)} /> : null;
};
