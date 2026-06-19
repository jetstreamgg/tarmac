import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Morpho, Pendle } from '@/widgets';
import { formatDecimalPercentage, formatUsd, getChainIcon, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { GainValue } from '@/components/ui/GainValue';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { SuppliedPosition } from '../helpers/suppliedView';

// Outline-ring color keys the product family: Morpho vaults blue, Pendle fixed
// green, everything else (savings, rewards, stUSDS, Spark) a neutral gray.
const RING_MORPHO = '#2973FF';
const RING_PENDLE = '#1DD9BA';
const RING_DEFAULT = '#7E7E8F';

const isMorphoVault = (position: SuppliedPosition) =>
  position.kind === 'vault' && position.id.startsWith('vault-morpho');

const ringColor = (position: SuppliedPosition): string => {
  if (isMorphoVault(position)) return RING_MORPHO;
  if (position.kind === 'fixed') return RING_PENDLE;
  return RING_DEFAULT;
};

/**
 * One supplied position in the Portfolio carousel: ringed token icon, stacked
 * network badge, a 2×2 stats block and Supply/Manage actions. Presentational —
 * the caller owns each action (e.g. the savings card opens the supply modal in
 * place via `onSupply`; others route to the product page).
 */
export function PositionCard({
  position,
  onSupply,
  onManage
}: {
  position: SuppliedPosition;
  onSupply: () => void;
  onManage: () => void;
}) {
  const projected = projectAnnualEarnings(position.amountUsd, position.rate);

  return (
    <div
      className="bg-container flex flex-col gap-8 rounded-3xl border p-5 bg-blend-overlay backdrop-blur-[50px]"
      data-testid="position-card"
    >
      {/* Token icon with its family-colored outline ring + network badge */}
      <div className="flex items-start justify-between">
        <div className="rounded-full p-[3px]" style={{ border: `2px solid ${ringColor(position)}` }}>
          <TokenIcon
            token={{ symbol: position.tokenSymbol }}
            width={40}
            showChainIcon={false}
            className="h-10 w-10"
          />
        </div>
        <div className="flex -space-x-1.5" data-testid="position-card-networks">
          {position.chainIds.map(id => (
            <span key={id} className="ring-container inline-flex rounded-full ring-2">
              {getChainIcon(id, 'h-5 w-5')}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Text variant="large" tag="span" className="text-text text-2xl font-medium">
          {position.name}
        </Text>
        {isMorphoVault(position) && <Morpho className="h-3.5 w-3.5 rounded-sm" />}
        {position.kind === 'fixed' && (
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-white"
            style={{ backgroundColor: RING_PENDLE }}
          >
            <Pendle className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Stat
          label={<Trans>My position</Trans>}
          value={<span className="text-text text-lg font-medium">{formatUsd(position.amountUsd)}</span>}
        />
        <Stat
          label={<Trans>APY</Trans>}
          value={
            <span className="text-text text-lg font-medium">
              {formatDecimalPercentage(position.rate ?? 0)}
            </span>
          }
        />
        <Stat
          label={<Trans>1Y projected earnings</Trans>}
          value={<GainValue value={projected} className="text-lg font-medium" />}
        />
        {/* TODO(D1): Already earned needs a cost-basis source (no hook yet). */}
        <Stat
          label={<Trans>Already earned</Trans>}
          value={<span className="text-textSecondary text-lg font-medium">TODO</span>}
        />
      </div>

      <div className="mt-1 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onSupply} data-testid="position-card-supply">
          <Trans>Supply</Trans>
        </Button>
        <Button variant="outline" className="flex-1" onClick={onManage} data-testid="position-card-manage">
          <Trans>Manage</Trans>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {value}
    </div>
  );
}
