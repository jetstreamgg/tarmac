import React from 'react';
import { Text } from '@/modules/layout/components/Typography';
import {
  PopoverRateInfo as PopoverInfo,
  POPOVER_TOOLTIP_TYPES,
  type PopoverTooltipType
} from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';

// Use the exported constant from the widgets package for runtime validation
// Create a set for O(1) lookup performance
const TOOLTIP_TYPE_SET = new Set<string>(POPOVER_TOOLTIP_TYPES);

/**
 * Parses banner description text and replaces tooltip placeholders with React components
 * Supports patterns like [(PSM)](#tooltip-psm) which get replaced with <PopoverInfo type="psm" />
 */
export function parseBannerContent(description: string | React.ReactNode): React.ReactNode {
  // If it's already a React element, return as is
  if (React.isValidElement(description)) {
    return description;
  }

  // If it's not a string, return as is
  if (typeof description !== 'string') {
    return description;
  }

  // Pattern to match tooltip placeholders: [(LABEL)](#tooltip-TYPE)
  const tooltipPattern = /\[(.*?)\]\(#tooltip-(.*?)\)/g;

  // Check if the description contains any tooltip placeholders
  if (!tooltipPattern.test(description)) {
    // No tooltips found, return the plain text
    return (
      <Text variant="small" className="leading-[18px]">
        <Trans>{description}</Trans>
      </Text>
    );
  }

  // Reset the regex lastIndex after test
  tooltipPattern.lastIndex = 0;

  // Split the text by tooltip placeholders and build JSX
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tooltipPattern.exec(description)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(description.substring(lastIndex, match.index));
    }

    // Add the tooltip component
    const label = match[1]; // e.g., "PSM"
    const tooltipTypeRaw = match[2]; // e.g., "psm"

    // Validate that the tooltip type is valid
    if (TOOLTIP_TYPE_SET.has(tooltipTypeRaw)) {
      // TypeScript knows this is safe because we validated it exists in the set
      const tooltipType = tooltipTypeRaw as PopoverTooltipType;

      // Add the label text followed by the tooltip
      parts.push(
        <React.Fragment key={`tooltip-${match.index}`}>
          {label} <PopoverInfo type={tooltipType} />
        </React.Fragment>
      );
    } else {
      // If tooltip type is not recognized, just add the label without tooltip
      console.warn(`Unknown tooltip type: ${tooltipTypeRaw}`);
      parts.push(label);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last match
  if (lastIndex < description.length) {
    parts.push(description.substring(lastIndex));
  }

  // Wrap in Text component with Trans for internationalization
  return (
    <Text variant="small" className="leading-[18px]">
      <Trans>{parts}</Trans>
    </Text>
  );
}

/**
 * Helper to check if a banner description needs tooltip parsing
 */
export function hasTooltipPlaceholders(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  }
  return /\[(.*?)\]\(#tooltip-(.*?)\)/g.test(description);
}
