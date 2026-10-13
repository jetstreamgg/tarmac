import { RiskLevel } from '@/hooks';
import type { IconboxPositionTone } from '@/components/ui/iconbox';
import { useStakeRowVault } from './useStakeRowVault';
import type { StakeUserPosition } from './useStakeUserPositions';

const RISK_TONE: Record<RiskLevel, IconboxPositionTone> = {
  [RiskLevel.LOW]: 'success',
  [RiskLevel.MEDIUM]: 'warning',
  [RiskLevel.HIGH]: 'error',
  [RiskLevel.LIQUIDATION]: 'error'
};

// Iconbox colour follows liquidation risk; staking-only (or risk still loading) stays info.
export function useStakePositionTone(position: StakeUserPosition): IconboxPositionTone {
  const { data: vault } = useStakeRowVault(position);
  return position.usdsDebt > 0n && vault?.riskLevel ? RISK_TONE[vault.riskLevel] : 'info';
}
