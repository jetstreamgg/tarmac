import { RiskLevel, ZERO_ADDRESS } from '@jetstreamgg/hooks';
import { ActivationFlow, ActivationStep } from './constants';

const openFlowSequence = [
  ActivationStep.ABOUT,
  ActivationStep.OPEN_BORROW,
  ActivationStep.REWARDS,
  ActivationStep.DELEGATE,
  ActivationStep.SUMMARY
];

const manageFlowSequence = [
  ActivationStep.OPEN_BORROW,
  ActivationStep.REWARDS,
  ActivationStep.DELEGATE,
  ActivationStep.SUMMARY
];

export function getPreviousStep(step: ActivationStep): ActivationStep {
  // TODO: This is for Open Flow, it should be different for Manage flow

  const currentIndex = openFlowSequence.indexOf(step);
  if (currentIndex > 0) {
    return openFlowSequence[currentIndex - 1];
  }
  return ActivationStep.ABOUT; // or handle the case when there's no previous action
}

export function getNextStep(step: ActivationStep): ActivationStep {
  const currentIndex = openFlowSequence.indexOf(step);
  if (currentIndex >= 0 && currentIndex < openFlowSequence.length - 1) {
    return openFlowSequence[currentIndex + 1];
  }
  return ActivationStep.SUMMARY; // or handle the case when there's no next action
}

export function getStepIndex(step: ActivationStep, flow: ActivationFlow): number {
  const sequence = flow === ActivationFlow.OPEN ? openFlowSequence : manageFlowSequence;
  const index = sequence.indexOf(step);
  return index !== -1 ? index : 0;
}

export function getTotalSteps(flow: ActivationFlow): number {
  const sequence = flow === ActivationFlow.OPEN ? openFlowSequence : manageFlowSequence;
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
) {
  // Determines if a reward contract update is needed:
  // - For a new URN: true if a reward contract is selected
  // - For an existing URN: true if the selected reward contract differs from the current one
  const needRewardContractUpdate =
    !!(!urnAddress && selectedRewardContract && selectedRewardContract !== ZERO_ADDRESS) ||
    (urnAddress && selectedRewardContract?.toLowerCase() !== urnSelectedRewardContract?.toLowerCase());

  return needRewardContractUpdate;
}

export function needsDelegateUpdate(
  urnAddress: `0x${string}` | undefined,
  selectedDelegate: `0x${string}` | undefined,
  urnSelectedVoteDelegate: `0x${string}` | undefined
) {
  // Determines if a delegate update is needed:
  // - For a new URN: true if a delegate is selected
  // - For an existing URN: true if the selected delegate differs from the current one
  const needDelegateUpdate =
    !!(!urnAddress && selectedDelegate && selectedDelegate !== ZERO_ADDRESS) ||
    (urnAddress && selectedDelegate?.toLowerCase() !== urnSelectedVoteDelegate?.toLowerCase());

  return needDelegateUpdate;
}
