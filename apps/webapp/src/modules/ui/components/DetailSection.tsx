import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { Heading } from '@/modules/layout/components/Typography';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { positionAnimations } from '../animation/presets';

type DetailSectionProps = {
  title: string | React.ReactElement;
  dataTestId?: string;
  children: React.ReactNode;
  fixedOpen?: boolean; //true = open, false = closed, undefined = normal
};

export function DetailSection({ title, children, dataTestId, fixedOpen }: DetailSectionProps) {
  const [open, setOpen] = useState(true);

  return withErrorBoundary(
    <Collapsible
      open={fixedOpen !== undefined ? fixedOpen : open}
      onOpenChange={setOpen}
      className="mb-6"
      data-testid={dataTestId}
      disabled={fixedOpen !== undefined}
    >
      <motion.div variants={positionAnimations}>
        <CollapsibleTrigger className="flex w-full items-center justify-between [&[data-state=open]>svg]:rotate-180">
          {typeof title === 'string' ? <Heading className="my-4 text-left">{title}</Heading> : title}
          {fixedOpen === undefined && (
            <ChevronDown className="text-textSecondary h-6 w-6 shrink-0 transition-transform duration-200" />
          )}
        </CollapsibleTrigger>
      </motion.div>
      <CollapsibleContent className="data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down space-y-8 overflow-hidden transition-all">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
