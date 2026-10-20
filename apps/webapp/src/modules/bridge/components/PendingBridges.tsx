import { Fragment, useState, type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { LinkExternal } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useClipboard } from '@/modules/ui/hooks/useClipboard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { pendingClaimLink } from '../adapters/cctp/claimLink';
import { useCctpConvertOffer } from '../hooks/useCctpConvertOffer';
import { useCctpResumeForm, type CctpResumeBlockReason } from '../hooks/useCctpResumeForm';
import type { DestinationActionHint } from '../hooks/useDestinationActionLaunch';
import { useIncomingCctpBridges } from '../hooks/useIncomingCctpBridges';
import { usePendingBridges } from '../hooks/usePendingBridges';
import { usePendingScope } from '../hooks/usePendingScope';
import { useUnfinishedCctpSwaps } from '../hooks/useUnfinishedCctpSwaps';
import { getBridgeNetwork } from '../model/networks';
import { canDismiss, isPendingBridgeVisible, showsActionButton } from '../model/pendingTransitions';
import { claimsFromDestinationWallet } from '../model/recipient';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { formatAddress, formatBigInt } from '@/utils';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { isStorageWritable } from '../store/storageWritable';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
import { buildContinueBridgeRows } from './continueBridgeRows';
import {
  buildPendingBridgeRows,
  formatBridgeDate,
  formatTimeLeft,
  nextActionLabel,
  pendingBridgeNote,
  type PendingBridgeCell,
  type PendingBridgeNote
} from './pendingBridgeRows';

const STATUS_CLASS: Record<PendingBridgeStatus, string> = {
  pending: 'bg-statusWarningBg text-statusWarning',
  ready: 'bg-statusBrandBg text-statusBrand',
  arrived: 'bg-statusSuccessBg text-statusSuccess',
  claimed: 'bg-statusSuccessBg text-statusSuccess',
  failed: 'bg-statusErrorBg text-statusError',
  expired: 'bg-statusErrorBg text-statusError'
};

const valueClassName = 'font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]';

type CellValueProps = { cell: PendingBridgeCell };

function CellValue({ cell }: CellValueProps) {
  switch (cell.kind) {
    case 'network':
      return (
        <span className="flex items-center gap-1">
          <BridgeNetworkIcon network={cell.network} className="size-3" />
          <span className={valueClassName}>{getBridgeNetwork(cell.network).name}</span>
        </span>
      );
    case 'status':
      return (
        <span
          className={cn(
            'font-circle flex h-[18px] w-fit items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
            STATUS_CLASS[cell.status]
          )}
          data-testid="pending-bridge-status"
        >
          {cell.value}
        </span>
      );
    case 'link':
      return cell.href ? (
        <a
          href={cell.href}
          target="_blank"
          rel="noreferrer"
          className={cn(valueClassName, 'flex items-center gap-1 hover:underline')}
        >
          {cell.value}
          <LinkExternal boxSize={12} className="text-fgSecondary shrink-0" />
        </a>
      ) : (
        <span className={valueClassName}>{cell.value}</span>
      );
    default:
      return <span className={valueClassName}>{cell.value}</span>;
  }
}

type ActionHintTextProps = { hint: DestinationActionHint };

function ActionHintText({ hint }: ActionHintTextProps) {
  if (hint.kind === 'safe-executing') return <Trans>Waiting for your Safe to execute it.</Trans>;
  const network = getBridgeNetwork(hint.network).name;
  if (hint.kind === 'action-sent') return <Trans>Waiting for the transaction to confirm on {network}.</Trans>;
  return hint.safe ? (
    <Trans>Switch your Safe to {network} to continue.</Trans>
  ) : (
    <Trans>Switch your wallet to {network} to continue.</Trans>
  );
}

type NoteLinkProps = { href: string; testId: string; children: ReactNode };

function NoteLink({ href, testId, children }: NoteLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-fgPrimary inline-flex items-center gap-1 font-medium hover:underline"
      data-testid={testId}
    >
      {children}
      <LinkExternal boxSize={12} className="text-fgSecondary shrink-0" />
    </a>
  );
}

type RedeemNoteTextProps = { note: Extract<PendingBridgeNote, { kind: 'redeem' }> };

function RedeemNoteText({ note }: RedeemNoteTextProps) {
  if (note.minutesLeft === 0)
    return <Trans>The time to redeem is up. Checking the ticket on Arbitrum.</Trans>;
  if (note.minutesLeft === undefined)
    return <Trans>Redeem on Arbitrum to deliver the funds. It needs ETH on Arbitrum for gas.</Trans>;
  const timeLeft = formatTimeLeft(note.minutesLeft);
  return note.urgent ? (
    <Trans>
      Only {timeLeft} left to redeem. After that the funds can&apos;t be delivered. Redeem now, or extend the
      deadline if you can&apos;t yet. Both need ETH on Arbitrum for gas.
    </Trans>
  ) : (
    <Trans>Redeem on Arbitrum within {timeLeft}. It needs ETH on Arbitrum for gas.</Trans>
  );
}

type BridgeNoteProps = {
  note: PendingBridgeNote;
  onExtend: () => void;
  canExtend: boolean;
};

/** What a stuck deposit needs, and for Arbitrum how to finish it without this app. */
function BridgeNote({ note, onExtend, canExtend }: BridgeNoteProps) {
  if (note.kind === 'replay') {
    const network = getBridgeNetwork(note.network).name;
    return (
      <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-note">
        <Trans>
          The deposit reached {network} but wasn&apos;t delivered. Replay it on {network} to deliver the
          funds. It needs ETH on {network} for gas.
        </Trans>
      </Text>
    );
  }
  const urgent = note.kind === 'expired' || note.urgent;
  // A keepalive can't revive a ticket whose time is up.
  const extendable = note.kind === 'redeem' && note.urgent && note.minutesLeft !== 0;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 text-xs leading-[18px]',
        urgent ? 'text-statusError' : 'text-fgSecondary'
      )}
      data-testid="pending-bridge-note"
    >
      <Text className="text-xs leading-[18px] text-inherit">
        {note.kind === 'redeem' ? (
          <RedeemNoteText note={note} />
        ) : (
          <Trans>
            The Arbitrum ticket expired or was canceled before it was redeemed, so the funds were not
            delivered.
          </Trans>
        )}
      </Text>
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {extendable && (
          <button
            type="button"
            className="text-fgPrimary font-medium enabled:hover:underline disabled:opacity-50"
            disabled={!canExtend}
            onClick={onExtend}
            data-testid="pending-bridge-keepalive"
          >
            <Trans>Extend the deadline</Trans>
          </button>
        )}
        {note.retryablesHref && (
          <NoteLink href={note.retryablesHref} testId="pending-bridge-retryables-link">
            {note.kind === 'redeem' ? (
              <Trans>Redeem from another wallet</Trans>
            ) : (
              <Trans>Check it on Arbitrum</Trans>
            )}
          </NoteLink>
        )}
        {note.kind === 'expired' && (
          <NoteLink href={note.supportHref} testId="pending-bridge-support-link">
            <Trans>Ask for help in the Sky Discord</Trans>
          </NoteLink>
        )}
      </span>
    </div>
  );
}

type ClaimLinkProps = {
  link: string;
  /** `keep`: this browser keeps no bridges; `share`: another wallet claims it. */
  note?: 'keep' | 'share';
};

/** The link that opens a CCTP bridge's claim here, to share with its recipient or keep. */
function ClaimLink({ link, note }: ClaimLinkProps) {
  const { onCopy, hasCopied } = useClipboard(link);
  return (
    <div className="text-fgSecondary flex flex-col gap-1 text-xs leading-[18px]">
      <span>
        <button
          type="button"
          className="text-fgPrimary font-medium hover:underline"
          onClick={onCopy}
          data-testid="pending-bridge-claim-link"
        >
          {hasCopied ? <Trans>Copied</Trans> : <Trans>Copy claim link</Trans>}
        </button>
      </span>
      {note && (
        <Text className="text-xs leading-[18px] text-inherit" dataTestId="pending-bridge-claim-link-note">
          {note === 'keep' ? (
            <Trans>
              This browser can&apos;t save your bridges. Copy the claim link and keep it to claim later.
            </Trans>
          ) : (
            <Trans>Share the claim link with the recipient so they can claim it.</Trans>
          )}
        </Text>
      )}
    </div>
  );
}

type CardHeaderProps = { symbol: string; amount: string; date: string; children: ReactNode };

function CardHeader({ symbol, amount, date, children }: CardHeaderProps) {
  return (
    <div className="border-glassBorder flex items-center justify-between gap-3 border-b pb-8">
      <span className="flex items-center gap-3">
        <span className="border-borderTertiary flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px]">
          <TokenIcon token={{ symbol }} width={28} showChainIcon={false} className="size-7" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
            {amount}
          </span>
          <Text className="text-fgSecondary text-xs leading-[18px]">{date}</Text>
        </span>
      </span>
      {children}
    </div>
  );
}

type CardRowsProps = { rows: PendingBridgeCell[][] };

function CardRows({ rows }: CardRowsProps) {
  return (
    <div className="flex flex-col gap-6">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
          {row.map((cell, cellIndex) => (
            <Fragment key={cell.label}>
              {cellIndex > 0 && <span aria-hidden className="bg-glassBorder h-8 w-px" />}
              <div className="flex min-w-0 flex-col gap-1">
                <Text className="text-fgSecondary text-xs leading-[18px]">{cell.label}</Text>
                <CellValue cell={cell} />
              </div>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

export const cardClassName =
  'bg-bgSecondary flex flex-col gap-6 rounded-2xl p-5 backdrop-blur-[20px] md:rounded-3xl md:p-8';

type PendingBridgeCardProps = {
  bridge: PendingBridge;
  /** The connected wallet: a CCTP claim to another address is the recipient's to send. */
  account: string | undefined;
  now: number;
  familyChainId: number;
  onAction: (bridge: PendingBridge, action?: PendingBridgeNextAction, amount?: bigint) => void;
  onDismiss: (bridge: PendingBridge) => void;
  /** Sent to this wallet from another account's list: the entry is the sender's, so it can't be dismissed here. */
  incoming?: boolean;
  canAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => boolean;
  actionHint: (bridge: PendingBridge, action?: 'convert') => DestinationActionHint | undefined;
  actionLocked: boolean;
  /** This browser keeps the list across visits: without it, a claim link is the only way back. */
  storageWritable: boolean;
};

function PendingBridgeCard({
  bridge,
  account,
  now,
  familyChainId,
  onAction,
  onDismiss,
  incoming = false,
  canAction,
  actionHint,
  actionLocked,
  storageWritable
}: PendingBridgeCardProps) {
  const dismissible = !incoming && canDismiss(bridge, now);
  const claimedElsewhere = claimsFromDestinationWallet(bridge, account);
  // USDC a claim minted and didn't sell, still in the recipient's wallet.
  const convertAmount = useCctpConvertOffer(bridge);
  const convertHint = actionHint(bridge, 'convert');
  // A sent conversion is always followed; a switch is asked for only while it's offered.
  const hint =
    dismissible || claimedElsewhere
      ? undefined
      : (actionHint(bridge) ??
        (convertHint?.kind === 'switch-network' && convertAmount === undefined ? undefined : convertHint));
  const note = pendingBridgeNote(bridge, now);
  const claimLink = pendingClaimLink(window.location.origin, bridge);
  const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
  return (
    <div className={cardClassName} data-testid="pending-bridge-card">
      <CardHeader symbol="USDS" amount={amount} date={formatBridgeDate(bridge.startedAt)}>
        {dismissible ? (
          <Button
            variant="secondary"
            size="m"
            className="w-24"
            onClick={() => onDismiss(bridge)}
            data-testid="pending-bridge-dismiss"
          >
            <Trans>Dismiss</Trans>
          </Button>
        ) : showsActionButton(bridge) && bridge.nextAction && !claimedElsewhere ? (
          <Button
            variant="primary"
            size="m"
            className="w-24"
            disabled={actionLocked || !canAction(bridge)}
            onClick={() => onAction(bridge)}
            data-testid="pending-bridge-action"
          >
            {nextActionLabel(bridge.nextAction)}
          </Button>
        ) : (
          convertAmount !== undefined && (
            <Button
              variant="primary"
              size="m"
              className="shrink-0"
              disabled={actionLocked || !canAction(bridge, 'convert')}
              onClick={() => onAction(bridge, 'convert', convertAmount)}
              data-testid="pending-bridge-convert"
            >
              {nextActionLabel('convert')}
            </Button>
          )
        )}
      </CardHeader>

      {convertAmount !== undefined && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-convert-note">
          <Trans>Your USDC wasn&apos;t converted to USDS. It&apos;s still in your wallet.</Trans>
        </Text>
      )}

      {incoming && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-incoming-note">
          <Trans>Sent to this wallet from {formatAddress(bridge.account, 6, 4)}.</Trans>
        </Text>
      )}

      {claimedElsewhere && bridge.recipient && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-recipient-note">
          <Trans>
            Only the destination wallet ({formatAddress(bridge.recipient, 6, 4)}) can claim it on Ethereum.
          </Trans>
        </Text>
      )}

      {claimLink && (
        <ClaimLink
          link={claimLink}
          note={claimedElsewhere ? 'share' : !storageWritable ? 'keep' : undefined}
        />
      )}

      {dismissible && bridge.safeTxHash && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-dismiss-hint">
          <Trans>Waiting for your Safe to execute it. Dismiss it only if you deleted it in Safe.</Trans>
        </Text>
      )}
      {hint && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-action-hint">
          <ActionHintText hint={hint} />
        </Text>
      )}
      {note && (
        <BridgeNote
          note={note}
          onExtend={() => onAction(bridge, 'keepalive')}
          canExtend={!actionLocked && canAction(bridge, 'keepalive')}
        />
      )}

      <CardRows rows={buildPendingBridgeRows(bridge, now, familyChainId)} />
    </div>
  );
}

type ContinueBlockedMessageProps = { reason: CctpResumeBlockReason; network: string };

function ContinueBlockedMessage({ reason, network }: ContinueBlockedMessageProps) {
  switch (reason) {
    case 'source-unavailable':
      return <Trans>Bridging from {network} isn&apos;t available yet.</Trans>;
    case 'wallet-unknown':
      return <Trans>We couldn&apos;t check your wallet type. Try again in a moment.</Trans>;
    case 'balance-unknown':
      return <Trans>We couldn&apos;t load your USDC balance. Try again in a moment.</Trans>;
    case 'insufficient':
      return <Trans>Your wallet has less USDC on {network} than this bridge needs.</Trans>;
    case 'pair-not-allowed':
      return <Trans>Bridging this USDC to Ethereum isn&apos;t available yet.</Trans>;
    case 'over-limit':
      return <Trans>This amount is over the bridge limit right now. Try again later.</Trans>;
    case 'no-liquidity':
      return <Trans>Not enough liquidity on Ethereum for this amount right now. Try again later.</Trans>;
    case 'facts-error':
      return <Trans>We couldn&apos;t check this route. Try again in a moment.</Trans>;
    default:
      return <Trans>This route is temporarily unavailable.</Trans>;
  }
}

// Still being read: the button stays disabled with nothing to say yet.
const SILENT_REASONS = new Set<CctpResumeBlockReason>([
  'facts-loading',
  'balance-loading',
  'wallet-checking'
]);

type ContinueBridgeCardProps = {
  swap: UnfinishedCctpSwap;
  account: string | undefined;
  familyChainId: number;
  onContinue: (swap: UnfinishedCctpSwap) => void;
  onDismiss: (swap: UnfinishedCctpSwap) => void;
};

/** A CCTP bridge whose swap was sent but whose burn wasn't: Continue burns the swap's USDC. */
function ContinueBridgeCard({
  swap,
  account,
  familyChainId,
  onContinue,
  onDismiss
}: ContinueBridgeCardProps) {
  const { blockedReason } = useCctpResumeForm(swap);
  // Another session may be signing a bridge of this same USDC.
  const busy = useTransaction().activeSessionId !== null;
  const network = getBridgeNetwork(swap.network).name;
  const amount = formatBigInt(swap.usdcAmount, { unit: 6, minDecimals: 2, maxDecimals: 2 });
  return (
    <div className={cardClassName} data-testid="continue-bridge-card">
      <CardHeader symbol="USDC" amount={amount} date={formatBridgeDate(swap.at)}>
        <Button
          variant="primary"
          size="m"
          className="w-24"
          disabled={busy || blockedReason !== undefined}
          onClick={() => onContinue(swap)}
          data-testid="continue-bridge-action"
        >
          <Trans>Continue</Trans>
        </Button>
      </CardHeader>

      <div className="text-fgSecondary flex flex-col gap-1 text-xs leading-[18px]">
        <Text className="text-xs leading-[18px] text-inherit" dataTestId="continue-bridge-note">
          <Trans>
            Your USDS was swapped to USDC on {network}, but the USDC wasn&apos;t bridged. It&apos;s still in
            your wallet.
          </Trans>
        </Text>
        <span>
          <button
            type="button"
            className="text-fgPrimary font-medium hover:underline"
            onClick={() => onDismiss(swap)}
            data-testid="continue-bridge-dismiss"
          >
            <Trans>Dismiss</Trans>
          </button>
        </span>
      </div>
      {busy ? (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="continue-bridge-hint">
          <Trans>A transaction is in progress. Open it to continue.</Trans>
        </Text>
      ) : (
        blockedReason &&
        !SILENT_REASONS.has(blockedReason) && (
          <Text className="text-statusError text-xs leading-[18px]" dataTestId="continue-bridge-blocked">
            <ContinueBlockedMessage reason={blockedReason} network={network} />
          </Text>
        )
      )}

      <CardRows rows={buildContinueBridgeRows(swap, account, familyChainId)} />
    </div>
  );
}

type PendingBridgesProps = {
  /** A conversion to USDS is sent with the amount the card offered. */
  onAction: (bridge: PendingBridge, action?: PendingBridgeNextAction, amount?: bigint) => void;
  /** The next action can be sent now, on a network the app can switch to. */
  canAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => boolean;
  /** Why the action, or the conversion to USDS, can't be sent from here, if the user has to act in the wallet. */
  actionHint: (bridge: PendingBridge, action?: 'convert') => DestinationActionHint | undefined;
  /** An action's session is minimized: it must be restored, not launched again. */
  actionLocked: boolean;
  /** Sends a card stored in another account's list, a CCTP bridge sent to this wallet, and records it there. */
  onActionIn: (
    scope: string,
    bridge: PendingBridge,
    action?: PendingBridgeNextAction,
    amount?: bigint
  ) => void;
  /** Continues an unfinished CCTP swap: bridges the USDC it returned. */
  onContinue: (swap: UnfinishedCctpSwap) => void;
};

/** "Pending bridges" list under the bridge form (Figma 3574:64348). */
export function PendingBridges({
  onAction,
  onActionIn,
  canAction,
  actionHint,
  actionLocked,
  onContinue
}: PendingBridgesProps) {
  // Owns the clock so its ticks re-render this list, not the whole Bridge tab.
  const { bridges, now } = usePendingBridges();
  const { account, familyChainId, scope } = usePendingScope();
  const swaps = useUnfinishedCctpSwaps();
  const incoming = useIncomingCctpBridges();
  const [storageWritable] = useState(isStorageWritable);
  // The sender's list is stored under the sender's scope: that's where its actions go.
  const cards = [
    ...bridges.map(bridge => ({ bridge, owner: undefined as string | undefined })),
    ...incoming
      .filter(entry => isPendingBridgeVisible(entry.bridge, now))
      .map(entry => ({ bridge: entry.bridge, owner: entry.scope }))
  ].sort((a, b) => b.bridge.startedAt - a.bridge.startedAt);
  if (cards.length === 0 && swaps.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-6" data-testid="pending-bridges">
      <h2 className="font-circle text-fgPrimary text-lg leading-5.5 font-medium tracking-[-0.36px]">
        <Trans>Pending bridges</Trans>
      </h2>
      {swaps.map(swap => (
        <ContinueBridgeCard
          key={swap.swapTxHash}
          swap={swap}
          account={account}
          familyChainId={familyChainId}
          onContinue={onContinue}
          onDismiss={dismissed => scope && cctpSwapStore.clear(scope, dismissed.swapTxHash)}
        />
      ))}
      {cards.map(({ bridge, owner }) => (
        <PendingBridgeCard
          key={`${owner ?? ''}:${bridge.id}`}
          bridge={bridge}
          account={account}
          now={now}
          familyChainId={familyChainId}
          onAction={
            owner === undefined ? onAction : (card, action, amount) => onActionIn(owner, card, action, amount)
          }
          canAction={canAction}
          actionHint={actionHint}
          onDismiss={dismissed => scope && pendingBridgeStore.dismiss(scope, dismissed.id)}
          incoming={owner !== undefined}
          actionLocked={actionLocked}
          storageWritable={storageWritable}
        />
      ))}
    </section>
  );
}
