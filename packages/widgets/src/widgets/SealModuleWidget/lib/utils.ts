import { RiskLevel } from '@jetstreamgg/hooks';
import { normalizeAddress } from '@jetstreamgg/utils';
import { SealFlow, SealStep } from './constants';

const openFlowSequence = [
  SealStep.ABOUT,
  SealStep.OPEN_BORROW,
  SealStep.REWARDS,
  SealStep.DELEGATE,
  SealStep.SUMMARY
];

const manageFlowSequence = [SealStep.OPEN_BORROW, SealStep.REWARDS, SealStep.DELEGATE, SealStep.SUMMARY];

const migrateFlowSequence = [
  SealStep.ABOUT,
  SealStep.REWARDS,
  SealStep.DELEGATE,
  SealStep.SUMMARY,
  SealStep.HOPE_OLD,
  SealStep.MIGRATE
];

export function getPreviousStep(step: SealStep, flow: SealFlow = SealFlow.OPEN): SealStep {
  const sequence =
    flow === SealFlow.OPEN
      ? openFlowSequence
      : flow === SealFlow.MIGRATE
        ? migrateFlowSequence
        : manageFlowSequence;

  const currentIndex = sequence.indexOf(step);
  if (currentIndex > 0) {
    return sequence[currentIndex - 1];
  }
  return sequence[sequence.length - 1];
}

export function getNextStep(step: SealStep, flow: SealFlow = SealFlow.OPEN): SealStep {
  const sequence =
    flow === SealFlow.OPEN
      ? openFlowSequence
      : flow === SealFlow.MIGRATE
        ? migrateFlowSequence
        : manageFlowSequence;

  const currentIndex = sequence.indexOf(step);
  if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
    return sequence[currentIndex + 1];
  }
  return sequence[sequence.length - 1];
}

export function getStepIndex(step: SealStep, flow: SealFlow): number {
  const sequence =
    flow === SealFlow.OPEN
      ? openFlowSequence
      : flow === SealFlow.MIGRATE
        ? migrateFlowSequence
        : manageFlowSequence;
  const index = sequence.indexOf(step);
  return index !== -1 ? index : 0;
}

export function getTotalSteps(flow: SealFlow): number {
  const sequence =
    flow === SealFlow.OPEN
      ? openFlowSequence
      : flow === SealFlow.MIGRATE
        ? migrateFlowSequence
        : manageFlowSequence;
  return sequence.length;
}

// Positions are 0-indexed, add 1 to make it human readable
export function formatUrnIndex(index: bigint): string {
  return (index + 1n).toString();
}

export function getRiskTextColor(riskLevel = RiskLevel.LOW): string {
  const { LIQUIDATION, HIGH, MEDIUM } = RiskLevel;
  const riskTextColor = [LIQUIDATION, HIGH].includes(riskLevel)
    ? 'text-error'
    : riskLevel === MEDIUM
      ? 'text-orange-400'
      : 'text-green-400';
  return riskTextColor;
}

export function getCeilingTextColor(utilization = 0): string {
  const ceilingTextColor =
    utilization > 0.98 ? 'text-error' : utilization > 0.89 ? 'text-orange-400' : 'text-green-400';
  return ceilingTextColor;
}

export function needsRewardUpdate(
  urnAddress: `0x${string}` | undefined,
  selectedRewardContract: `0x${string}` | undefined,
  urnSelectedRewardContract: `0x${string}` | undefined
): boolean {
  const normalizedSelectedRewardContract = normalizeAddress(selectedRewardContract);
  const normalizedUrnSelectedRewardContract = normalizeAddress(urnSelectedRewardContract);

  // If it's a new URN (urnAddress is undefined), an update is needed if a reward contract is actually selected.
  if (!urnAddress) {
    return !!normalizedSelectedRewardContract;
  }

  // For existing URNs: update if normalized reward contract addresses (case-insensitive) differ.
  // Normalization treats undefined and ZERO_ADDRESS as "no reward contract".
  return normalizedSelectedRewardContract !== normalizedUrnSelectedRewardContract;
}

export function needsDelegateUpdate(
  urnAddress: `0x${string}` | undefined,
  selectedDelegate: `0x${string}` | undefined,
  urnSelectedVoteDelegate: `0x${string}` | undefined
): boolean {
  // Helper to normalize delegate: undefined or ZERO_ADDRESS means no delegate (represented as undefined)

  const normalizedSelectedDelegate = normalizeAddress(selectedDelegate);
  const normalizedUrnSelectedVoteDelegate = normalizeAddress(urnSelectedVoteDelegate);

  // If it's a new URN (urnAddress is undefined), an update is needed if a delegate is actually selected
  // (i.e., selectedDelegate is not undefined and not ZERO_ADDRESS).
  if (!urnAddress) {
    return !!normalizedSelectedDelegate;
  }

  // For existing URNs: update if normalized delegate addresses (case-insensitive) differ.
  // Normalization treats undefined and ZERO_ADDRESS as "no delegate".
  return normalizedSelectedDelegate !== normalizedUrnSelectedVoteDelegate;
}
