import { createFileRoute } from '@tanstack/react-router';
import { ConvertIntent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/convert/psm')({
  staticData: { convertIntent: ConvertIntent.PSM_INTENT }
});
