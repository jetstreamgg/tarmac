import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ExternalLink, Search } from 'lucide-react';
import { BP, useBreakpointIndex, useStakeUserDelegates, useDebounce, ZERO_ADDRESS } from '@/hooks';
import { formatBigInt } from '@/utils';
import { cn } from '@/lib/cn';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { delegateProfileUrl } from '../lib/delegateProfileUrl';

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/**
 * The card body — search + single-select list. Lives in its own component so
 * the subgraph fetch only runs while the card is enabled (the card shell only
 * mounts children when open). Exported for the F5 manage sheet's Change
 * delegate card, which shares the exact list under its own testid prefix.
 */
export function DelegateList({
  selectedDelegate,
  onSelect,
  dataTestIdPrefix = 'stake-takeover-delegate'
}: {
  selectedDelegate: `0x${string}` | undefined;
  onSelect: (delegate: `0x${string}`) => void;
  dataTestIdPrefix?: string;
}) {
  const { address } = useConnection();
  const chainId = useChainId();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  // Legacy SelectDelegate arguments, verbatim (pageSize 100, random, sorted).
  const { data: delegates, isLoading } = useStakeUserDelegates({
    chainId,
    user: address || ZERO_ADDRESS,
    page: 1,
    pageSize: 100,
    random: true,
    search: debouncedSearch,
    selectedDelegate,
    shouldSortDelegates: true
  });

  return (
    <div className="flex flex-col gap-6 md:gap-4">
      <div className="border-textSecondary/20 flex items-center gap-2 border-b pb-3 md:pb-2">
        <Search className="text-textSecondary h-4 w-4 shrink-0" aria-hidden />
        <input
          type="text"
          value={search}
          placeholder={t`Search`}
          onChange={event => setSearch(event.target.value)}
          data-testid={`${dataTestIdPrefix}-search`}
          className="text-text placeholder:text-fgTertiary md:placeholder:text-textSecondary w-full bg-transparent text-sm leading-[22px] outline-none md:leading-5"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(row => (
            <Skeleton key={row} className="h-16 w-full rounded-2xl md:rounded-xl" />
          ))}
        </div>
      ) : !delegates || delegates.length === 0 ? (
        <p className="text-textSecondary py-6 text-center text-sm">
          <Trans>No delegates found</Trans>
        </p>
      ) : (
        <ul
          className="scrollbar-hidden md:scrollbar-thin-always flex max-h-96 flex-col gap-2 overflow-y-auto"
          data-testid={`${dataTestIdPrefix}-list`}
        >
          {delegates.map(delegate => {
            const isSelected = selectedDelegate?.toLowerCase() === delegate.id.toLowerCase();
            return (
              <li key={delegate.id}>
                <button
                  type="button"
                  onClick={() => onSelect(delegate.id)}
                  data-testid={`${dataTestIdPrefix}-${delegate.id.toLowerCase()}`}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors md:rounded-xl md:p-4',
                    // Comp 1222:19936: #504dff ring over the 10% brand gradient.
                    // Applied at every tier — the previous border-primary/
                    // bg-primary pair resolves to transparent in the dark scope,
                    // leaving desktop's selected row invisible.
                    isSelected
                      ? 'border-[#504dff] bg-linear-to-b from-[#949aff]/10 to-[#504dff]/10'
                      : 'border-borderPrimary md:bg-surfaceAlt/40 bg-transparent md:border-transparent'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CustomAvatar address={delegate.ownerAddress ?? delegate.id} size={isMobile ? 24 : 32} />
                    <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:leading-5 md:tracking-normal">
                      {delegate.metadata?.name || shortenAddress(delegate.id)}
                      <a
                        href={delegateProfileUrl(delegate.metadata?.externalProfileURL, delegate.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={event => event.stopPropagation()}
                        aria-label={t`View delegate profile`}
                        className="text-textSecondary hover:text-text"
                      >
                        <ExternalLink className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden />
                      </a>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-fgSecondary md:text-textSecondary text-xs leading-[18px] md:leading-4">
                      <Trans>Total delegated</Trans>
                    </span>
                    <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px] md:gap-1.5 md:font-sans md:leading-5 md:tracking-normal">
                      {formatBigInt(delegate.totalDelegated ?? 0n, { maxDecimals: 0 })}
                      <TokenIcon
                        token={{ symbol: 'SKY' }}
                        width={16}
                        className="h-3 w-3 md:h-4 md:w-4"
                        showChainIcon={false}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Card 3 · Delegate Voting Power (Optional): search + single-select delegate
 * list (hi-fi 486:32657 — selected row ringed). Toggle OFF is the default
 * (decision A-Q1); turning it off clears the selection via the reducer.
 */
export function StakeTakeoverDelegateCard({
  enabled,
  onEnabledChange,
  selectedDelegate,
  onSelect
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  selectedDelegate: `0x${string}` | undefined;
  onSelect: (delegate: `0x${string}`) => void;
}) {
  return (
    <StakeTakeoverCard
      step={3}
      title={<Trans>Delegate Voting Power</Trans>}
      optional
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      dataTestId="stake-takeover-delegate-card"
    >
      <DelegateList selectedDelegate={selectedDelegate} onSelect={onSelect} />
    </StakeTakeoverCard>
  );
}
