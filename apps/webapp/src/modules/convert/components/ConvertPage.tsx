import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useConvertForm } from '../hooks/useConvertForm';
import { useConvertLaunch } from '../hooks/useConvertLaunch';
import type { PsmConversionDisabledReason } from '../hooks/usePsmConversion.helpers';
import { ConvertCard } from './ConvertCard';

// Same copy as the legacy PsmConversionWidget — the engine's guard reasons are
// unchanged, so the user-facing explanations carry over verbatim.
const getDisabledReasonText = (reason?: PsmConversionDisabledReason, targetTokenSymbol?: string) => {
  switch (reason) {
    case 'unsupported_chain':
      return t`This conversion is not available on the current network.`;
    case 'amount_too_small':
      return t`Enter a larger amount to continue.`;
    case 'psm_unavailable':
      return t`The mainnet Peg Stability Module is currently unavailable.`;
    case 'direction_halted':
      return t`This conversion direction is temporarily halted on mainnet.`;
    case 'non_zero_fee':
      return t`Mainnet wrapper fees are active right now, so this flow is temporarily disabled.`;
    case 'insufficient_liquidity':
      return t`Insufficient ${targetTokenSymbol || ''} liquidity`;
    default:
      return undefined;
  }
};

function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-glassBadge rounded-full px-3 py-1.5 backdrop-blur-[20px]">
      <Text className="text-text text-xs font-medium">{children}</Text>
    </span>
  );
}

/**
 * The /convert destination (E2): a full-width page-as-widget PSM swap surface
 * (Figma 486:31193). The form lives on the page; Review launches the shared
 * transaction modal via `useConvertLaunch` (review → confirm-in-wallet → status).
 * PSM 1:1 USDC↔USDS only — CoW trading returns in E3 on the async-order contract.
 */
export function ConvertPage() {
  const form = useConvertForm();
  const { launch, conversion } = useConvertLaunch({
    direction: form.direction,
    amount: form.amount,
    onSuccess: () => {
      form.mutateBalances();
      form.reset();
    }
  });
  const launchOrConnect = useConnectThenAct(launch);

  const disabledReasonText = getDisabledReasonText(conversion.disabledReason, conversion.targetToken?.symbol);
  const reviewDisabled =
    form.isConnected && (form.isZero || form.insufficient || !!conversion.disabledReason);

  return (
    <div className="flex w-full flex-col items-center gap-8 py-4 md:py-14" data-testid="convert-page">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <HeroBadge>
            <Trans>1:1 Exchange rate</Trans>
          </HeroBadge>
          <HeroBadge>
            <Trans>$0.00 Fees paid</Trans>
          </HeroBadge>
        </div>
        <Heading tag="h1" variant="large">
          <Trans>Convert stablecoins</Trans>
        </Heading>
        <Text className="text-textSecondary max-w-md text-sm">
          <Trans>
            Move between stablecoins with confidence. Conversions settle at a fixed 1:1 rate, with no fees and
            no slippage.
          </Trans>
        </Text>
      </div>

      {/* Form column: the middle 6 columns of the design grid (624px @1280)
          minus 48px breathing room each side, per the Convert mock. */}
      <div className="flex w-full max-w-[528px] flex-col gap-4">
        <ConvertCard form={form} />

        {form.insufficient && (
          <Text className="text-error text-sm" dataTestId="convert-error">
            <Trans>Insufficient funds</Trans>
          </Text>
        )}
        {!form.insufficient && disabledReasonText && (
          <Text className="text-error text-sm" dataTestId="convert-error">
            {disabledReasonText}
          </Text>
        )}

        <Button
          variant="primary"
          className="w-full"
          disabled={reviewDisabled}
          onClick={launchOrConnect}
          data-testid="convert-review-cta"
        >
          <Trans>Review</Trans>
        </Button>
      </div>
    </div>
  );
}
