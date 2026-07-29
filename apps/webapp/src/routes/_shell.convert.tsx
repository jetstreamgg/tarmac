import { createFileRoute } from '@tanstack/react-router';
import { ConvertPage } from '@/modules/convert/components/ConvertPage';
import { Intent } from '@/lib/enums';

// The E2 page-as-widget PSM swap surface. Full-width (bare AppContainer) like
// the product-detail pages; the legacy two-pane ConvertPanes and its module
// sub-routes are gone — see the sibling redirect stubs.
export const Route = createFileRoute('/_shell/convert')({
  component: ConvertPage,
  staticData: { intent: Intent.CONVERT_INTENT }
});
