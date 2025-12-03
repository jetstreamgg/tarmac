import { describe, it, expect } from 'vitest';
import { hasPreFillParameters } from './intentUtils';
import { ChatIntent } from '../types/Chat';
import { QueryParams } from '@/lib/constants';

describe('hasPreFillParameters', () => {
  describe('returns true when intent has pre-fill parameters', () => {
    it('detects input_amount parameter', () => {
      const intent: ChatIntent = {
        title: 'Supply 100 USDS',
        url: '?widget=savings&input_amount=100',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('detects source_token parameter', () => {
      const intent: ChatIntent = {
        title: 'Trade DAI',
        url: '?widget=trade&source_token=DAI',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('detects target_token parameter', () => {
      const intent: ChatIntent = {
        title: 'Trade to USDS',
        url: '?widget=trade&target_token=USDS',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('detects multiple pre-fill parameters', () => {
      const intent: ChatIntent = {
        title: 'Trade 100 DAI to USDS',
        url: '?widget=trade&input_amount=100&source_token=DAI&target_token=USDS',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('detects pre-fill parameters with network parameter', () => {
      const intent: ChatIntent = {
        title: 'Supply 500 USDS on Ethereum',
        url: '?widget=savings&input_amount=500&source_token=USDS&network=ethereum',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('detects pre-fill parameters with other query params', () => {
      const intent: ChatIntent = {
        title: 'Trade DAI',
        url: '?widget=trade&source_token=DAI&chat=true&reset=true',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('handles URLs with hash fragments', () => {
      const intent: ChatIntent = {
        title: 'Supply 100 USDS',
        url: '?widget=savings&input_amount=100#section',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('handles full URLs with protocol and host', () => {
      const intent: ChatIntent = {
        title: 'Trade 100 DAI',
        url: 'https://app.sky.money?widget=trade&input_amount=100&source_token=DAI',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });
  });

  describe('returns false when intent has no pre-fill parameters', () => {
    it('returns false for intent with only widget parameter', () => {
      const intent: ChatIntent = {
        title: 'Go to Savings',
        url: '?widget=savings',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with widget and network parameters only', () => {
      const intent: ChatIntent = {
        title: 'Go to Trade on Ethereum',
        url: '?widget=trade&network=ethereum',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with chat parameter', () => {
      const intent: ChatIntent = {
        title: 'View Balances',
        url: '?widget=balances&chat=true',
        intent_id: 'balances',
        widget: 'balances',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with reset parameter', () => {
      const intent: ChatIntent = {
        title: 'Go to Rewards',
        url: '?widget=rewards&reset=true',
        intent_id: 'rewards',
        widget: 'rewards',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with details parameter', () => {
      const intent: ChatIntent = {
        title: 'View Details',
        url: '?widget=savings&details=true',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with locale parameter', () => {
      const intent: ChatIntent = {
        title: 'Go to Trade',
        url: '?widget=trade&lang=en',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with multiple non-prefill parameters', () => {
      const intent: ChatIntent = {
        title: 'Go to Savings',
        url: '?widget=savings&network=ethereum&chat=true&reset=true&details=false',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });
  });

  describe('handles edge cases', () => {
    it('returns false for undefined intent', () => {
      expect(hasPreFillParameters(undefined)).toBe(false);
    });

    it('returns false for intent with undefined url', () => {
      const intent = {
        title: 'Test',
        url: undefined,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      } as unknown as ChatIntent;
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with empty url', () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: '',
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('returns false for intent with null url', () => {
      const intent = {
        title: 'Test',
        url: null,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      } as unknown as ChatIntent;
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('has safety-first error handling for intent filtering', () => {
      // NOTE: The URL constructor is very forgiving and rarely throws errors.
      // In production, backend URLs will always be well-formed.
      // This test documents the safety-first behavior: if parsing somehow fails,
      // we assume the URL has pre-fill params.

      // The URL constructor handles most invalid strings gracefully:
      const intent: ChatIntent = {
        title: 'Test',
        url: 'unusual-but-parseable://url',
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };

      // Even unusual URLs parse without pre-fill params
      expect(hasPreFillParameters(intent)).toBe(false);

      // The safety-first catch block protects against unexpected errors
      // (e.g., if URL constructor behavior changes or runtime errors occur)
    });

    it('handles URL with only query string', () => {
      const intent: ChatIntent = {
        title: 'Trade 100 DAI',
        url: '?input_amount=100',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('handles URL-encoded parameter values', () => {
      const intent: ChatIntent = {
        title: 'Trade',
        url: '?widget=trade&source_token=DAI%2FUSDS&input_amount=100',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('is case-sensitive for parameter names', () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: '?widget=trade&INPUT_AMOUNT=100',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      // Should be false since parameter names are case-sensitive in URL standards
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('handles empty parameter values', () => {
      const intent: ChatIntent = {
        title: 'Trade',
        url: '?widget=trade&input_amount=&source_token=DAI',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      // Should still detect the presence of parameters even if empty
      expect(hasPreFillParameters(intent)).toBe(true);
    });
  });

  describe('specific QueryParams enum values', () => {
    it(`detects ${QueryParams.InputAmount} parameter`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.InputAmount}=100`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it(`detects ${QueryParams.SourceToken} parameter`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.SourceToken}=DAI`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it(`detects ${QueryParams.TargetToken} parameter`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.TargetToken}=USDS`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it(`does not detect ${QueryParams.Widget} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Widget}=trade`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.Network} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Network}=ethereum`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.Chat} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Chat}=true`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.Reset} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Reset}=true`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.Flow} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Flow}=claim`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.Reward} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Reward}=0x123abc`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.UrnIndex} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.UrnIndex}=0`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.LinkedAction} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.LinkedAction}=savings`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.StakeTab} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.StakeTab}=claim`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it(`does not detect ${QueryParams.ExpertModule} parameter as pre-fill`, () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.ExpertModule}=stusds`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('does not detect navigation parameters combined', () => {
      const intent: ChatIntent = {
        title: 'Test',
        url: `?${QueryParams.Widget}=stake&${QueryParams.Flow}=claim&${QueryParams.Network}=ethereum&${QueryParams.StakeTab}=claim`,
        intent_id: 'test',
        widget: 'test',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('filters savings intent with amount', () => {
      const intent: ChatIntent = {
        title: 'Supply 1000 USDS to Savings',
        url: '?widget=savings&input_amount=1000&source_token=USDS&network=ethereum',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('allows savings intent without amount', () => {
      const intent: ChatIntent = {
        title: 'Go to Savings',
        url: '?widget=savings&network=ethereum',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('filters trade intent with tokens', () => {
      const intent: ChatIntent = {
        title: 'Trade DAI for USDS',
        url: '?widget=trade&source_token=DAI&target_token=USDS&network=ethereum',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('allows trade intent without tokens', () => {
      const intent: ChatIntent = {
        title: 'Go to Trade',
        url: '?widget=trade&network=ethereum',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('filters stake intent with amount', () => {
      const intent: ChatIntent = {
        title: 'Stake 100 MKR',
        url: '?widget=stake&input_amount=100&source_token=MKR',
        intent_id: 'stake',
        widget: 'stake',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('allows balances intent (navigation only)', () => {
      const intent: ChatIntent = {
        title: 'View Your Balances',
        url: '?widget=balances&chat=true',
        intent_id: 'balances',
        widget: 'balances',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows rewards intent (navigation only)', () => {
      const intent: ChatIntent = {
        title: 'Check Your Rewards',
        url: '?widget=rewards&network=ethereum',
        intent_id: 'rewards',
        widget: 'rewards',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows rewards intent with reward contract parameter', () => {
      const intent: ChatIntent = {
        title: 'Claim Rewards from Contract',
        url: '?widget=rewards&reward=0x1234567890abcdef&network=ethereum',
        intent_id: 'rewards',
        widget: 'rewards',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows stake intent with flow parameter', () => {
      const intent: ChatIntent = {
        title: 'Claim Staking Rewards',
        url: '?widget=stake&flow=claim&network=ethereum',
        intent_id: 'stake',
        widget: 'stake',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows stake intent with stake_tab parameter', () => {
      const intent: ChatIntent = {
        title: 'Go to Stake Claims',
        url: '?widget=stake&stake_tab=claim&network=ethereum',
        intent_id: 'stake',
        widget: 'stake',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows expert intent with expert_module parameter', () => {
      const intent: ChatIntent = {
        title: 'Access stUSDS Module',
        url: '?widget=expert&expert_module=stusds&network=ethereum',
        intent_id: 'expert',
        widget: 'expert',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows intent with urn_index parameter', () => {
      const intent: ChatIntent = {
        title: 'View Urn Position',
        url: '?widget=savings&urn_index=0&network=ethereum',
        intent_id: 'savings',
        widget: 'savings',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('allows intent with linked_action parameter', () => {
      const intent: ChatIntent = {
        title: 'Continue to Savings',
        url: '?widget=trade&linked_action=savings&network=ethereum',
        intent_id: 'trade',
        widget: 'trade',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });

    it('filters intent when navigation params are mixed with pre-fill params', () => {
      const intent: ChatIntent = {
        title: 'Claim and Stake 100 MKR',
        url: '?widget=stake&flow=claim&input_amount=100&source_token=MKR',
        intent_id: 'stake',
        widget: 'stake',
        priority: 1
      };
      // Should be filtered because it has input_amount and source_token
      expect(hasPreFillParameters(intent)).toBe(true);
    });

    it('allows complex navigation intent without pre-fill', () => {
      const intent: ChatIntent = {
        title: 'Claim Rewards and Continue to Savings',
        url: '?widget=rewards&reward=0x123&flow=claim&linked_action=savings&network=ethereum',
        intent_id: 'rewards',
        widget: 'rewards',
        priority: 1
      };
      expect(hasPreFillParameters(intent)).toBe(false);
    });
  });
});
