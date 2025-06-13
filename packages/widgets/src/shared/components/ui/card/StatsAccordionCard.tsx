import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { HStack } from '../layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { Trans } from '@lingui/react/macro';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { motion } from 'framer-motion';
import { JSX } from 'react';

export const StatsAccordionCard = ({
  chainId,
  address,
  accordionTitle,
  accordionContent,
  onExternalLinkClicked
}: {
  chainId: number;
  address?: string;
  accordionTitle: string;
  accordionContent: JSX.Element;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  return (
    <Accordion type="single" collapsible defaultValue={'info'}>
      <AccordionItem value="info">
        <motion.div variants={positionAnimations}>
          <AccordionTrigger className="mt-3">
            <HStack className="mr-1 w-full justify-between">
              {address ? (
                <ExternalLink
                  href={getEtherscanLink(chainId, address, 'address')}
                  iconSize={14}
                  className="text-textEmphasis"
                  onExternalLinkClicked={onExternalLinkClicked}
                >
                  View contract
                </ExternalLink>
              ) : (
                <Skeleton className="bg-textSecondary h-5" />
              )}
              <Text variant="medium" className="font-medium">
                <Trans>{accordionTitle}</Trans>
              </Text>
            </HStack>
          </AccordionTrigger>
        </motion.div>
        <AccordionContent className="pb-0">{accordionContent}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
