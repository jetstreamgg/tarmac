export const getFixedYieldFaqItems = () => {
  const items = [
    {
      question: 'What is Fixed Yield, and how does it work?',
      answer:
        'Fixed Yield lets you set a fixed rate on your USDS until a specific maturity date through Pendle, a third-party yield-trading protocol. When you supply USDS, it is converted into PT-sUSDS, which you can redeem for a known amount of USDS on the maturity date. Your rate is set at the moment of supply and is delivered only if you hold your PT-sUSDS to or past maturity. If you sell your position early, you exit at the prevailing PT-sUSDS market price, which may make your realized return higher or lower than the initial fixed rate. Please see the [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for more information.',
      index: 0
    },
    {
      question: 'What is PT-sUSDS?',
      answer:
        'PT-sUSDS is a Principal Token from Pendle that grants the right to redeem underlying USDS on a set maturity date. When you supply USDS through Fixed Yield, it is converted into PT-sUSDS at a discounted price. This discount is the mechanism that delivers your fixed rate if you hold the token until maturity, when it becomes redeemable for its full USDS value.',
      index: 1
    },
    {
      question: 'What happens if I withdraw before maturity?',
      answer:
        'You can withdraw at any time, but early withdrawal requires selling PT-sUSDS on the Pendle market rather than redeeming it. The price depends on prevailing market conditions, so the realized rate may be higher or lower than the fixed rate locked in at supply. The advertised fixed rate is delivered only if PT-sUSDS is held to or past maturity.',
      index: 2
    },
    {
      question: 'What happens at and after maturity?',
      answer:
        "At maturity, your PT-sUSDS becomes fully redeemable for its full underlying USDS value, delivering the fixed rate you set when you supplied. You can redeem on or after this date. While waiting longer doesn't incur a penalty, your position stops earning any return once the maturity date has passed.",
      index: 3
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
