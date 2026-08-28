import { ToastSuccessIcon } from '@/components/toast/ToastSuccessIcon';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { formatAddress } from '@/utils';

/**
 * Content for the toast that a confirmed transaction hands its outcome to when
 * the modal closes itself (Figma 859:35901, "Toast: Action feedback"): the DS
 * success disc, the flow's amount-aware headline, and the transaction hash as
 * an explorer link.
 *
 * The hash is omitted until one exists — a batched (EIP-5792) transaction can
 * settle without the app ever seeing one, in which case the headline stands
 * alone, same as in MinimizedTransactionToast.
 */
export function TransactionSuccessToast({
  title,
  hash,
  href
}: {
  title: string;
  hash?: string;
  href?: string;
}) {
  const shortHash = hash ? formatAddress(hash, 6, 4) : undefined;
  return (
    <div className="flex w-full items-center gap-3 pr-6" data-testid="transaction-success-toast">
      {/* shrink-0: the disc is a circle, and a long headline would otherwise
          squeeze it into an ellipse (same wrapper the sibling toasts use). */}
      <span className="shrink-0">
        <ToastSuccessIcon />
      </span>
      <span className="flex flex-col gap-1">
        <Text className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          {title}
        </Text>
        {shortHash &&
          (href ? (
            <ExternalLink href={href} showIcon={false} className="text-fgSecondary text-sm underline">
              {shortHash}
            </ExternalLink>
          ) : (
            <Text className="text-fgSecondary text-sm">{shortHash}</Text>
          ))}
      </span>
    </div>
  );
}
