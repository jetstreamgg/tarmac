import { Trans } from '@lingui/react/macro';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';

/**
 * What bundling does, said once — the body copy shared by the badge's panel
 * (`BundleTogglePanel`) and the savings card (`BundleSavingsPromo`).
 *
 * The comps write the first sentence as "Approve + Supply run as one transaction", but
 * both surfaces render on nine flows: the bundle is Approve + Convert on /convert,
 * Approve + Upgrade on upgrade, and N claims with no approval at all on the two claim
 * modals. Naming the steps generically is the only phrasing that is true everywhere;
 * per-flow copy would have to come from each flow's `steps` and needs a design call.
 */
export function BundleExplainer() {
  return (
    <p className="text-fgSecondary text-xs leading-[18px]">
      <Trans>
        The steps of this transaction run as one. You sign once, and bundling saves you clicks and gas.
      </Trans>{' '}
      <ExternalLink
        href={BATCH_TX_LEGAL_NOTICE_URL}
        showIcon={false}
        className="text-fgPrimary hover:underline"
      >
        <Trans>Learn more</Trans>
      </ExternalLink>
    </p>
  );
}
