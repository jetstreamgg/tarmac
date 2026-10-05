import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle
} from '@/components/ui/responsive-modal';
import { Close } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import type { BridgeNetwork } from '../model/networks';
import { isValidRecipient } from '../model/recipient';

/**
 * "Send to a different wallet" (Figma 3831:127366): title + close, warning
 * copy, an underlined address field and Save. Saving an empty field clears the
 * recipient (funds go to the connected wallet).
 */
export function RecipientAddressModal({
  open,
  onOpenChange,
  recipient,
  family,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient?: string;
  family: BridgeNetwork['family'];
  onSave: (recipient: string | undefined) => void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="flex w-full flex-col gap-12 p-8 sm:max-w-[610px]">
        {/* Remount per open so the draft starts from the saved value. */}
        {open && (
          <RecipientForm
            recipient={recipient}
            family={family}
            onClose={() => onOpenChange(false)}
            onSave={next => {
              onSave(next);
              onOpenChange(false);
            }}
          />
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function RecipientForm({
  recipient,
  family,
  onClose,
  onSave
}: {
  recipient?: string;
  family: BridgeNetwork['family'];
  onClose: () => void;
  onSave: (recipient: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(recipient ?? '');
  const trimmed = draft.trim();
  const invalid = trimmed !== '' && !isValidRecipient(trimmed, family);

  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <ResponsiveModalTitle className="text-fgPrimary font-circle text-lg leading-5.5 font-medium tracking-[-0.36px]">
              <Trans>Send to a different wallet</Trans>
            </ResponsiveModalTitle>
            <Text tag="p" className="text-fgSecondary text-xs leading-[18px]">
              <Trans>
                Enter the address that should receive your tokens. Make sure it&apos;s correct and supports
                this network. Transfers can&apos;t be reversed.
              </Trans>
            </Text>
          </div>
          <Button
            variant="secondary"
            size="iconM"
            aria-label={t`Close`}
            onClick={onClose}
            data-testid="bridge-recipient-close"
          >
            <Close className="size-4" />
          </Button>
        </div>

        <label className="border-glassBorder flex flex-col gap-4 border-b pb-4">
          <span className="flex items-end justify-between gap-3">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Text className="text-fgSecondary text-xs leading-[18px]">
                <Trans>Wallet address</Trans>
              </Text>
              <input
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder={family === 'solana' ? t`Solana address` : '0x…'}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={invalid}
                data-testid="bridge-recipient-input"
                className="text-fgPrimary font-circle placeholder:text-fgTertiary w-full min-w-0 bg-transparent text-lg leading-5.5 font-medium tracking-[-0.36px] outline-none"
              />
            </span>
            {draft !== '' && (
              <button
                type="button"
                aria-label={t`Clear address`}
                onClick={() => setDraft('')}
                className="text-fgSecondary hover:text-fgPrimary shrink-0"
                data-testid="bridge-recipient-clear"
              >
                <XCircle className="size-4" />
              </button>
            )}
          </span>
        </label>
        {invalid && (
          <Text className="text-error -mt-6 text-sm" dataTestId="bridge-recipient-error">
            {family === 'solana' ? (
              <Trans>Enter a valid Solana address.</Trans>
            ) : (
              <Trans>Enter a valid address.</Trans>
            )}
          </Text>
        )}
      </div>

      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={invalid}
        onClick={() => onSave(trimmed === '' ? undefined : trimmed)}
        data-testid="bridge-recipient-save"
      >
        <Trans>Save</Trans>
      </Button>
    </>
  );
}
