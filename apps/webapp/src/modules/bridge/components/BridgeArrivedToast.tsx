import { t } from '@lingui/core/macro';
import { ToastSuccessIcon } from '@/components/toast/ToastSuccessIcon';
import { toastWithClose } from '@/components/ui/use-toast';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Text } from '@/modules/layout/components/Typography';
import { formatAddress } from '@/utils';
import type { PendingBridge } from '../model/types';
import { bridgeArrivedMessage, bridgeTxHref } from './pendingBridgeRows';

type BridgeArrivedToastProps = {
  bridge: PendingBridge;
  account: string | undefined;
  /** The bridge is in the viewer's own list, the one Activity shows. */
  inActivity: boolean;
  familyChainId: number;
};

/** Figma 4232:64133. */
function BridgeArrivedToast({ bridge, account, inActivity, familyChainId }: BridgeArrivedToastProps) {
  const { txHash } = bridge;
  return (
    <div className="flex w-full items-center gap-3 pr-6" data-testid="bridge-arrived-toast">
      <span className="shrink-0">
        <ToastSuccessIcon />
      </span>
      <span className="flex flex-col gap-1">
        <Text className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          {t`Bridge arrived`}
        </Text>
        <span className="text-fgSecondary text-[11px] leading-4">
          {bridgeArrivedMessage(bridge, account, inActivity)}
          {txHash && (
            <>
              {' '}
              <ExternalLink
                href={bridgeTxHref(bridge.from, txHash, familyChainId)}
                showIcon={false}
                className="text-fgSecondary inline underline"
              >
                {formatAddress(txHash, 6, 4)}
              </ExternalLink>
            </>
          )}
        </span>
      </span>
    </div>
  );
}

/** One per bridge: the same bridge in two lists of this browser tells the user once. */
export function notifyBridgeArrived(props: BridgeArrivedToastProps) {
  toastWithClose(() => <BridgeArrivedToast {...props} />, {
    id: `bridge-arrived-${props.bridge.id}`,
    duration: 10000
  });
}
