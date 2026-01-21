import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

export const CustomAvatar = ({ address, size }: { address: string; size: number }) => {
  return address ? <Jazzicon diameter={size} seed={jsNumberForAddress(address)} /> : null;
};
