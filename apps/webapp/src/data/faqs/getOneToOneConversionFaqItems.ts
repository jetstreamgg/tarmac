export const getOneToOneConversionFaqItems = () => {
  const items = [
    {
      question: 'What is 1:1 Conversion?',
      answer:
        '1:1 Conversion lets users convert between **USDC** and **USDS** at a fixed 1:1 rate through the Peg Stability Module [(PSM)](#tooltip-psm). Unlike a routed market trade, this flow uses protocol conversion infrastructure rather than price discovery across liquidity venues, which protects from slippage and MEV.',
      index: 0
    },
    {
      question: 'Is there slippage when using 1:1 Conversion?',
      answer:
        'No price slippage is applied in the 1:1 Conversion flow. When available, the conversion rate is fixed at **1 USDC = 1 USDS** and **1 USDS = 1 USDC**. You will still need to pay the applicable blockchain [gas fee](#tooltip-gas-fee) for submitting transactions.',
      index: 1
    },
    {
      question: 'Why might 1:1 Conversion be unavailable?',
      answer:
        'Availability depends on the network and the state of the relevant PSM contracts. For example, the flow can be unavailable if the mainnet wrapper is not live, if a conversion direction is halted, or if there is insufficient available USDC liquidity for **USDS -> USDC** conversions. The interface will block transaction execution when those conditions apply.',
      index: 2
    },
    {
      question: 'Which networks support 1:1 Conversion?',
      answer:
        "1:1 Conversion is available on Ethereum Mainnet and supported Layer 2 networks where Sky's PSM infrastructure is deployed. On Ethereum Mainnet, the flow uses the UsdsPsmWrapper. On supported L2s—including Base, Arbitrum, Optimism, and Unichain—the flow uses the PSM3 conversion contracts.",
      index: 3
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
