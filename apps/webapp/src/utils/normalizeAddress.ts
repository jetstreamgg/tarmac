import { ZERO_ADDRESS } from './constants';

export const normalizeAddress = (address: `0x${string}` | undefined): `0x${string}` | undefined => {
  if (address === ZERO_ADDRESS || address === undefined) {
    return undefined;
  }
  return address.toLowerCase() as `0x${string}`;
};
