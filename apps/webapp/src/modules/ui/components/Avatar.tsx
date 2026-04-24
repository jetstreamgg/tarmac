import JazziconDefault, { jsNumberForAddress } from 'react-jazzicon';

// Vite 8 / Rolldown exposes a CJS module's default import as the whole exports object,
// so we unwrap to reach the component.
const Jazzicon = (JazziconDefault as unknown as { default: typeof JazziconDefault }).default;

export const CustomAvatar = ({ address, size }: { address: string; size: number }) => {
  return address ? <Jazzicon diameter={size} seed={jsNumberForAddress(address)} /> : null;
};
