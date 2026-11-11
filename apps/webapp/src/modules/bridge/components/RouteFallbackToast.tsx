import { toastWithClose } from '@/components/ui/use-toast';
import { Info } from '@/modules/icons';
import { TransactionNoticeToast } from '@/modules/ui/components/TransactionNoticeToast';

// One at a time: a second Review replaces it.
const ROUTE_FALLBACK_TOAST_ID = 'bridge-route-fallback';

/** Tells the user the Review opened on SkyLink because CCTP can't carry the bridge (Figma 61). */
export function notifyRouteFallback({ title, description }: { title: string; description: string }) {
  toastWithClose(() => <TransactionNoticeToast icon={<Info />} title={title} description={description} />, {
    id: ROUTE_FALLBACK_TOAST_ID,
    duration: 10000
  });
}
