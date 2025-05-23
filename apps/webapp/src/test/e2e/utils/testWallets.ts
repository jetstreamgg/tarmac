// Test wallet addresses for parallel workers
// derived from eth_accounts response from tenderly
export const TEST_WALLET_ADDRESSES: `0x${string}`[] = [
  '0xde70d75bee022c0706c584042836a44abc5bb863',
  '0xce1913aba69e864d38775636b0e4bdbec11ffff1',
  '0x96d14a3159262f136d5a5c0ea2e138d6072901da',
  '0x96ec7efa61984eace92a0cb895b6ed423ffdb913',
  '0xf6a39bcdccad0aa0cc21163f89cceed01748871e',
  '0x74185a27ce3827a281ac03b6feaadb76712ccd47',
  '0x6b9ba7690eb4ac4e445d5d044c34daf3e3c94bbb',
  '0x818501e1f63313de6a236a019b2e3f103f764e64',
  '0xe6aa09b6c24228a7c7f03dab01c8edc9e40b7f70',
  '0x193c5a0cc9a1c0242cf757dc570e54a811dd0c1f'
] as const;

export const getTestWalletAddress = (workerIndex: number): `0x${string}` => {
  return TEST_WALLET_ADDRESSES[workerIndex];
};
