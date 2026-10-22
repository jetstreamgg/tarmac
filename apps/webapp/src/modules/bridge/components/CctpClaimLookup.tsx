import { useCallback, useEffect, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { isHex, size, type Hex } from 'viem';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle
} from '@/components/ui/responsive-modal';
import { AmountFieldHairline } from '@/components/product/amountFieldHairline';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/cn';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { Close, NoResults } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { readCctpClaimLink } from '../adapters/cctp/claimLink';
import { isCctpL2Network, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import {
  useCctpClaimLookup,
  type CctpClaimLookupState,
  type CctpClaimTarget
} from '../hooks/useCctpClaimLookup';
import { BRIDGE_NETWORKS, getBridgeNetwork } from '../model/networks';
import { isLivePair } from '../model/pairs';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
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
          {state.reason === 'not-found' ? (
            <Trans>There&apos;s no CCTP bridge with this hash on {network}.</Trans>
          ) : state.reason === 'reverted' ? (
            <Trans>This transaction failed on {network}, so nothing was bridged.</Trans>
          ) : state.reason === 'not-a-bridge' ? (
            <Trans>This transaction isn&apos;t a USDS bridge to Ethereum that this app can claim.</Trans>
          ) : (
            <Trans>This transaction sends more than one bridge, so this app can&apos;t claim it.</Trans>
          )}
        </Text>
      );
    case 'idle':
    case 'loading':
      return (
        <Text className="text-fgSecondary text-[11px] leading-4" dataTestId="bridge-claim-lookup-helper">
          <Trans>
            You&apos;ll find it in your wallet&apos;s activity or on the block explorer of the network you
            bridged from.
          </Trans>
        </Text>
      );
    default:
      return null;
  }
}

type NetworkPillsProps = {
  value: CctpL2NetworkId;
  options: CctpL2NetworkId[];
  onChange: (next: CctpL2NetworkId) => void;
};

// Figma 82 "Tabs3": icon-only pills, named for screen readers.
function NetworkPills({ value, options, onChange }: NetworkPillsProps) {
  return (
    <div role="radiogroup" aria-label={t`Source network`} className="flex flex-wrap gap-3">
      {options.map(network => {
        const checked = network === value;
        return (
          <button
            key={network}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={getBridgeNetwork(network).name}
            onClick={() => onChange(network)}
            data-testid={`bridge-claim-lookup-network-${network}`}
            className={cn(
              buttonVariants({ variant: 'navbar', size: 'navbar' }),
              'w-[100px] px-5',
              checked && 'border-borderBrandDim from-brand2-start to-brand2-end bg-linear-to-b'
            )}
          >
            <BridgeNetworkIcon network={network} className="size-5" />
          </button>
        );
      })}
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
  const [network, setNetwork] = useState<CctpL2NetworkId>(link?.from ?? networks[0]);
  const [draft, setDraft] = useState<string>(link?.txHash ?? '');
  const [target, setTarget] = useState<CctpClaimTarget | undefined>(link);
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const state = useCctpClaimLookup(target, attempt);
  const { openConnectModal } = useConnectModal();
  const networkName = getBridgeNetwork(target?.from ?? network).name;
  const notFound = state.status === 'refused' && state.reason === 'not-found';
  const loading = state.status === 'loading';
  const failed = invalid || state.status === 'error' || state.status === 'refused';
  const add = state.status === 'found' ? state.add : undefined;

  // Figma 85; the fixed id keeps a repeated run to one toast.
  useEffect(() => {
    if (!notFound) return;
    toast.error(t`We couldn't find this bridge`, {
      id: 'cctp-claim-lookup-not-found',
      description: t`There's no CCTP bridge with this hash on ${networkName}. Check that the network and the hash are correct.`
    });
  }, [notFound, networkName, target, attempt]);

  // Figma 86: a found burn goes straight to the list; the upsert and the toast id make a rerun a no-op.
  useEffect(() => {
    if (!add) return;
    add();
    toast.success(t`Bridge found!`, { id: 'cctp-claim-lookup-found' });
    onClose();
  }, [add, onClose]);

  const find = () => {
    const hash = draft.trim();
    const valid = isHex(hash, { strict: true }) && size(hash) === 32;
    setInvalid(!valid);
    setAttempt(previous => previous + 1);
    setTarget(valid ? { from: network, txHash: hash.toLowerCase() as Hex } : undefined);
  };

  return (
    <div className="flex flex-col gap-12" data-testid="bridge-claim-lookup-form">
      <div className="flex items-start gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <ResponsiveModalTitle className="text-fgPrimary font-circle text-lg leading-5.5 font-medium tracking-[-0.36px]">
            <Trans>Find your bridge</Trans>
          </ResponsiveModalTitle>
          <Text tag="p" className="text-fgSecondary text-sm leading-[22px]">
            <Trans>
              Enter the network you bridged from and the transaction hash. We&apos;ll look it up so you can
              claim it.
            </Trans>
          </Text>
        </div>
        <Button
          variant="secondary"
          size="iconM"
          aria-label={t`Close`}
          onClick={onClose}
          data-testid="bridge-claim-lookup-close"
        >
          <Close className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2.5">
          <Text className={noteClassName}>
            <Trans>Source network</Trans>
          </Text>
          <NetworkPills
            value={network}
            options={networks}
            onChange={next => {
              setNetwork(next);
              setTarget(undefined);
            }}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="group flex flex-col gap-4">
            <span className="relative flex flex-col gap-1">
              <span
                className={cn(
                  'text-fgSecondary font-graphik',
                  draft === ''
                    ? 'pointer-events-none absolute inset-x-0 bottom-0 text-base leading-6'
                    : 'text-xs leading-[18px]'
                )}
              >
                <Trans>Transaction hash</Trans>
              </span>
              <input
                value={draft}
                onChange={event => {
                  setDraft(event.target.value);
                  setTarget(undefined);
                  setInvalid(false);
                }}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={failed}
                data-testid="bridge-claim-lookup-hash"
                className={cn(
                  'font-circle h-6 w-full min-w-0 bg-transparent text-lg leading-5.5 font-medium tracking-[-0.36px] text-ellipsis outline-none',
                  loading ? 'text-fgTertiary' : 'text-fgPrimary'
                )}
              />
            </span>
            <AmountFieldHairline hasError={failed} />
          </label>
          {invalid ? (
            <Text className={errorClassName} dataTestId="bridge-claim-lookup-invalid">
              <Trans>Enter a valid transaction hash.</Trans>
            </Text>
          ) : (
            <LookupMessage state={state} network={networkName} />
          )}
        </div>
      </div>

      {state.status === 'disconnected' ? (
        // The link stays: once connected, the lookup runs on it.
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          onClick={() => openConnectModal()}
          data-testid="bridge-claim-lookup-connect"
        >
          <Trans>Connect wallet</Trans>
        </Button>
      ) : (
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={draft.trim() === ''}
          loading={loading}
          onClick={find}
          data-testid="bridge-claim-lookup-find"
        >
          {loading ? <Trans>Looking up your bridge</Trans> : <Trans>Find</Trans>}
        </Button>
      )}
    </div>
  );
}

type ClaimLookupProps = LookupFormProps;

// Figma 81: the banner under the pending bridges, opening the lookup modal (82–85).
function ClaimLookup({ link, networks, onClose }: ClaimLookupProps) {
  const [open, setOpen] = useState(link !== undefined);
  const close = useCallback(() => {
    setOpen(false);
    onClose();
  }, [onClose]);

  return (
    <>
      <div className={cardClassName} data-testid="bridge-claim-lookup-banner">
        <div className="flex items-center gap-6">
          <NoResults className="size-22 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
              <Trans>Can&apos;t find your bridge?</Trans>
            </span>
            <Text className={noteClassName}>
              <Trans>
                If you sent it from another device or browser, or someone sent it to you, find it with the
                transaction hash and claim it here.
              </Trans>
            </Text>
          </div>
        </div>
        <Button
          variant="primary"
          size="l"
          className="w-full"
          onClick={() => setOpen(true)}
          data-testid="bridge-claim-lookup-open"
        >
          <Trans>Find bridge</Trans>
        </Button>
      </div>
      <ResponsiveModal open={open} onOpenChange={next => (next ? setOpen(true) : close())}>
        <ResponsiveModalContent className="flex w-full flex-col p-8 sm:max-w-[610px]">
          {/* Remount per open so each lookup starts empty. */}
          {open && <LookupForm link={link} networks={networks} onClose={close} />}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

/** Whether a CCTP burn to Ethereum can be looked up: some network's bridge to Ethereum is live. */
export const hasCctpClaimLookup = () => liveNetworks().length > 0;

/**
 * "Can't find your bridge?" in the pending bridges: looks up a CCTP burn to
 * Ethereum by its network and hash, typed in or from a claim link, and adds
 * it to the list to claim.
 */
export function CctpClaimLookup() {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const networks = liveNetworks();
  const read = readCctpClaimLink(searchParams);
  const link = read && networks.includes(read.from) ? read : undefined;
  const stripLink = useCallback(
    () =>
      setSearchParams(
        params => {
          params.delete(QueryParams.ClaimNetwork);
          params.delete(QueryParams.ClaimTx);
          return params;
        },
        { replace: true }
      ),
    [setSearchParams]
  );
  if (networks.length === 0) return null;
  // A new link opens a fresh lookup on its burn.
  return (
    <ClaimLookup
      key={link ? `${link.from}:${link.txHash}` : ''}
      link={link}
      networks={networks}
      onClose={stripLink}
    />
  );
}
