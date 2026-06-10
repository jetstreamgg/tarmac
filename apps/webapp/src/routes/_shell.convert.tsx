import { createFileRoute } from '@tanstack/react-router';
import { ConvertPanes } from '@/modules/convert/components/ConvertPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/convert')({
  component: ConvertPanes,
  staticData: { intent: Intent.CONVERT_INTENT }
});
