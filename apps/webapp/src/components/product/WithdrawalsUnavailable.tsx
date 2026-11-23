import type { MouseEvent, ReactNode } from 'react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Info, MoveUpRight, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { InfoTooltip } from '@/components/InfoTooltip';

/**
 * Warnings for a product whose supplied liquidity is fully lent out (100%
 * utilization): stUSDS and the Risk Capital vaults. Copy is verbatim from the
 * comms brief ("Communication Scenarios"); each surface renders only while
 * `withdrawalsUnavailableFor` / the `use*WithdrawalsUnavailable` hooks say so,
 * so everything clears on its own once liquidity returns.
 */

/** The review-grid Withdrawals cell while liquidity is exhausted. */
export const WITHDRAWALS_UNAVAILABLE_WORDING = msg`Currently unavailable (100% utilization)`;

const stopClick = (event: MouseEvent) => event.stopPropagation();

function UnderstandTheRisksLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopClick}
      className={cn(
        'text-fgPrimary focus-visible:ring-focusRing inline-flex items-center gap-0.5 rounded-xs font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-hidden',
        className
      )}
    >
      <Trans>Understand the risks</Trans>
      <MoveUpRight size={12} aria-hidden />
    </a>
  );
}

/**
 * Warning triangle beside a product name in the Earn table (Morpho's vault-list
 * treatment). Clicks stay off the row so tapping it doesn't open the product.
 */
export function WithdrawalsUnavailableBadge({ assetSymbol }: { assetSymbol: string }) {
  return (
    <span onClick={stopClick} className="inline-flex" data-testid="withdrawals-unavailable-badge">
      <InfoTooltip
        title={<Trans>1 active warning</Trans>}
        content={
          <Trans>
            This vault currently has 0% of its {assetSymbol} available for instant withdrawal. You won&apos;t
            be able to exit your position immediately. Make sure you understand the risks before you supply
            funds.
          </Trans>
        }
        trigger={
          <button
            type="button"
            aria-label="Withdrawals unavailable"
            className="text-statusWarning focus-visible:ring-focusRing inline-flex shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-hidden"
          >
            <TriangleAlert className="size-4" aria-hidden />
          </button>
        }
      />
    </span>
  );
}

/**
 * The supply card's callout, between the blurb and the rate: the product is
 * fully lent out, with a link to the user-risks page.
 */
export function WithdrawalsUnavailableNotice({
  assetSymbol,
  risksHref
}: {
  assetSymbol: string;
  /** The product's section of the user risks doc. */
  risksHref: string;
}) {
  return (
    <div
      className="bg-statusWarningBg border-statusWarningBorder flex items-start gap-2 rounded-lg border px-3 py-2"
      data-testid="withdrawals-unavailable-notice"
    >
      <TriangleAlert className="text-statusWarning mt-[3px] size-4 shrink-0" aria-hidden />
      <p className="text-fgSecondary text-xs leading-[18px]">
        <Trans>
          Withdrawals are currently unavailable: all the {assetSymbol} supplied is lent out without a due date
          (100% utilization).
        </Trans>{' '}
        <UnderstandTheRisksLink href={risksHref} />
      </p>
    </div>
  );
}

/** Info glyph with the red attention dot the brief asks for beside rate and liquidity figures. */
function AlertInfoTooltip({ content, testId }: { content: ReactNode; testId: string }) {
  return (
    <InfoTooltip
      content={content}
      trigger={
        <button
          type="button"
          aria-label="Show additional information"
          data-testid={testId}
          className="text-fgSecondary focus-visible:ring-focusRing relative z-10 inline-flex shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <Info className="size-3" aria-hidden />
          <span className="bg-statusError absolute -top-0.5 -right-0.5 size-1.5 rounded-full" aria-hidden />
        </button>
      }
    />
  );
}

/** Replaces the rate explainer while utilization is at 100%: why the rate is so high. */
export function HighRateInfo({ assetSymbol }: { assetSymbol: string }) {
  return (
    <AlertInfoTooltip
      testId="withdrawals-unavailable-rate-info"
      content={
        <Trans>
          This rate is high because utilization is at 100%. It is designed to incentivize borrowers to repay
          their loan. Repayments (as well as any new deposits) free up {assetSymbol} to withdraw by suppliers.
        </Trans>
      }
    />
  );
}

/** Beside the Liquidity figure while utilization is at 100%. */
export function NoLiquidityInfo({
  assetSymbol,
  risksHref
}: {
  assetSymbol: string;
  /** The product's section of the user risks doc. */
  risksHref: string;
}) {
  return (
    <AlertInfoTooltip
      testId="withdrawals-unavailable-liquidity-info"
      content={
        <>
          <Trans>
            Withdrawals are currently unavailable: all the {assetSymbol} supplied is lent out (100%
            utilization).
          </Trans>{' '}
          <UnderstandTheRisksLink href={risksHref} />
        </>
      }
    />
  );
}

/** Supply modal callout, on the entry screen and again on the review before signing. */
export function WithdrawalsUnavailableDepositNotice({
  assetSymbol,
  testId
}: {
  assetSymbol: string;
  testId: string;
}) {
  return (
    <div
      className="bg-statusWarningBg border-statusWarningBorder flex w-full items-start gap-2 rounded-lg border px-3 py-2"
      data-testid={testId}
    >
      <TriangleAlert className="text-statusWarning mt-[3px] size-4 shrink-0" aria-hidden />
      <p className="text-fgPrimary text-xs leading-[18px]">
        <Trans>
          Withdrawals are currently unavailable (100% utilization). If you supply {assetSymbol} now, you
          won&apos;t be able to withdraw for an unknown period.
        </Trans>
      </p>
    </div>
  );
}
