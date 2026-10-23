import { Trans } from '@lingui/react/macro';
import { InProgress, Cancel, Refresh } from '@/modules/icons';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { MinimizedTransactionToast } from '@/modules/ui/components/MinimizedTransactionToast';
import { TransactionNoticeToast } from '@/modules/ui/components/TransactionNoticeToast';
import { TransactionSuccessToast } from '@/modules/ui/components/TransactionSuccessToast';
import type { TxStatus } from '@/modules/ui/lib/txStatus';

const MINIMIZED_TOAST_ID = 'transaction-minimized';
const SUCCESS_TOAST_ID = 'transaction-success';
const ABANDONED_TOAST_ID = 'transaction-abandoned';
const PENDING_BLOCK_TOAST_ID = 'transaction-pending-block';

function notice(icon: React.ReactNode, title: React.ReactNode, description: React.ReactNode, id: string) {
  toastWithClose(() => <TransactionNoticeToast icon={icon} title={title} description={description} />, {
    id,
    duration: 8000
  });
}

// The dapp cannot dismiss a wallet's prompt: abandoning only stops the app listening.
export function notifyRequestAbandoned() {
  notice(
    <Cancel />,
    <Trans>Transaction request discarded</Trans>,
    <Trans>If your wallet still shows the request, reject it there.</Trans>,
    ABANDONED_TOAST_ID
  );
}

export function notifySignatureRequestAbandoned() {
  notice(
    <Cancel />,
    <Trans>Signature request discarded</Trans>,
    <Trans>If your wallet still shows the request, reject it there.</Trans>,
    ABANDONED_TOAST_ID
  );
}

export function notifyClosedOnChainChange() {
  notice(
    <Cancel />,
    <Trans>Transaction closed</Trans>,
    <Trans>Your wallet switched networks. Start again on the network you want to use.</Trans>,
    ABANDONED_TOAST_ID
  );
}

export function notifyReviewAgainOnChainChange() {
  notice(
    <Cancel />,
    <Trans>Network changed</Trans>,
    <Trans>Your wallet switched networks while confirming. Review the details and confirm again.</Trans>,
    ABANDONED_TOAST_ID
  );
}

export function notifyPendingBlock() {
  notice(
    <InProgress />,
    <Trans>Transaction in progress</Trans>,
    <Trans>It needs to finish before you can start a new one.</Trans>,
    PENDING_BLOCK_TOAST_ID
  );
}

const DISPATCH_REFUSAL_COPY = {
  calls: () => ({
    icon: <Refresh />,
    title: <Trans>Transaction details changed</Trans>,
    description: <Trans>The details changed while you were confirming. Review them and confirm again.</Trans>,
    closedDescription: (
      <Trans>The details changed while you were confirming. Start again to see the current details.</Trans>
    )
  }),
  account: () => ({
    icon: <Refresh />,
    title: <Trans>Account changed</Trans>,
    description: (
      <Trans>Your wallet switched accounts while confirming. Review the details and confirm again.</Trans>
    ),
    closedDescription: (
      <Trans>Your wallet switched accounts. Start again from the account you want to use.</Trans>
    )
  }),
  disconnect: () => ({
    icon: <Cancel />,
    title: <Trans>Wallet disconnected</Trans>,
    description: <Trans>Your wallet disconnected while confirming. Reconnect and confirm again.</Trans>,
    closedDescription: <Trans>Your wallet disconnected. Reconnect and start again.</Trans>
  })
};

export type DispatchRefusal = keyof typeof DISPATCH_REFUSAL_COPY;

// `closed`: the modal closed instead of returning to the review.
export function notifyDispatchRefused(reason: DispatchRefusal, closed: boolean) {
  toastWithClose(
    () => {
      const copy = DISPATCH_REFUSAL_COPY[reason]();
      return closed ? (
        <TransactionNoticeToast
          icon={<Cancel />}
          title={<Trans>Transaction closed</Trans>}
          description={copy.closedDescription}
        />
      ) : (
        <TransactionNoticeToast icon={copy.icon} title={copy.title} description={copy.description} />
      );
    },
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

export function notifySuccess(title: string, hash: string | undefined, href: string | undefined) {
  toast.dismiss(MINIMIZED_TOAST_ID);
  toastWithClose(() => <TransactionSuccessToast title={title} hash={hash} href={href} />, {
    id: SUCCESS_TOAST_ID,
    duration: 10000
  });
}

export function showMinimizedToast({
  status,
  title,
  hash,
  inFlight,
  onView
}: {
  status: TxStatus;
  title: string;
  hash: string | undefined;
  inFlight: boolean;
  onView: () => void;
}) {
  toastWithClose(
    () => <MinimizedTransactionToast status={status} title={title} hash={hash} onView={onView} />,
    {
      id: MINIMIZED_TOAST_ID,
      duration: inFlight ? Infinity : 10000
    }
  );
}

export function dismissMinimizedToast() {
  toast.dismiss(MINIMIZED_TOAST_ID);
}
