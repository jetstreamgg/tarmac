import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { ETH_FLOW_QUOTE_PARAMS, OrderQuoteSideKind, cowApiClient, SKY_MONEY_APP_CODE } from './constants';
import { OrderQuoteResponse, OrderQuoteSide } from './trade';
import { verifySlippageAndDeadline } from './helpers';
import { isL2ChainId } from '@jetstreamgg/sky-utils';

type GetTradeQuoteParams = {
  chainId: number;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  address: `0x${string}`;
  amount: bigint;
  kind: OrderQuoteSideKind;
  slippage: number;
  ttl: number;
  isEthFlow: boolean;
  isSmartContractWallet: boolean;
};

const getTradeQuote = async ({
  chainId,
  sellToken,
  buyToken,
  address = ZERO_ADDRESS,
  kind,
  amount,
  slippage,
  ttl,
  isEthFlow,
  isSmartContractWallet
}: GetTradeQuoteParams) => {
  const side: OrderQuoteSide =
    kind === OrderQuoteSideKind.BUY
      ? { kind: OrderQuoteSideKind.BUY, buyAmountAfterFee: amount.toString() }
      : { kind: OrderQuoteSideKind.SELL, sellAmountBeforeFee: amount.toString() };

  const {
    data: quoteData,
    response,
    error
  } = await cowApiClient[chainId as keyof typeof cowApiClient].POST('/api/v1/quote', {
    body: {
      ...side,
      sellToken,
      buyToken,
      from: address,
      validFor: ttl,
      appData: `{"appCode":"${SKY_MONEY_APP_CODE}","metadata":{"orderClass":{"orderClass":"market"}},"version":"1.1.0"}`,
      // API defaults
      onchainOrder: false,
      priceQuality: 'verified',
      sellTokenBalance: 'erc20',
      buyTokenBalance: 'erc20',
      signingScheme: isSmartContractWallet ? 'presign' : 'eip712',
      ...(isEthFlow ? ETH_FLOW_QUOTE_PARAMS : {})
    }
  });

  if (!response.ok || !quoteData) {
    throw new Error((error as { errorType: string } | undefined)?.errorType);
  }

  const { quote } = quoteData;

  const sellAmountBeforeFee = BigInt(quote.sellAmount);
  const sellAmountAfterFee = BigInt(quote.sellAmount) + BigInt(quote.feeAmount);
  const buyAmountBeforeFee = BigInt(quote.buyAmount);
  const buyAmountAfterFee = (buyAmountBeforeFee * sellAmountAfterFee) / sellAmountBeforeFee;
  const feeAmountInBuyToken = buyAmountAfterFee - buyAmountBeforeFee;

  const sellAmountToSign =
    quote.kind === OrderQuoteSideKind.SELL
      ? sellAmountAfterFee
      : (sellAmountAfterFee * BigInt(Math.round((1 + slippage / 100) * 10000))) / 10000n;

  const buyAmountToSign =
    quote.kind === OrderQuoteSideKind.SELL
      ? (buyAmountBeforeFee * BigInt(Math.round((1 - slippage / 100) * 10000))) / 10000n
      : buyAmountBeforeFee;

  return {
    ...quoteData,
    quote: {
      ...quote,
      sellAmount: BigInt(quote.sellAmount),
      buyAmount: BigInt(quote.buyAmount),
      feeAmount: BigInt(quote.feeAmount),
      sellAmountBeforeFee,
      sellAmountAfterFee,
      buyAmountBeforeFee,
      buyAmountAfterFee,
      feeAmountInBuyToken,
      slippageTolerance: slippage,
      sellAmountToSign,
      buyAmountToSign
    }
  } as OrderQuoteResponse;
};

export const useQuoteTrade = ({
  sellToken,
  buyToken,
  amount,
  kind,
  isEthFlow = false,
  isSmartContractWallet,
  slippage: paramSlippage,
  enabled: paramEnabled = true
}: {
  sellToken: `0x${string}` | undefined;
  buyToken: `0x${string}` | undefined;
  amount: bigint | undefined;
  kind: OrderQuoteSideKind;
  isEthFlow?: boolean;
  isSmartContractWallet: boolean;
  slippage: string;
  enabled?: boolean;
}): ReadHook & { data: OrderQuoteResponse | undefined | null } => {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);
  const { address } = useConnection();

  const enabled = paramEnabled && !!sellToken && !!buyToken && !!amount;
  const { slippage, ttl } = verifySlippageAndDeadline({
    slippage: paramSlippage,
    isEthFlow,
    isL2
  });

  const {
    data: quoteData,
    isLoading: isQuoteLoading,
    error: quoteError,
    refetch: mutateQuote
  } = useQuery({
    enabled,
    queryKey: [
      'quote-cow-trade',
      sellToken,
      buyToken,
      chainId,
      amount?.toString(),
      kind,
      address,
      slippage,
      isEthFlow
    ],
    queryFn: () =>
      getTradeQuote({
        chainId,
        sellToken: sellToken!,
        buyToken: buyToken!,
        amount: amount!,
        kind,
        address: address!,
        ttl,
        slippage,
        isEthFlow,
        isSmartContractWallet
      }),
    refetchOnWindowFocus: false,
    // Invalidate quote after 2 minutes, which matches the expiration time of the quote
    gcTime: 2 * 60 * 1000,
    retry: (failureCount: number, error: Error) => {
      //don't retry if the error is because the sell amount does not cover the fee
      if (error.message?.includes('SellAmountDoesNotCoverFee')) {
        return false;
      }
      return failureCount < 2;
    }
  });

  return {
    data: quoteData,
    isLoading: isQuoteLoading,
    error: quoteError,
    mutate: mutateQuote,
    dataSources: [
      {
        title: 'CoW Protocol Order book API',
        href: 'https://docs.cow.fi/cow-protocol/reference/apis/orderbook',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
};
