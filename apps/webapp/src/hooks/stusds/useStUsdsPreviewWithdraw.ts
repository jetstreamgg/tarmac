import { keepPreviousData } from '@tanstack/react-query';
import { useStUsdsBigIntRead } from './useStUsdsBigIntRead';

export function useStUsdsPreviewWithdraw(assets: bigint) {
  return useStUsdsBigIntRead('previewWithdraw', assets, {
    // The amount re-keys this read on every live-max drift (~15s on a Curve
    // withdraw); without a placeholder each drift drops `data` and pulses
    // `isLoading` for a round trip, greying out Confirm from the review
    // screen and degrading the native rate to the 0n stub mid-refetch.
    placeholderData: keepPreviousData
  });
}
