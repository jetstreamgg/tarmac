export type SuggestedAction = {
  label: string;
  input: string;
  tokens: string[];
  /** Wallet token symbol used to personalize amount. Omit for actions that don't depend on wallet balance. */
  sourceToken?: string;
  /** Default amount shown when wallet has no balance or is disconnected. */
  defaultAmount?: number;
  /** If true, exclude from the combined "all" list on the balances page. */
  hideFromAll?: boolean;
  /** Optional badge text shown next to the action label (e.g. "New"). */
  badge?: string;
  /** Rate key for dynamic rate substitution. The label or subtitle should contain {rate} placeholder. */
  rateKey?: 'vaults' | 'rewards' | 'savings' | 'stusds' | 'staking';
  /** Module key for displaying the module icon next to the action. */
  module?: string;
  /** Direct URL search params string for navigation (bypasses intent parser). */
  url?: string;
  /** Show a small Morpho icon next to the badge. */
  showMorphoIcon?: boolean;
  /** Secondary line shown below the label in card variants. Supports {rate} placeholder. */
  subtitle?: string;
};

/**
 * Suggested actions keyed by widget name (matching IntentMapping values).
 * Each action has a display label, the natural language input to parse, and token symbols for icons.
 * Actions with sourceToken + defaultAmount will have their amounts personalized based on wallet balance.
 */
export const SUGGESTED_ACTIONS: Record<string, SuggestedAction[]> = {
  savings: [
    {
      label: 'Deposit USDS and start earning',
      input: 'Deposit USDS into savings',
      tokens: ['USDS'],
      module: 'savings'
    }
  ],
  upgrade: [
    {
      label: 'Upgrade {amount} DAI to USDS',
      input: 'Upgrade {amount} DAI to USDS',
      tokens: ['DAI', 'USDS'],
      sourceToken: 'DAI',
      defaultAmount: 1000,
      module: 'upgrade'
    },
    {
      label: 'Revert {amount} USDS to DAI',
      input: 'Revert {amount} USDS back to DAI',
      tokens: ['USDS', 'DAI'],
      sourceToken: 'USDS',
      defaultAmount: 500,
      hideFromAll: true,
      module: 'upgrade'
    },
    {
      label: 'Upgrade {amount} MKR to SKY',
      input: 'Upgrade {amount} MKR to SKY',
      tokens: ['MKR', 'SKY'],
      sourceToken: 'MKR',
      defaultAmount: 10,
      module: 'upgrade'
    },
    {
      label: 'Revert {amount} SKY to MKR',
      input: 'Revert {amount} SKY to MKR',
      tokens: ['SKY', 'MKR'],
      sourceToken: 'SKY',
      defaultAmount: 24000,
      hideFromAll: true,
      module: 'upgrade'
    }
  ],
  rewards: [
    {
      label: 'Supply USDS and earn SKY rewards',
      input: 'Supply USDS to earn SKY rewards',
      tokens: ['USDS', 'SKY'],
      module: 'rewards'
    },
    {
      label: 'Supply USDS and earn SPK rewards',
      input: 'Supply USDS to earn SPK',
      tokens: ['USDS', 'SPK'],
      module: 'rewards'
    },
    {
      label: 'Supply USDS and earn CLE rewards',
      input: 'Supply USDS to earn CLE',
      tokens: ['USDS', 'CLE'],
      module: 'rewards'
    },
    {
      label: 'Claim all rewards',
      input: 'Claim all my rewards',
      tokens: ['SKY', 'SPK', 'CLE'],
      module: 'rewards'
    }
  ],
  stake: [
    {
      label: 'Open a new Staking position with SKY',
      input: 'Open a Staking position with 1000 SKY',
      tokens: ['SKY'],
      module: 'stake'
    },
    {
      label: 'Borrow or Repay USDS',
      input: 'Borrow 100 USDS against my stake',
      tokens: ['USDS'],
      module: 'stake'
    },
    {
      label: 'Update your Reward',
      input: 'Select reward farm for staking position',
      tokens: ['SKY'],
      module: 'stake'
    },
    {
      label: 'Update your Delegate',
      input: 'Set delegate for staking position',
      tokens: [],
      module: 'stake'
    }
  ],
  stusds: [
    {
      label: 'Deposit {amount} USDS',
      input: 'Deposit {amount} USDS into stUSDS',
      tokens: ['USDS'],
      sourceToken: 'USDS',
      defaultAmount: 500,
      module: 'stusds'
    }
  ],
  morpho: [
    {
      label: 'Deposit into USDS Risk Capital vault',
      input: 'Deposit 500 USDS into Morpho vault',
      tokens: ['USDS'],
      module: 'morpho'
    },
    {
      label: 'Deposit into USDS Flagship vault',
      input: 'Deposit 500 USDS into Morpho vault',
      tokens: ['USDS'],
      module: 'morpho'
    },
    {
      label: 'Deposit into USDC Risk Capital vault',
      input: 'Deposit 500 USDS into Morpho vault',
      tokens: ['USDC'],
      module: 'morpho'
    },
    {
      label: 'Deposit into USDT Risk Capital vault',
      input: 'Deposit 500 USDS into Morpho vault',
      tokens: ['USDT'],
      module: 'morpho'
    }
  ],
  stables: [
    {
      label: 'Vaults: USDS, USDT, USDC',
      input: 'Explore vaults',
      tokens: ['USDS', 'USDC', 'USDT'],
      rateKey: 'vaults',
      subtitle: 'Rates up to {rate}',
      module: 'morpho'
    },
    {
      label: 'Rewards and Points',
      input: 'Supply {amount} USDS to earn rewards',
      tokens: ['SKY', 'SPK', 'CLE'],
      sourceToken: 'USDS',
      defaultAmount: 500,
      rateKey: 'rewards',
      subtitle: 'Rates up to {rate}',
      module: 'rewards'
    },
    {
      label: 'Sky Savings Rate',
      input: '',
      tokens: ['sUSDS'],
      rateKey: 'savings',
      subtitle: 'Rate: {rate}',
      module: 'savings',
      url: '?widget=savings'
    },
    {
      label: 'For Experts: Earn with stUSDS',
      input: 'Deposit {amount} USDS into stUSDS',
      tokens: ['stUSDS'],
      sourceToken: 'USDS',
      defaultAmount: 500,
      rateKey: 'stusds',
      subtitle: 'Rate: {rate}',
      module: 'stusds'
    }
  ],
  sky: [
    {
      label: 'Stake and Earn with SKY',
      input: '',
      tokens: ['SKY'],
      rateKey: 'staking',
      subtitle: 'Rate: {rate}',
      module: 'stake',
      url: '?widget=stake'
    },
    {
      label: 'Borrow USDS',
      input: '',
      tokens: ['USDS'],
      module: 'stake',
      subtitle: 'Minimum borrow amount is 30K USDS',
      url: '?widget=stake'
    }
  ],
  tokens: [
    {
      label: 'Get USDS',
      input: '',
      tokens: ['USDS'],
      module: 'trade',
      url: '?widget=convert&convert_module=trade&target_token=USDS'
    },
    {
      label: 'Get SKY',
      input: '',
      tokens: ['SKY'],
      module: 'trade',
      url: '?widget=convert&convert_module=trade&target_token=SKY'
    },
    {
      label: 'Upgrade DAI to USDS',
      input: '',
      tokens: ['DAI', 'USDS'],
      module: 'upgrade',
      url: '?widget=convert&convert_module=upgrade&source_token=DAI'
    },
    {
      label: 'Upgrade MKR to SKY',
      input: '',
      tokens: ['MKR', 'SKY'],
      module: 'upgrade',
      url: '?widget=convert&convert_module=upgrade&source_token=MKR'
    }
  ]
};
