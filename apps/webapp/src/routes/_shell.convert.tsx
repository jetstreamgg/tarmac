import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/convert')({
  staticData: { intent: Intent.CONVERT_INTENT }
});
