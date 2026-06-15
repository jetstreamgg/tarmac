import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import { productNetworks, useOverallSkyData, useSkySavingsRateHistoricData } from '@/hooks';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { RiskMeter } from '@/components/product/RiskMeter';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { SavingsDetailChart } from './SavingsDetailChart';
import { SavingsPositionCard } from './SavingsPositionCard';
import { SavingsFaq } from './SavingsFaq';
import { SavingsTransactionsTable } from './SavingsTransactionsTable';

// sUSDS brand color (mirrors tokenColors['SUSDS'] in widgets/shared) — drives
// the title glow + padded outline.
const SUSDS_BRAND_COLOR = '#95DC89';

const NO_VALUE = '–';

// FAQs exist in today's detail panes but are absent from the C3 wireframe.
// 🔶 If design confirms they survive on V2 detail pages, flip this to render the
// corpus-fed accordion in the template's optional FAQs slot.
const SHOW_FAQS = false;

/** Corpus-fed FAQs wrapped with a section heading for the template's FAQs slot. */
function SavingsFaqsSection() {
  return (
    <section className="flex flex-col gap-4" data-testid="product-detail-faqs">
      <h2 className="text-text font-circle text-lg">
        <Trans>FAQs</Trans>
      </h2>
      <SavingsFaq />
    </section>
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

  const { data: overall } = useOverallSkyData();
  // "6M Rate" = trailing 6-month average APY. 🔶 confirm semantics with design
  // (trailing average vs forward estimate vs rate-as-of-6-months-ago).
  const { data: rateHistoric } = useSkySavingsRateHistoricData({ daysAgo: 180 });

  const currentRate = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;
  const sixMonthRate = useMemo(() => {
    if (!rateHistoric || rateHistoric.length === 0) return NO_VALUE;
    const avg = rateHistoric.reduce((sum, d) => sum + parseFloat(d.rate), 0) / rateHistoric.length;
    return formatDecimalPercentage(avg);
  }, [rateHistoric]);
  const tvl = overall?.skySavingsRateTvl
    ? `$${formatNumber(parseFloat(overall.skySavingsRateTvl))}`
    : NO_VALUE;
  const users = overall?.ssrSuppliers ? formatNumber(overall.ssrSuppliers) : NO_VALUE;

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-4 w-4" />,
      label: <Trans>Current Rate</Trans>,
      value: currentRate
    },
    {
      id: 'rate-6m',
      icon: <AudioLines className="h-4 w-4" />,
      label: <Trans>6M Rate</Trans>,
      value: sixMonthRate
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-4 w-4" />,
      label: <Trans>Risk scale</Trans>,
      // Matches the C3 design (1 green segment = low). 🔶 BL-07: the registry
      // hardcodes 'moderate' for every product — reconcile when risk ratings
      // get a real source.
      value: <RiskMeter tier="low" />
    },
    { id: 'tvl', icon: <Vault className="h-4 w-4" />, label: <Trans>TVL</Trans>, value: tvl },
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
      value: users
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
      position={<SavingsPositionCard />}
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
      transactions={<SavingsTransactionsTable />}
      faqs={SHOW_FAQS ? <SavingsFaqsSection /> : undefined}
    />
  );
}
