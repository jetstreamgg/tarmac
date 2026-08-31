import React from 'react';
import { cn } from '@/lib/utils';
import { Text } from '@/modules/layout/components/Typography';
import { PopoverRateInfo, resolvePopoverTooltipKey } from '@/widgets';
import { Trans } from '@lingui/react/macro';

/**
 * Parses banner description text and replaces inline placeholders with React components:
 * - [(PSM)](#tooltip-psm) becomes "PSM <PopoverRateInfo type="psm" />"
 * - [Spark.fi](https://spark.fi) becomes an external <a> link
 *
 * `textClassName` merges into the wrapping <Text> so callers can override the
 * default 13px/18 body when their comp asks for different type.
 */
export function parseBannerContent(
  description: string | React.ReactNode,
  textClassName?: string
): React.ReactNode {
  // If it's already a React element, return as is
  if (React.isValidElement(description)) {
    return description;
  }

  // If it's not a string, return as is
  if (typeof description !== 'string') {
    return description;
  }

  // Two inline patterns: tooltip placeholders [(LABEL)](#tooltip-TYPE) and
  // external markdown links [label](https://...). The corpus authors both.
  const inlinePattern = /\[(.*?)\]\((#tooltip-([^)]*)|https?:\/\/[^)\s]+)\)/g;

  // Split the text by inline placeholders and build JSX
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = inlinePattern.exec(description)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(description.substring(lastIndex, match.index));
    }

    const label = match[1]; // e.g., "PSM" or "Spark.fi"
    const target = match[2]; // "#tooltip-psm" or "https://spark.fi"
    const tooltipTypeRaw = match[3]; // e.g., "psm" (undefined for links)

    if (tooltipTypeRaw !== undefined) {
      const tooltipKey = resolvePopoverTooltipKey(tooltipTypeRaw);
      if (tooltipKey) {
        parts.push(
          <React.Fragment key={`tooltip-${match.index}`}>
            {label} <PopoverRateInfo type={tooltipKey} />
          </React.Fragment>
        );
      } else {
        console.warn(`Unknown tooltip type: ${tooltipTypeRaw}`);
        parts.push(label);
      }
    } else {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fgBrand hover:underline"
        >
          {label}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last match
  if (lastIndex < description.length) {
    parts.push(description.substring(lastIndex));
  }

  // Plain text (no placeholders) keeps the single-string Trans so the catalog
  // entry stays a simple message.
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return (
      <Text variant="small" className={cn('leading-[18px]', textClassName)}>
        <Trans>{description}</Trans>
      </Text>
    );
  }

  // Wrap in Text component with Trans for internationalization
  return (
    <Text variant="small" className={cn('leading-[18px]', textClassName)}>
      <Trans>{parts}</Trans>
    </Text>
  );
}
