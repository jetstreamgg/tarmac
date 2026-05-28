// Formats an address by trimming the middle part of the address.
export function formatAddress(address: string, lengthStart = 4, lengthEnd = 4) {
  return `${address.slice(0, lengthStart)}...${address.slice(-lengthEnd)}`;
}
