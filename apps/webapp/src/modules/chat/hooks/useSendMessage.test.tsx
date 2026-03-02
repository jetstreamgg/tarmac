import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ensureIntentHasNetwork,
  hasPreFillParameters,
  isChatIntentAllowed,
  processNetworkNameInUrl,
  rewriteChatbotTradeUpgradeIntent
} from '../lib/intentUtils';
import { ChatIntent } from '../types/Chat';

/**
 * Integration tests for useSendMessage filtering logic
 *
 * These tests verify that the filtering logic correctly removes intents
 * with pre-fill parameters when CHATBOT_DISABLE_PREFILL is enabled.
 *
 * Note: Full hook testing would require mocking React Query, Wagmi hooks,
 * and the chat context. These tests focus on the filtering logic integration.
 */

describe('useSendMessage - Intent Filtering Integration', () => {
  afterEach(() => {
    // Restore original env
    vi.unstubAllEnvs();
  });

  describe('filter logic behavior', () => {
    it('should filter out intents with pre-fill parameters when flag is enabled', () => {
      // Mock flag enabled (default behavior)
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 100 USDS',
          url: '?widget=savings&input_amount=100&source_token=USDS',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Go to Savings',
          url: '?widget=savings&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        },
        {
          title: 'Trade DAI',
          url: '?widget=trade&source_token=DAI',
          intent_id: 'trade',
          widget: 'trade',
          priority: 3
        }
      ];

      // Simulate the filter logic from useSendMessage
      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(1);
      expect(filteredIntents[0].title).toBe('Go to Savings');
      expect(filteredIntents[0].url).toBe('?widget=savings&network=ethereum');
    });

    it('should keep all intents when flag is disabled', () => {
      // Mock flag disabled
      const CHATBOT_DISABLE_PREFILL = false;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 100 USDS',
          url: '?widget=savings&input_amount=100&source_token=USDS',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Go to Savings',
          url: '?widget=savings&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        },
        {
          title: 'Trade DAI',
          url: '?widget=trade&source_token=DAI',
          intent_id: 'trade',
          widget: 'trade',
          priority: 3
        }
      ];

      // Simulate the filter logic from useSendMessage
      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(3);
      expect(filteredIntents.map(i => i.title)).toEqual(['Supply 100 USDS', 'Go to Savings', 'Trade DAI']);
    });

    it('should preserve intent order after filtering', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'First Navigation',
          url: '?widget=balances',
          intent_id: 'balances',
          widget: 'balances',
          priority: 1
        },
        {
          title: 'Filtered Intent',
          url: '?widget=trade&input_amount=100',
          intent_id: 'trade',
          widget: 'trade',
          priority: 2
        },
        {
          title: 'Second Navigation',
          url: '?widget=rewards',
          intent_id: 'rewards',
          widget: 'rewards',
          priority: 3
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(2);
      expect(filteredIntents[0].title).toBe('First Navigation');
      expect(filteredIntents[1].title).toBe('Second Navigation');
      expect(filteredIntents[0].priority).toBeLessThan(filteredIntents[1].priority);
    });

    it('should handle empty intent arrays', () => {
      const CHATBOT_DISABLE_PREFILL = true;
      const intents: ChatIntent[] = [];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(0);
    });

    it('should handle arrays with all intents filtered', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 100 USDS',
          url: '?widget=savings&input_amount=100',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Trade DAI',
          url: '?widget=trade&source_token=DAI',
          intent_id: 'trade',
          widget: 'trade',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(0);
    });

    it('should handle arrays with no intents to filter', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'View Balances',
          url: '?widget=balances',
          intent_id: 'balances',
          widget: 'balances',
          priority: 1
        },
        {
          title: 'Check Rewards',
          url: '?widget=rewards&network=ethereum',
          intent_id: 'rewards',
          widget: 'rewards',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(2);
      expect(filteredIntents).toEqual(intents);
    });
  });

  describe('filter chain integration', () => {
    it('should work correctly in a filter chain', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 100 USDS',
          url: '?widget=savings&input_amount=100',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Go to Savings',
          url: '?widget=savings',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        }
      ];

      // Simulate the full filter chain from useSendMessage
      const filteredIntents = intents
        // First filter: some other filter (simulated as passing all)
        .filter(() => true)
        // Second filter: pre-fill parameter filter
        .filter(intent => {
          return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
        });

      expect(filteredIntents).toHaveLength(1);
      expect(filteredIntents[0].title).toBe('Go to Savings');
    });

    it('should handle optional chaining correctly', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      // Simulate undefined intents (edge case)
      const intents = undefined;

      // This simulates the optional chaining used in useSendMessage
      const filteredIntents = (intents as ChatIntent[] | undefined)?.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toBeUndefined();
    });
  });

  describe('real-world backend response scenarios', () => {
    it('filters mixed intent types correctly', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      // Simulates a typical backend response with mixed intents
      const intents: ChatIntent[] = [
        {
          title: 'Supply 1000 USDS to Savings',
          url: '?widget=savings&input_amount=1000&source_token=USDS&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Supply 500 USDS to Savings',
          url: '?widget=savings&input_amount=500&source_token=USDS&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        },
        {
          title: 'Go to Savings on Ethereum',
          url: '?widget=savings&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 3
        },
        {
          title: 'Trade 100 DAI for USDS',
          url: '?widget=trade&input_amount=100&source_token=DAI&target_token=USDS',
          intent_id: 'trade',
          widget: 'trade',
          priority: 4
        },
        {
          title: 'Go to Trade',
          url: '?widget=trade&network=ethereum',
          intent_id: 'trade',
          widget: 'trade',
          priority: 5
        },
        {
          title: 'View Your Balances',
          url: '?widget=balances',
          intent_id: 'balances',
          widget: 'balances',
          priority: 6
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(3);
      expect(filteredIntents.map(i => i.title)).toEqual([
        'Go to Savings on Ethereum',
        'Go to Trade',
        'View Your Balances'
      ]);
    });

    it('handles backend response with only pre-fill intents', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 1000 USDS',
          url: '?widget=savings&input_amount=1000&source_token=USDS',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Supply 500 USDS',
          url: '?widget=savings&input_amount=500&source_token=USDS',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      // All intents should be filtered out
      expect(filteredIntents).toHaveLength(0);
    });

    it('handles backend response with no pre-fill intents', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'View Balances',
          url: '?widget=balances',
          intent_id: 'balances',
          widget: 'balances',
          priority: 1
        },
        {
          title: 'Check Rewards',
          url: '?widget=rewards',
          intent_id: 'rewards',
          widget: 'rewards',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      // All intents should remain
      expect(filteredIntents).toHaveLength(2);
      expect(filteredIntents).toEqual(intents);
    });
  });

  describe('filtering behavior validation', () => {
    it('ensures no amounts pass through when filtering is enabled', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Supply 100 USDS',
          url: '?widget=savings&input_amount=100',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        },
        {
          title: 'Supply USDS',
          url: '?widget=savings',
          intent_id: 'savings',
          widget: 'savings',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      // Verify no input_amount in any remaining intent
      filteredIntents.forEach(intent => {
        expect(intent.url).not.toContain('input_amount');
      });
    });

    it('ensures no token selections pass through when filtering is enabled', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Trade DAI to USDS',
          url: '?widget=trade&source_token=DAI&target_token=USDS',
          intent_id: 'trade',
          widget: 'trade',
          priority: 1
        },
        {
          title: 'Go to Trade',
          url: '?widget=trade',
          intent_id: 'trade',
          widget: 'trade',
          priority: 2
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      // Verify no token parameters in any remaining intent
      filteredIntents.forEach(intent => {
        expect(intent.url).not.toContain('source_token');
        expect(intent.url).not.toContain('target_token');
      });
    });

    it('allows navigation parameters through filtering', () => {
      const CHATBOT_DISABLE_PREFILL = true;

      const intents: ChatIntent[] = [
        {
          title: 'Go to Savings on Ethereum',
          url: '?widget=savings&network=ethereum&chat=true&details=false',
          intent_id: 'savings',
          widget: 'savings',
          priority: 1
        }
      ];

      const filteredIntents = intents.filter(intent => {
        return !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent);
      });

      expect(filteredIntents).toHaveLength(1);
      expect(filteredIntents[0].url).toContain('widget=savings');
      expect(filteredIntents[0].url).toContain('network=ethereum');
      expect(filteredIntents[0].url).toContain('chat=true');
    });
  });

  // TODO: Remove this section once the backend sends widget=convert natively
  describe('trade/upgrade → convert rewrite integration', () => {
    const CHATBOT_DISABLE_PREFILL = true;
    const runIntentPipeline = (intents: ChatIntent[], chainId = 1) =>
      intents
        .map(intent => {
          const processedUrl = processNetworkNameInUrl(intent.url);
          const urlWithNetwork = ensureIntentHasNetwork(processedUrl, chainId);
          return { ...intent, url: urlWithNetwork };
        })
        .filter(intent => isChatIntentAllowed(intent))
        .filter(intent => !CHATBOT_DISABLE_PREFILL || !hasPreFillParameters(intent))
        .map(rewriteChatbotTradeUpgradeIntent);

    it('rewrites trade intents to convert after validation', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Go to Trade',
          url: '?widget=trade&network=ethereum',
          intent_id: 'trade',
          widget: 'trade',
          priority: 1
        }
      ];

      const result = runIntentPipeline(intents);

      expect(result).toHaveLength(1);
      expect(result[0].widget).toBe('convert');
      const params = new URLSearchParams(result[0].url.split('?')[1]);
      expect(params.get('widget')).toBe('convert');
      expect(params.get('convert_module')).toBe('trade');
      expect(params.get('network')).toBe('ethereum');
    });

    it('rewrites upgrade intents to convert after validation', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Go to Upgrade',
          url: '?widget=upgrade&network=ethereum',
          intent_id: 'upgrade',
          widget: 'upgrade',
          priority: 1
        }
      ];

      const result = runIntentPipeline(intents);

      expect(result).toHaveLength(1);
      expect(result[0].widget).toBe('convert');
      const params = new URLSearchParams(result[0].url.split('?')[1]);
      expect(params.get('widget')).toBe('convert');
      expect(params.get('convert_module')).toBe('upgrade');
    });

    it('routes upgrade intents without a network to ethereum before rewriting on L2', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Go to Upgrade',
          url: '?widget=upgrade',
          intent_id: 'upgrade',
          widget: 'upgrade',
          priority: 1
        }
      ];

      const result = runIntentPipeline(intents, 8453);

      expect(result).toHaveLength(1);
      expect(result[0].widget).toBe('convert');
      const params = new URLSearchParams(result[0].url.split('?')[1]);
      expect(params.get('widget')).toBe('convert');
      expect(params.get('convert_module')).toBe('upgrade');
      expect(params.get('network')).toBe('ethereum');
    });

    it('filters out upgrade intents that explicitly target an L2', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Go to Upgrade',
          url: '?widget=upgrade&network=base',
          intent_id: 'upgrade',
          widget: 'upgrade',
          priority: 1
        }
      ];

      const result = runIntentPipeline(intents);

      expect(result).toHaveLength(0);
    });

    it('passes through backend convert URLs unchanged (forward-compatible)', () => {
      // Simulates the future backend response that sends widget=convert directly
      const intents: ChatIntent[] = [
        {
          title: 'Go to Convert (Trade)',
          url: '?widget=convert&convert_module=trade&network=ethereum',
          intent_id: 'convert',
          widget: 'convert',
          priority: 1
        },
        {
          title: 'Go to Convert (Upgrade)',
          url: '?widget=convert&convert_module=upgrade&network=ethereum',
          intent_id: 'convert',
          widget: 'convert',
          priority: 2
        }
      ];

      const result = runIntentPipeline(intents);

      expect(result).toHaveLength(2);
      expect(result[0].widget).toBe('convert');
      expect(result[1].widget).toBe('convert');
      const params0 = new URLSearchParams(result[0].url.split('?')[1]);
      expect(params0.get('convert_module')).toBe('trade');
      const params1 = new URLSearchParams(result[1].url.split('?')[1]);
      expect(params1.get('convert_module')).toBe('upgrade');
    });

    it('handles mixed response with trade, upgrade, and other widgets', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Go to Trade',
          url: '?widget=trade&network=ethereum',
          intent_id: 'trade',
          widget: 'trade',
          priority: 1
        },
        {
          title: 'Go to Upgrade',
          url: '?widget=upgrade&network=ethereum',
          intent_id: 'upgrade',
          widget: 'upgrade',
          priority: 2
        },
        {
          title: 'Go to Savings',
          url: '?widget=savings&network=ethereum',
          intent_id: 'savings',
          widget: 'savings',
          priority: 3
        },
        {
          title: 'View Balances',
          url: '?widget=balances',
          intent_id: 'balances',
          widget: 'balances',
          priority: 4
        }
      ];

      const result = runIntentPipeline(intents);

      expect(result).toHaveLength(4);
      // Trade and upgrade rewritten to convert
      expect(result[0].widget).toBe('convert');
      expect(new URLSearchParams(result[0].url.split('?')[1]).get('convert_module')).toBe('trade');
      expect(result[1].widget).toBe('convert');
      expect(new URLSearchParams(result[1].url.split('?')[1]).get('convert_module')).toBe('upgrade');
      // Others unchanged
      expect(result[2].widget).toBe('savings');
      expect(result[3].widget).toBe('balances');
    });

    it('rewrite + prefill filter: filters out trade intents with prefill params', () => {
      const intents: ChatIntent[] = [
        {
          title: 'Trade 100 DAI for USDS',
          url: '?widget=trade&input_amount=100&source_token=DAI&target_token=USDS&network=ethereum',
          intent_id: 'trade',
          widget: 'trade',
          priority: 1
        },
        {
          title: 'Go to Trade',
          url: '?widget=trade&network=ethereum',
          intent_id: 'trade',
          widget: 'trade',
          priority: 2
        }
      ];

      const result = runIntentPipeline(intents);

      // Only the navigation intent survives prefill filtering
      expect(result).toHaveLength(1);
      expect(result[0].widget).toBe('convert');
      const params = new URLSearchParams(result[0].url.split('?')[1]);
      expect(params.get('widget')).toBe('convert');
      expect(params.get('convert_module')).toBe('trade');
      expect(params.has('input_amount')).toBe(false);
    });
  });
});
