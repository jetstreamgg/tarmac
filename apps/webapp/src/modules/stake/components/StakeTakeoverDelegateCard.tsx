import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ExternalLink, Search } from 'lucide-react';
import { useStakeUserDelegates, useDebounce, ZERO_ADDRESS } from '@/hooks';
import { formatBigInt } from '@/utils';
import { cn } from '@/lib/cn';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeTakeoverCard } from './StakeTakeoverCard';

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/**
 * The card body — search + single-select list. Lives in its own component so
 * the subgraph fetch only runs while the card is enabled (the card shell only
 * mounts children when open).
 */
function DelegateList({
  selectedDelegate,
  onSelect
}: {
  selectedDelegate: `0x${string}` | undefined;
  onSelect: (delegate: `0x${string}`) => void;
}) {
  const { address } = useConnection();
  const chainId = useChainId();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

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
    <div className="flex flex-col gap-4">
      <div className="border-textSecondary/20 flex items-center gap-2 border-b pb-2">
        <Search className="text-textSecondary h-4 w-4 shrink-0" aria-hidden />
        <input
          type="text"
          value={search}
          placeholder={t`Search`}
          onChange={event => setSearch(event.target.value)}
          data-testid="stake-takeover-delegate-search"
          className="text-text placeholder:text-textSecondary w-full bg-transparent text-sm outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(row => (
            <Skeleton key={row} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !delegates || delegates.length === 0 ? (
        <p className="text-textSecondary py-6 text-center text-sm">
          <Trans>No delegates found</Trans>
        </p>
      ) : (
        <ul
          className="flex max-h-96 flex-col gap-2 overflow-y-auto"
          data-testid="stake-takeover-delegate-list"
        >
          {delegates.map(delegate => {
            const isSelected = selectedDelegate?.toLowerCase() === delegate.id.toLowerCase();
            return (
              <li key={delegate.id}>
                <button
                  type="button"
                  onClick={() => onSelect(delegate.id)}
                  data-testid={`stake-takeover-delegate-${delegate.id.toLowerCase()}`}
                  aria-pressed={isSelected}
                  className={cn(
                    'bg-surfaceAlt/40 flex w-full items-center justify-between gap-4 rounded-xl border border-transparent p-4 text-left transition-colors',
                    isSelected && 'border-primary bg-primary/10'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CustomAvatar address={delegate.ownerAddress ?? delegate.id} size={32} />
                    <span className="text-text flex items-center gap-1.5 text-sm font-medium">
                      {delegate.metadata?.name || shortenAddress(delegate.id)}
                      <a
                        href={
                          delegate.metadata?.externalProfileURL ||
                          `https://vote.sky.money/address/${delegate.id.toLowerCase()}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={event => event.stopPropagation()}
                        aria-label={t`View delegate profile`}
                        className="text-textSecondary hover:text-text"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-textSecondary text-xs">
                      <Trans>Total delegated</Trans>
                    </span>
                    <span className="text-text flex items-center gap-1.5 text-sm font-medium">
                      {formatBigInt(delegate.totalDelegated ?? 0n, { maxDecimals: 0 })}
                      <TokenIcon
                        token={{ symbol: 'SKY' }}
                        width={16}
                        className="h-4 w-4"
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
