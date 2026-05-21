export const getFixedYieldFaqItems = () => {
  const items = [
    {
      question: 'What is Fixed Yield, and how does it work?',
      answer: `Fixed Yield allows you to lock in a fixed APY on USDS deposits until a set maturity date through Pendle, a third-party yield-trading protocol. When you supply USDS, it is converted into PT-sUSDS, which entitles you to redeem a known amount of USDS at the maturity date.

The yield is fixed at the moment you supply, regardless of how the Sky Savings Rate or PT-sUSDS market price changes afterward. The fixed APY is guaranteed only if you hold PT-sUSDS to or past maturity. You can withdraw at any time before maturity, but early withdrawal settles at the prevailing PT-sUSDS market price, so the realized yield may differ from the advertised fixed APY. Please see the [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for more information.`,
      index: 0
    },
    {
      question: 'What is PT-sUSDS?',
      answer:
        'PT-sUSDS is a Principal Token issued by Pendle that represents the right to redeem an underlying amount of USDS via sUSDS at a specific future maturity date. When you supply USDS through Fixed Yield, it is converted into PT-sUSDS at a discount to its redemption value — that discount is what produces the fixed APY when held to maturity. At maturity, each PT-sUSDS becomes redeemable for its full underlying USDS value.',
      index: 1
    },
    {
      question: 'What happens if I withdraw before maturity?',
      answer:
        'You can withdraw at any time, but early withdrawal requires selling PT-sUSDS on the Pendle market rather than redeeming it. The price depends on prevailing market conditions, so the realized APY may be higher or lower than the fixed APY locked in at supply. The advertised fixed APY is guaranteed only if PT-sUSDS is held to or past maturity.',
      index: 2
    },
    {
      question: 'What happens at and after maturity?',
      answer:
        'At maturity, each PT-sUSDS becomes redeemable for its full underlying USDS value, locking in the fixed APY advertised at the time of supply. You can redeem on or any time after the maturity date — there is no penalty for waiting, but PT-sUSDS does not accrue any additional yield once maturity has passed.',
      index: 3
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
