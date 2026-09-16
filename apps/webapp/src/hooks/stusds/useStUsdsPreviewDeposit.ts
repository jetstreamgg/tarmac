import { useStUsdsBigIntRead } from './useStUsdsBigIntRead';

export function useStUsdsPreviewDeposit(assets: bigint) {
  return useStUsdsBigIntRead('previewDeposit', assets);
}
