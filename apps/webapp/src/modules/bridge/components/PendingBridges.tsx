import { Fragment, type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { LinkExternal } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { DestinationActionHint } from '../hooks/useDestinationActionLaunch';
import { usePendingBridges } from '../hooks/usePendingBridges';
import { usePendingScope } from '../hooks/usePendingScope';
import { getBridgeNetwork } from '../model/networks';
import { canDismiss, showsActionButton } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { formatBigInt } from '@/utils';
import { pendingBridgeStore } from '../store/pendingStore';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
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

/** What a stuck Arbitrum deposit needs, and how to finish it without this app. */
function BridgeNote({ note, onExtend, canExtend }: BridgeNoteProps) {
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

type PendingBridgeCardProps = {
  bridge: PendingBridge;
  now: number;
  familyChainId: number;
  onAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => void;
  onDismiss: (bridge: PendingBridge) => void;
  canAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => boolean;
  actionHint: (bridge: PendingBridge) => DestinationActionHint | undefined;
  actionLocked: boolean;
};

function PendingBridgeCard({
  bridge,
  now,
  familyChainId,
  onAction,
  onDismiss,
  canAction,
  actionHint,
  actionLocked
}: PendingBridgeCardProps) {
  const dismissible = canDismiss(bridge);
  const hint = dismissible ? undefined : actionHint(bridge);
  const note = pendingBridgeNote(bridge, now);
  const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
  return (
    <div
      className="bg-bgSecondary flex flex-col gap-6 rounded-2xl p-5 backdrop-blur-[20px] md:rounded-3xl md:p-8"
      data-testid="pending-bridge-card"
    >
      <div className="border-glassBorder flex items-center justify-between gap-3 border-b pb-8">
        <span className="flex items-center gap-3">
          <span className="border-borderTertiary flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px]">
            <TokenIcon token={{ symbol: 'USDS' }} width={28} showChainIcon={false} className="size-7" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
              {amount}
            </span>
            <Text className="text-fgSecondary text-xs leading-[18px]">
              {formatBridgeDate(bridge.startedAt)}
            </Text>
          </span>
        </span>
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
        ) : (
          showsActionButton(bridge) &&
          bridge.nextAction && (
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
          )
        )}
      </div>

      {dismissible && (
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

      <div className="flex flex-col gap-6">
        {buildPendingBridgeRows(bridge, now, familyChainId).map((row, rowIndex) => (
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
    </div>
  );
}

type PendingBridgesProps = {
  onAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => void;
  /** The next action can be sent now, on a network the app can switch to. */
  canAction: (bridge: PendingBridge, action?: PendingBridgeNextAction) => boolean;
  /** Why the action can't be sent from here, if the user has to act in the wallet. */
  actionHint: (bridge: PendingBridge) => DestinationActionHint | undefined;
  /** An action's session is minimized: it must be restored, not launched again. */
  actionLocked: boolean;
};

/** "Pending bridges" list under the bridge form (Figma 3574:64348). */
export function PendingBridges({ onAction, canAction, actionHint, actionLocked }: PendingBridgesProps) {
  // Owns the clock so its ticks re-render this list, not the whole Bridge tab.
  const { bridges, now } = usePendingBridges();
  const { familyChainId, scope } = usePendingScope();
  if (bridges.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-6" data-testid="pending-bridges">
      <h2 className="font-circle text-fgPrimary text-lg leading-5.5 font-medium tracking-[-0.36px]">
        <Trans>Pending bridges</Trans>
      </h2>
      {bridges.map(bridge => (
        <PendingBridgeCard
          key={bridge.id}
          bridge={bridge}
          now={now}
          familyChainId={familyChainId}
          onAction={onAction}
          canAction={canAction}
          actionHint={actionHint}
          onDismiss={dismissed => scope && pendingBridgeStore.dismiss(scope, dismissed.id)}
          actionLocked={actionLocked}
        />
      ))}
    </section>
  );
}
