import { cowApiClient } from './constants';

export const fetchOrderStatus = async (orderId: string, chainId: number) => {
  try {
    const { data, response } = await cowApiClient[chainId as keyof typeof cowApiClient].GET(
      '/api/v1/orders/{UID}',
      {
        params: {
          path: { UID: orderId }
        }
      }
    );

    if (!response.ok || !data) {
      throw new Error(`Failed to fetch order status: ${response.statusText}`);
    }

    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};
