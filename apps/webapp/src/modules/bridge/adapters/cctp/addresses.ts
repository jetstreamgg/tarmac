import type { Address } from 'viem';

// Zero-import (viem types only) so the node scripts can share it.
// CCTP V2 is deployed at the same addresses on every chain.
export const TOKEN_MESSENGER_V2: Address = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
export const MESSAGE_TRANSMITTER_V2: Address = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';
export const TOKEN_MINTER_V2: Address = '0xfd78EE919681417d192449715b2594ab58f5D002';
