import { t } from '@lingui/core/macro';
import { InfoTooltip } from '@/components/InfoTooltip';
import { formatBigInt, WAD_PRECISION } from '@/utils';
import { useStakeOracleCap } from '../hooks/useStakeOracleCap';

export function stakeLtvTooltipCopy(cap: bigint | undefined): [string, string] {
  const bound =
    cap !== undefined && cap > 0n
      ? t`which never goes above $${formatBigInt(cap, { unit: WAD_PRECISION, maxDecimals: 4 })}`
      : t`which has a maximum value set by the protocol`;
  return [
    t`Your debt as a share of your collateral's value.`,
    t`Note: Collateral value is calculated using the capped SKY price, ${bound}. It’s sourced from the same Oracle which is used during the borrowing process.`
  ];
}

export function StakeLtvInfoTooltip() {
  const { data: cap } = useStakeOracleCap();
  return (
    <InfoTooltip
      title={t`Loan-to-value (LTV)`}
      iconSize={12}
      iconClassName="shrink-0"
      content={
        <>
          {stakeLtvTooltipCopy(cap).map(line => (
            <p key={line}>{line}</p>
          ))}
        </>
      }
    />
  );
}
