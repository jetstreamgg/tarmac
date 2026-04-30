import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Text } from '@widgets/shared/components/ui/Typography';
import { motion, AnimatePresence } from 'motion/react';

type PendleRoutingDisclosureProps = {
  routerAddress: `0x${string}`;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const PendleRoutingDisclosure = ({
  routerAddress,
  onExternalLinkClicked
}: PendleRoutingDisclosureProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="text-textSecondary hover:text-text inline-flex items-center gap-1 text-xs transition-colors"
        data-testid="pendle-routing-disclosure-toggle"
        aria-expanded={open}
      >
        <Trans>Routed via Pendle ·</Trans>{' '}
        <span className="underline">
          {open ? <Trans>hide details</Trans> : <Trans>see details</Trans>}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-container/40 mt-3 rounded-xl p-3 text-left">
              <Text variant="small" className="text-textSecondary">
                <Trans>
                  This trade is routed through Pendle&apos;s Router V4 contract. We pin the router address
                  ({routerAddress.slice(0, 6)}…{routerAddress.slice(-4)}), rebuild the call from values we
                  control (receiver, market, amounts, slippage), and force the optional aggregator and
                  limit-order fields to empty before signing — so a compromised quote cannot redirect funds
                  or fill malicious orders.
                </Trans>
              </Text>
              <Text variant="small" className="text-textSecondary mt-2">
                <a
                  href={`https://etherscan.io/address/${routerAddress}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-text underline"
                  onClick={onExternalLinkClicked}
                >
                  <Trans>View Pendle Router on Etherscan</Trans>
                </a>
              </Text>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
