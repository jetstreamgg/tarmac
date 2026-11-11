import { useConnection } from 'wagmi';
import { cn } from '@/lib/cn';
import { USE_TESTNET_CONFIG } from '@/lib/constants';
import { chainEnvLabel, type ChainEnvTone } from './chainEnvLabel';

const SHOW_CHAIN_ENV_PILL = USE_TESTNET_CONFIG && import.meta.env.VITE_USE_MOCK_WALLET !== 'true';

const toneClasses: Record<ChainEnvTone, string> = {
  // Tenderly's brand purple (Vivid Purple on light, for contrast); no design token for it.
  fork: 'border-[#9273FF]/30 bg-[#9273FF]/10 text-[#9273FF] light:border-[#6837EE]/30 light:text-[#6837EE]',
  // A softer red than statusError, so production reads as a caution, not an error.
  production: 'border-red-300/30 bg-red-300/10 text-red-300 light:border-red-300/60 light:text-red-400',
  unconfigured: 'border-border bg-bgTertiary text-fgSecondary'
};

type ChainEnvPillProps = { className?: string };

/** Dev-config builds only: which chain the wallet is on, so a production chain is never mistaken for a fork. */
export function ChainEnvPill({ className }: ChainEnvPillProps) {
  const { chain, chainId } = useConnection();
  const pill = SHOW_CHAIN_ENV_PILL ? chainEnvLabel(chainId, chain !== undefined) : undefined;
  if (!pill) return null;

  return (
    <div
      data-testid="chain-env-pill"
      className={cn(
        // Top-left corner, in the strip above the header's logo, clear of the content and the mobile navbar.
        'pointer-events-none fixed top-0.5 left-2 z-40 flex',
        className
      )}
    >
      <span
        className={cn(
          'rounded-full border px-1.5 py-px text-[10px] leading-3 font-medium backdrop-blur-[50px]',
          toneClasses[pill.tone]
        )}
      >
        {pill.label}
      </span>
    </div>
  );
}
