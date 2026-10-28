import { Fragment, useState, type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useEnsName } from 'wagmi';
import { mainnet } from 'viem/chains';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { toast } from '@/components/ui/use-toast';
import { ArrowTopRight, CircleLogo, LinkExternal, SkyLinkLogo } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
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
import { copyToClipboard, formatAddress, formatBigInt } from '@/utils';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { isStorageWritable } from '../store/storageWritable';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
import { buildContinueBridgeRows } from './continueBridgeRows';
import {
  bridgeCounterparty,
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

type WalletValueProps = { address: string; href?: string };

/** A wallet by its ENS name once known, with its avatar (Figma 71, 74). */
function WalletValue({ address, href }: WalletValueProps) {
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id });
  const content = (
    <>
      <span className="flex shrink-0">
        <CustomAvatar address={address} size={12} />
      </span>
      <span className="truncate" data-testid="pending-bridge-wallet">
        {ensName ?? formatAddress(address, 6, 4)}
      </span>
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(valueClassName, 'flex min-w-0 items-center gap-1 hover:underline')}
    >
      {content}
      <ArrowTopRight boxSize={12} className="text-fgTertiary shrink-0" />
    </a>
  ) : (
    <span className={cn(valueClassName, 'flex min-w-0 items-center gap-1')}>{content}</span>
  );
}

type WalletNameProps = { address: string };

/** "0x1234...abcd (name.eth)" once its ENS name is known (Figma 74, 76). */
function WalletName({ address }: WalletNameProps) {
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id });
  const short = formatAddress(address, 6, 4);
  return <>{ensName ? `${short} (${ensName})` : short}</>;
}

type SenderNoteProps = { bridge: PendingBridge; sender: string; amount: string; now: number };

/** A bridge another wallet sent to this one: who sent it, and when it can be claimed (Figma 74, 76). */
function SenderNote({ bridge, sender, amount, now }: SenderNoteProps) {
  const claim = bridge.routeKind === 'cctp' && bridge.requiresClaim;
  if (claim && bridge.status === 'ready' && bridge.nextAction === 'claim')
    return (
      <Trans>
        The bridge was sent to you from <WalletName address={sender} />. Claim to receive {amount} USDS on
        Ethereum.
      </Trans>
    );
  const minutesLeft = Math.ceil((bridge.etaAt - Math.max(now, bridge.startedAt)) / 60_000);
  if (claim && bridge.status === 'pending' && bridge.txHash && minutesLeft > 0) {
    const timeLeft = formatTimeLeft(minutesLeft);
    return (
      <Trans>
        Sent to you from <WalletName address={sender} />. It&apos;ll be ready to claim on Ethereum in about{' '}
        {timeLeft}.
      </Trans>
    );
  }
  return (
    <Trans>
      Sent to you from <WalletName address={sender} />.
    </Trans>
  );
}

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
            cell.tone === 'info' ? 'bg-statusInfoBg text-statusInfoSolid' : STATUS_CLASS[cell.status]
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
          <ArrowTopRight boxSize={12} className="text-fgTertiary shrink-0" />
        </a>
      ) : (
        <span className={valueClassName}>{cell.value}</span>
      );
    case 'wallet':
      return <WalletValue address={cell.address} href={cell.href} />;
    default:
      return cell.logo ? (
        <span className="flex items-center gap-1">
          {cell.logo === 'cctp' ? (
            <CircleLogo boxSize={12} className="shrink-0" />
          ) : (
            <SkyLinkLogo boxSize={12} className="text-fgPrimary shrink-0" />
          )}
          <span className={valueClassName}>{cell.value}</span>
        </span>
      ) : (
        <span className={valueClassName}>{cell.value}</span>
      );
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

type WithdrawalNoteTextProps = { note: Extract<PendingBridgeNote, { kind: 'withdrawal' }> };

function WithdrawalNoteText({ note }: WithdrawalNoteTextProps) {
  const timeLeft = note.minutesLeft === undefined ? undefined : formatTimeLeft(note.minutesLeft);
  switch (note.phase) {
    case 'waiting-prove':
      return timeLeft ? (
        <Trans>
          The withdrawal is on its way. It&apos;ll be ready to prove on Ethereum in about {timeLeft}.
        </Trans>
      ) : (
        <Trans>The withdrawal is on its way. It&apos;ll be ready to prove on Ethereum soon.</Trans>
      );
    case 'waiting-finalize':
      return timeLeft ? (
        <Trans>It&apos;ll be ready to finalize on Ethereum in about {timeLeft}.</Trans>
      ) : (
        <Trans>It&apos;ll be ready to finalize on Ethereum soon.</Trans>
      );
    case 'prove':
      return (
        <Trans>
          Prove the withdrawal on Ethereum to start its waiting period. Then come back to finalize it.
        </Trans>
      );
    case 'reprove':
      return (
        <Trans>
          The dispute game behind the last proof was invalidated, so that proof no longer counts. Prove the
          withdrawal again to continue.
        </Trans>
      );
    case 'finalize':
      return <Trans>Finalize the withdrawal on Ethereum to receive your USDS.</Trans>;
    case 'replay':
      return (
        <Trans>
          The withdrawal was finalized but not delivered. Retry it on Ethereum to receive your USDS.
        </Trans>
      );
  }
}

type BridgeNoteProps = {
  note: PendingBridgeNote;
  onExtend: () => void;
  canExtend: boolean;
};

/** What a stuck deposit needs, and for Arbitrum how to finish it without this app. */
function BridgeNote({ note, onExtend, canExtend }: BridgeNoteProps) {
  if (note.kind === 'withdrawal')
    return (
      <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-note">
        <WithdrawalNoteText note={note} />
      </Text>
    );
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
  className?: string;
};

/** The link that opens a CCTP bridge's claim here, to share with its recipient or keep (Figma 71). */
function ClaimLink({ link, note, className = 'w-full' }: ClaimLinkProps) {
  return (
    <>
      {note && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-claim-link-note">
          {note === 'keep' ? (
            <Trans>
              This browser can&apos;t save your bridges. Copy the claim link and keep it to claim later.
            </Trans>
          ) : (
            <Trans>Share the claim link with the recipient so they can claim it.</Trans>
          )}
        </Text>
      )}
      <Button
        variant="secondary"
        size="m"
        className={className}
        onClick={() => copyToClipboard(link, () => toast.success(t`Claim link copied!`))}
        data-testid="pending-bridge-claim-link"
      >
        <Trans>Copy claim link</Trans>
      </Button>
    </>
  );
}

type CardHeaderProps = { symbol: string; amount: string; date: string; children?: ReactNode };

function CardHeader({ symbol, amount, date, children }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
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

// Figma: 32px under the card's content, 24px over the rows.
function CardRows({ rows }: CardRowsProps) {
  return (
    <div
      className="border-borderPrimary mt-2 flex flex-col gap-6 border-t pt-6"
      data-testid="pending-bridge-rows"
    >
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
  /** Keeps the USDC a claim left instead of converting it: the card leaves. */
  onKeepUsdc: (bridge: PendingBridge) => void;
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
  onKeepUsdc,
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
  const actionButton = showsActionButton(bridge) && !!bridge.nextAction && !claimedElsewhere;
  // Figma 93: offered below the note, beside Keep as USDC, unless the card has its own button.
  const offersConvert = convertAmount !== undefined && !dismissible && !actionButton;
  const convertHint = actionHint(bridge, 'convert');
  // A sent conversion is always followed; a switch is asked for only while it's offered.
  const hint =
    dismissible || claimedElsewhere
      ? undefined
      : (actionHint(bridge) ??
        (convertHint?.kind === 'switch-network' && convertAmount === undefined ? undefined : convertHint));
  const note = pendingBridgeNote(bridge, now);
  const counterparty = bridgeCounterparty(bridge, account);
  // Figma 75: a wallet that neither sent nor receives it can only switch to the one that claims it.
  const thirdWallet = counterparty?.role === 'both';
  const claimLink = thirdWallet ? undefined : pendingClaimLink(window.location.origin, bridge);
  const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
  // Figma 71: the note on the way already asks to share the claim link.
  const sharesInNote = claimedElsewhere && !thirdWallet && bridge.status === 'pending';
  // Figma 73: once ready, the sender may switch to the destination wallet or share the link.
  const switchesWallet = claimedElsewhere && !thirdWallet && bridge.status === 'ready';
  const { openConnectModal } = useConnectModal();
  return (
    <div className={cardClassName} data-testid="pending-bridge-card">
      {/* A claim that ended in USDC shows the USDC (Figma 93). */}
      <CardHeader
        symbol={convertAmount === undefined ? 'USDS' : 'USDC'}
        amount={amount}
        date={formatBridgeDate(bridge.startedAt)}
      >
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
        ) : thirdWallet ? (
          <Button
            variant="primary"
            size="m"
            onClick={() => openConnectModal()}
            data-testid="pending-bridge-switch-wallet"
          >
            <Trans>Switch wallet</Trans>
          </Button>
        ) : actionButton && bridge.nextAction ? (
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
        ) : null}
      </CardHeader>

      {convertAmount !== undefined && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-convert-note">
          <Trans>
            Your bridge arrived as USDC because the conversion to USDS didn&apos;t complete. Convert it now at
            a 1:1 rate.
          </Trans>
        </Text>
      )}
      {offersConvert && (
        <div className="flex gap-3.5">
          <Button
            variant="primary"
            size="m"
            className="flex-1"
            disabled={actionLocked || !canAction(bridge, 'convert')}
            onClick={() => onAction(bridge, 'convert', convertAmount)}
            data-testid="pending-bridge-convert"
          >
            {nextActionLabel('convert')}
          </Button>
          <Button
            variant="secondary"
            size="m"
            className="flex-1"
            disabled={actionLocked}
            onClick={() => onKeepUsdc(bridge)}
            data-testid="pending-bridge-keep-usdc"
          >
            <Trans>Keep as USDC</Trans>
          </Button>
        </div>
      )}

      {counterparty?.role === 'sender' && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-incoming-note">
          <SenderNote bridge={bridge} sender={counterparty.address} amount={amount} now={now} />
        </Text>
      )}

      {counterparty?.role === 'both' && (
        <Text
          className="text-fgSecondary text-xs leading-[18px]"
          dataTestId="pending-bridge-third-wallet-note"
        >
          <Trans>
            This bridge was sent to {formatAddress(counterparty.destination, 6, 4)}. Connect that wallet to be
            able to claim the funds on Ethereum.
          </Trans>
        </Text>
      )}

      {claimedElsewhere && !thirdWallet && bridge.recipient && (
        <Text className="text-fgSecondary text-xs leading-[18px]" dataTestId="pending-bridge-recipient-note">
          {switchesWallet ? (
            <Trans>
              Ready on Ethereum. {formatAddress(bridge.recipient, 6, 4)} needs to claim it from that wallet to
              receive USDS. If it&apos;s your wallet, switch to it. Otherwise, share the claim link.
            </Trans>
          ) : sharesInNote ? (
            <Trans>
              On its way to {formatAddress(bridge.recipient, 6, 4)}. Once it&apos;s ready on Ethereum,
              they&apos;ll need to claim it from that wallet to receive USDS. Share the claim link so they can
              find it.
            </Trans>
          ) : (
            <Trans>
              Only the destination wallet ({formatAddress(bridge.recipient, 6, 4)}) can claim it on Ethereum.
            </Trans>
          )}
        </Text>
      )}

      {switchesWallet ? (
        <div className="flex gap-3.5">
          <Button
            variant="primary"
            size="m"
            className="flex-1"
            onClick={() => openConnectModal()}
            data-testid="pending-bridge-switch-wallet"
          >
            <Trans>Switch wallet</Trans>
          </Button>
          {claimLink && <ClaimLink link={claimLink} className="flex-1" />}
        </div>
      ) : (
        claimLink && (
          <ClaimLink
            link={claimLink}
            note={
              sharesInNote ? undefined : claimedElsewhere ? 'share' : !storageWritable ? 'keep' : undefined
            }
          />
        )
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
      {/* A step already sent says so in its hint; asking for it again would contradict it. */}
      {note && !(note.kind === 'withdrawal' && hint && hint.kind !== 'switch-network') && (
        <BridgeNote
          note={note}
          onExtend={() => onAction(bridge, 'keepalive')}
          canExtend={!actionLocked && canAction(bridge, 'keepalive')}
        />
      )}

      <CardRows
        rows={buildPendingBridgeRows(bridge, now, familyChainId, convertAmount !== undefined, counterparty)}
      />
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
  onConvert: (swap: UnfinishedCctpSwap) => void;
  onDismiss: (swap: UnfinishedCctpSwap) => void;
};

// Only the route's gate leaves the USDC free to go back to USDS.
const CONVERT_BLOCKING_REASONS = new Set<CctpResumeBlockReason>([
  'source-unavailable',
  'wallet-checking',
  'wallet-unknown',
  'balance-loading',
  'balance-unknown',
  'insufficient'
]);

/** A CCTP bridge whose swap was sent but whose burn wasn't (Figma 90): Continue burns the swap's USDC, Convert swaps it back to USDS. */
function ContinueBridgeCard({
  swap,
  account,
  familyChainId,
  onContinue,
  onConvert,
  onDismiss
}: ContinueBridgeCardProps) {
  const { blockedReason } = useCctpResumeForm(swap);
  // Another session may be signing a bridge of this same USDC.
  const busy = useTransaction().activeSessionId !== null;
  const network = getBridgeNetwork(swap.network).name;
  const amount = formatBigInt(swap.usdcAmount, { unit: 6, minDecimals: 2, maxDecimals: 2 });
  return (
    <div className={cardClassName} data-testid="continue-bridge-card">
      <CardHeader symbol="USDC" amount={amount} date={formatBridgeDate(swap.at)} />

      <div className="text-fgSecondary flex flex-col gap-1 text-xs leading-[18px]">
        <Text className="text-xs leading-[18px] text-inherit" dataTestId="continue-bridge-note">
          <Trans>
            Your bridge stopped before it was sent. The {amount} USDC from the conversion is still on{' '}
            {network}. Continue to send it to Ethereum, or convert it back to USDS.
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
      <div className="flex gap-3.5">
        <Button
          variant="primary"
          size="m"
          className="flex-1"
          disabled={busy || blockedReason !== undefined}
          onClick={() => onContinue(swap)}
          data-testid="continue-bridge-action"
        >
          <Trans>Continue bridge</Trans>
        </Button>
        <Button
          variant="secondary"
          size="m"
          className="flex-1"
          disabled={busy || (blockedReason !== undefined && CONVERT_BLOCKING_REASONS.has(blockedReason))}
          onClick={() => onConvert(swap)}
          data-testid="continue-bridge-convert"
        >
          <Trans>Convert to USDS</Trans>
        </Button>
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
  /** Converts the USDC an unfinished CCTP swap returned back to USDS on its L2. */
  onConvert: (swap: UnfinishedCctpSwap) => void;
  /** The lookup banner under the cards (Figma 81); the list shows it even while empty. */
  lookup?: ReactNode;
};

/** "Pending bridges" list under the bridge form (Figma 3574:64348). */
export function PendingBridges({
  onAction,
  onActionIn,
  canAction,
  actionHint,
  actionLocked,
  onContinue,
  onConvert,
  lookup
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
  if (cards.length === 0 && swaps.length === 0 && !lookup) return null;

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
          onConvert={onConvert}
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
          onKeepUsdc={kept => {
            const listScope = owner ?? scope;
            if (!listScope) return;
            pendingBridgeStore.close(listScope, kept.id);
            // Figma 98.
            toast.success(t`You can convert your USDC to USDS anytime from the Swap tab.`);
          }}
          incoming={owner !== undefined}
          actionLocked={actionLocked}
          storageWritable={storageWritable}
        />
      ))}
      {lookup}
    </section>
  );
}
