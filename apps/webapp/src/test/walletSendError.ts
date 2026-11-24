import { createWalletClient, custom, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';

const ACCOUNT = '0x0000000000000000000000000000000000000001';
const TOKEN = '0x0000000000000000000000000000000000000002';

/** The error viem throws for a contract write the wallet answered with `answer`. */
export async function walletSendError(answer: unknown): Promise<Error> {
  const client = createWalletClient({
    account: ACCOUNT,
    chain: mainnet,
    transport: custom(
      {
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_chainId') return '0x1';
          throw answer;
        }
      },
      { retryCount: 0 }
    )
  });
  try {
    await client.writeContract({
      address: TOKEN,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ACCOUNT, 1n]
    });
  } catch (error) {
    return error as Error;
  }
  throw new Error('The wallet send did not fail');
}
