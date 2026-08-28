import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { ModuleEnum } from '@/hooks';
import { ConvertArrows } from '@/modules/icons';

/** Action glyph for a transaction row: convert arrows for trades, otherwise in/out by direction. */
export function TransactionActionIcon({ module, positive }: { module: ModuleEnum; positive?: boolean }) {
  if (module === ModuleEnum.TRADE) return <ConvertArrows width={16} height={16} />;
  return positive === false ? <ArrowUpToLine className="size-4" /> : <ArrowDownToLine className="size-4" />;
}
