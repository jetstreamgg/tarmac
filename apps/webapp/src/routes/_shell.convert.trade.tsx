import { createFileRoute } from '@tanstack/react-router';
import { ConvertIntent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/convert/trade')({
  staticData: { convertIntent: ConvertIntent.TRADE_INTENT }
});
