import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { isHex, size, type Hex } from 'viem';
import { Button } from '@/components/ui/button';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { Close } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { formatAddress, formatBigInt } from '@/utils';
import { readCctpClaimLink } from '../adapters/cctp/claimLink';
import { isCctpL2Network, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import {
  useCctpClaimLookup,
  type CctpClaimLookupState,
  type CctpClaimTarget
} from '../hooks/useCctpClaimLookup';
import { usePendingScope } from '../hooks/usePendingScope';
import { BRIDGE_NETWORKS, getBridgeNetwork } from '../model/networks';
import { isLivePair } from '../model/pairs';
import { claimsFromDestinationWallet } from '../model/recipient';
import { BridgeNetworkSelect } from './BridgeNetworkSelect';
import { cardClassName } from './PendingBridges';

// The networks whose bridge to Ethereum is live: only their burns can come from this app.
const liveNetworks = () =>
  BRIDGE_NETWORKS.map(({ id }) => id)
    .filter(isCctpL2Network)
    .filter(from => isLivePair({ from, to: 'ethereum' }));

const noteClassName = 'text-fgSecondary text-xs leading-[18px]';
const errorClassName = 'text-statusError text-xs leading-[18px]';

type LookupMessageProps = { state: CctpClaimLookupState; network: string };

function LookupMessage({ state, network }: LookupMessageProps) {
  switch (state.status) {
    case 'disconnected':
      return (
        <Text className={noteClassName} dataTestId="bridge-claim-lookup-message">
          <Trans>Connect your wallet to look it up.</Trans>
        </Text>
      );
    case 'loading':
      return (
        <Text className={noteClassName} dataTestId="bridge-claim-lookup-message">
          <Trans>Looking it up…</Trans>
        </Text>
      );
    case 'known':
      return (
        <Text className={noteClassName} dataTestId="bridge-claim-lookup-message">
          {state.claimed ? (
            <Trans>This bridge has already been claimed.</Trans>
          ) : (
            <Trans>This bridge is already in your list.</Trans>
          )}
        </Text>
      );
    case 'error':
      return (
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Text className={errorClassName} dataTestId="bridge-claim-lookup-error">
            <Trans>We couldn&apos;t read this transaction. Try again in a moment.</Trans>
          </Text>
          <button
            type="button"
            className="text-fgPrimary text-xs leading-[18px] font-medium hover:underline"
            onClick={state.retry}
            data-testid="bridge-claim-lookup-retry"
          >
            <Trans>Try again</Trans>
          </button>
        </span>
      );
    case 'refused':
      return (
        <Text className={errorClassName} dataTestId="bridge-claim-lookup-error">
          {state.reason === 'not-yours' ? (
            <Trans>
              This bridge goes to {formatAddress(state.recipient, 6, 4)}. Connect that wallet to claim it.
            </Trans>
          ) : state.reason === 'not-found' ? (
            <Trans>
              We couldn&apos;t find this transaction on {network}. Check the network and the hash.
            </Trans>
          ) : state.reason === 'reverted' ? (
            <Trans>This transaction failed on {network}, so nothing was bridged.</Trans>
          ) : state.reason === 'not-a-bridge' ? (
            <Trans>This transaction isn&apos;t a USDS bridge to Ethereum that this app can claim.</Trans>
          ) : (
            <Trans>This transaction sends more than one bridge, so this app can&apos;t claim it.</Trans>
          )}
        </Text>
      );
    default:
      return null;
  }
}

type FoundBridgeProps = {
  state: Extract<CctpClaimLookupState, { status: 'found' }>;
  account: string | undefined;
  onAdd: () => void;
};

function FoundBridge({ state: { bridge }, account, onAdd }: FoundBridgeProps) {
  const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
  const network = getBridgeNetwork(bridge.from).name;
  return (
    <div className="flex flex-col gap-3" data-testid="bridge-claim-lookup-found">
      <Text className="text-fgPrimary text-sm leading-4 font-medium">
        <Trans>
          {amount} USDS from {network} to Ethereum
        </Trans>
      </Text>
      {claimsFromDestinationWallet(bridge, account) && bridge.recipient && (
        <Text className={noteClassName}>
          <Trans>
            Only the destination wallet ({formatAddress(bridge.recipient, 6, 4)}) can claim it on Ethereum.
          </Trans>
        </Text>
      )}
      <Button
        variant="primary"
        size="m"
        className="self-start"
        onClick={onAdd}
        data-testid="bridge-claim-lookup-add"
      >
        <Trans>Add to my bridges</Trans>
      </Button>
    </div>
  );
}

type LookupFormProps = {
  /** The burn a claim link names: the form opens on it and looks it up straight away. */
  link: CctpClaimTarget | undefined;
  networks: CctpL2NetworkId[];
  onClose: () => void;
};

function LookupForm({ link, networks, onClose }: LookupFormProps) {
  const { account } = usePendingScope();
  const [open, setOpen] = useState(link !== undefined);
  const [network, setNetwork] = useState<CctpL2NetworkId>(link?.from ?? networks[0]);
  const [draft, setDraft] = useState<string>(link?.txHash ?? '');
  const [target, setTarget] = useState<CctpClaimTarget | undefined>(link);
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const state = useCctpClaimLookup(target, attempt);

  const close = () => {
    setOpen(false);
    setTarget(undefined);
    onClose();
  };
  const find = () => {
    const hash = draft.trim();
    const valid = isHex(hash, { strict: true }) && size(hash) === 32;
    setInvalid(!valid);
    setAttempt(previous => previous + 1);
    setTarget(valid ? { from: network, txHash: hash.toLowerCase() as Hex } : undefined);
  };

  if (!open)
    return (
      <button
        type="button"
        className="text-fgSecondary hover:text-fgPrimary self-start text-sm leading-4 font-medium hover:underline"
        onClick={() => setOpen(true)}
        data-testid="bridge-claim-lookup-open"
      >
        <Trans>Can&apos;t find your unclaimed transaction?</Trans>
      </button>
    );

  return (
    <div className={cardClassName} data-testid="bridge-claim-lookup-form">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
            <Trans>Find a bridge to Ethereum</Trans>
          </span>
          <Text className={noteClassName}>
            <Trans>Enter the network it was sent from and its transaction hash to claim it here.</Trans>
          </Text>
        </span>
        <Button
          variant="secondary"
          size="iconM"
          aria-label={t`Close`}
          onClick={close}
          data-testid="bridge-claim-lookup-close"
        >
          <Close className="size-4" />
        </Button>
      </div>

      <div className="border-glassBorder flex flex-col gap-1 border-b pb-4">
        <span className="flex items-center justify-between gap-3">
          <Text className={noteClassName}>
            <Trans>Sent from</Trans>
          </Text>
          <BridgeNetworkSelect
            value={network}
            options={networks}
            onChange={next => {
              setNetwork(next as CctpL2NetworkId);
              setTarget(undefined);
            }}
            dataTestId="bridge-claim-lookup-network"
          />
        </span>
        <label className="flex flex-col gap-1">
          <Text className={noteClassName}>
            <Trans>Transaction hash</Trans>
          </Text>
          <input
            value={draft}
            onChange={event => {
              setDraft(event.target.value);
              setTarget(undefined);
              setInvalid(false);
            }}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            data-testid="bridge-claim-lookup-hash"
            className="text-fgPrimary font-circle placeholder:text-fgTertiary w-full min-w-0 bg-transparent text-sm leading-4 font-medium outline-none"
          />
        </label>
      </div>
      {invalid && (
        <Text className={errorClassName} dataTestId="bridge-claim-lookup-invalid">
          <Trans>Enter a valid transaction hash.</Trans>
        </Text>
      )}

      {state.status === 'found' ? (
        <FoundBridge
          state={state}
          account={account}
          onAdd={() => {
            state.add();
            close();
          }}
        />
      ) : (
        <>
          <LookupMessage state={state} network={getBridgeNetwork(target?.from ?? network).name} />
          <Button
            variant="secondary"
            size="m"
            className="self-start"
            onClick={find}
            data-testid="bridge-claim-lookup-find"
          >
            <Trans>Find</Trans>
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * "Can't find your unclaimed transaction?" under the pending bridges: looks up
 * a CCTP burn to Ethereum by its network and hash, typed in or from a claim
 * link, and adds it to the list to claim.
 */
export function CctpClaimLookup() {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const networks = liveNetworks();
  const read = readCctpClaimLink(searchParams);
  const link = read && networks.includes(read.from) ? read : undefined;
  const stripLink = () =>
    setSearchParams(
      params => {
        params.delete(QueryParams.ClaimNetwork);
        params.delete(QueryParams.ClaimTx);
        return params;
      },
      { replace: true }
    );
  if (networks.length === 0) return null;
  // A new link opens a fresh form on its burn.
  return (
    <LookupForm
      key={link ? `${link.from}:${link.txHash}` : ''}
      link={link}
      networks={networks}
      onClose={stripLink}
    />
  );
}
