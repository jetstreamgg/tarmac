import { ReactNode, useMemo } from 'react';
import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import { productNetworks } from '@/hooks';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { SavingsDetailChart } from './SavingsDetailChart';

// sUSDS brand color (mirrors tokenColors['SUSDS'] in widgets/shared) — drives
// the title glow + padded outline.
const SUSDS_BRAND_COLOR = '#95DC89';

// TODO(T4): detail VALUES are placeholders — wire the real hooks (current/6M
// rate, TVL, users) and the <RiskMeter/>. Icons + labels are final.
const PLACEHOLDER = '–';

/**
 * Savings as the first ProductDetailTemplate consumer (C3 proof). Subsequent
 * tasks replace the placeholder slots: T2 chart, T3 position card + modal,
 * T4 detail values + risk meter, T5 about copy (corpus), T6 transactions.
 */
function SlotPlaceholder({ label, className }: { label: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'border-borderPrimary text-textSecondary flex min-h-[160px] items-center justify-center rounded-[20px] border border-dashed p-6 text-sm',
        className
      )}
    >
      {label}
    </div>
  );
}

export function SavingsProductDetail() {
  // The networks Savings is live on within the active family — scopes the
  // header's network switcher. Consumers bound to a contract address should
  // also pass that address map here, matching buildEarnProducts.
  const connectedChainId = useChainId();
  const networks = useMemo(
    () => productNetworks(Intent.SAVINGS_INTENT, getSupportedChainIds(connectedChainId)),
    [connectedChainId]
  );

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-4 w-4" />,
      label: <Trans>Current Rate</Trans>,
      value: PLACEHOLDER
    },
    {
      id: 'rate-6m',
      icon: <AudioLines className="h-4 w-4" />,
      label: <Trans>6M Rate</Trans>,
      value: PLACEHOLDER
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-4 w-4" />,
      label: <Trans>Risk scale</Trans>,
      value: PLACEHOLDER
    },
    { id: 'tvl', icon: <Vault className="h-4 w-4" />, label: <Trans>TVL</Trans>, value: PLACEHOLDER },
    {
      id: 'liquidity',
      icon: <Droplet className="h-4 w-4" />,
      label: <Trans>Liquidity</Trans>,
      value: <Trans>Unlimited</Trans>
    },
    {
      id: 'users',
      icon: <UsersRound className="h-4 w-4" />,
      label: <Trans>Users</Trans>,
      value: PLACEHOLDER
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon token={{ symbol: 'sUSDS' }} width={48} showChainIcon={false} className="h-12 w-12" />
        ),
        brandColor: SUSDS_BRAND_COLOR
      }}
      title={<Trans>Sky Savings</Trans>}
      networkSelector={<ChainModal chainIds={networks} dataTestId="product-detail-network" />}
      chart={<SavingsDetailChart />}
      position={<SlotPlaceholder label="My position — T3" className="min-h-[260px]" />}
      details={details}
      about={{
        body: (
          <Trans>
            sUSDS is a savings token for eligible Sky Protocol users. When you supply USDS to the Sky Savings
            Rate module of the Protocol, you access the Sky Savings Rate and receive sUSDS tokens. These sUSDS
            tokens serve as a digital record of your USDS interaction with the Sky Savings Rate module and any
            value accrued to your position.
          </Trans>
        ),
        learnMoreHref: 'https://docs.sky.money'
      }}
      transactions={<SlotPlaceholder label="Transactions — T6" />}
    />
  );
}
